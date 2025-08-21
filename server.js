const express = require('express');
const multer = require('multer');
const axios = require('axios').default;
const jsQR = require('jsqr');
const { createCanvas, Image } = require('@napi-rs/canvas');

// Polyfill para o pdfjs-dist usar @napi-rs/canvas
global.Canvas = { createCanvas };
global.Image = Image;

// Configuração do pdfjs-dist para Node.js
const pdfjsLib = require('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc = false;
pdfjsLib.GlobalWorkerOptions.verbosity = pdfjsLib.VerbosityLevel.ERRORS;

const app = express();
app.use(express.json({ limit: '20mb' }));

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// Health check endpoint - mais robusto para EasyPanel
app.get('/health', (req, res) => {
  try {
    res.status(200).json({
      status: 'healthy',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      pid: process.pid
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message
    });
  }
});

// Endpoint alternativo mais simples para health check
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Endpoint para root também
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'Boleto Extractor',
    status: 'running',
    version: '1.0.0',
    endpoints: [
      'GET /health - Health check',
      'GET /ping - Simple ping',
      'POST /extract - Process PDF from URL',
      'POST /extract-upload - Upload PDF file'
    ]
  });
});

function extractLinhaDigitavel(text) {
  const mFmt = text.match(/(\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}\s\d\s\d{14})/);
  if (mFmt) {
    const raw = mFmt[1];
    return { type: 'linha_digitavel', formatted: raw, digitsOnly: raw.replace(/\D/g, '') };
  }
  
  const onlyDigits = text.replace(/\D/g, ' ');
  const m47 = onlyDigits.match(/\b(\d{47})\b/);
  if (m47) return { type: 'linha_digitavel', formatted: m47[1], digitsOnly: m47[1] };
  const m48 = onlyDigits.match(/\b(\d{48})\b/);
  if (m48) return { type: 'linha_digitavel', formatted: m48[1], digitsOnly: m48[1] };
  return null;
}

async function renderPageToCanvas(page, scale = 2.0) {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const context = canvas.getContext('2d');
  
  context.imageSmoothingEnabled = false;
  
  const canvasFactory = {
    create: (width, height) => {
      const newCanvas = createCanvas(width, height);
      return {
        canvas: newCanvas,
        context: newCanvas.getContext('2d')
      };
    },
    reset: (canvasAndContext, width, height) => {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy: (canvasAndContext) => {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
  };
  
  try {
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvasFactory: canvasFactory
    }).promise;
  } catch (err) {
    throw err;
  }
  
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  
  // Preservar dimensões antes de limpar canvas
  const result = {
    data: new Uint8ClampedArray(imageData.data),
    width: canvas.width,
    height: canvas.height
  };
  
  // Limpar canvas para liberar memória
  canvas.width = 0;
  canvas.height = 0;
  
  return result;
}

async function processPdfBuffer(pdfBuffer, options = {}) {
  const { prefer = 'auto', page = 1, tryAllPages = true } = options;
  
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
      disableWorker: true
    });
    
    const pdf = await loadingTask.promise;

    const pagesToTry = [];
    if (tryAllPages) {
      const maxPages = Math.min(pdf.numPages, 10);
      for (let p = page; p <= maxPages; p++) {
        pagesToTry.push(p);
      }
    } else {
      pagesToTry.push(page);
    }

    for (const pageNum of pagesToTry) {
      try {
        const pdfPage = await pdf.getPage(pageNum);
        
        // Extrair texto da página
        const textContent = await pdfPage.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');
        
        // Tentar extrair linha digitável do texto
        if (prefer !== 'qr') {
          const linha = extractLinhaDigitavel(text);
          if (linha) {
            return { page: pageNum, ...linha };
          }
        }
        
        // Tentar extrair QR code renderizando a página
        if (prefer !== 'linha') {
          try {
            const imageData = await renderPageToCanvas(pdfPage, 3.0);
            
            // Verificar se imageData é válido
            if (imageData && imageData.data && imageData.width > 0 && imageData.height > 0) {
              const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
              
              if (qrCode && qrCode.data) {
                return { 
                  page: pageNum, 
                  type: 'qr', 
                  payload: qrCode.data 
                };
              }
            }
            
            const imageDataLow = await renderPageToCanvas(pdfPage, 1.5);
            
            // Verificar se imageDataLow é válido
            if (imageDataLow && imageDataLow.data && imageDataLow.width > 0 && imageDataLow.height > 0) {
              const qrCodeLow = jsQR(imageDataLow.data, imageDataLow.width, imageDataLow.height, {
                inversionAttempts: 'attemptBoth'
              });
              
              if (qrCodeLow && qrCodeLow.data) {
                return { 
                  page: pageNum, 
                  type: 'qr', 
                  payload: qrCodeLow.data 
                };
              }
            }
          } catch (renderErr) {
            console.error(`Erro ao renderizar página ${pageNum}:`, renderErr.message);
            // Continua tentando outras páginas mesmo com erro de renderização
          }
        }
      } catch (pageErr) {
        console.error(`Erro ao processar página ${pageNum}:`, pageErr.message);
        if (pageErr.message && pageErr.message.includes('Invalid page')) {
          break;
        }
      }
    }

    // Limpar PDF da memória
    await pdf.destroy();

    return { 
      type: 'none', 
      message: 'QR code e linha digitável não encontrados nas páginas analisadas.' 
    };
  } catch (err) {
    throw new Error(`Erro ao processar PDF: ${err.message}`);
  }
}

// POST /extract  (via URL)
app.post('/extract', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { pdfUrl, page = 1, prefer = 'auto', tryAllPages = true } = req.body || {};
    if (!pdfUrl) return res.status(400).json({ error: 'Informe pdfUrl.' });
    
    console.log(`Baixando PDF de: ${pdfUrl}`);
    
    // Download com timeout
    const resp = await axios.get(pdfUrl, { 
      responseType: 'arraybuffer', 
      timeout: 30000,
      maxContentLength: 50 * 1024 * 1024 // 50MB max
    });
    
    console.log(`PDF baixado, tamanho: ${resp.data.byteLength} bytes`);
    
    // Processamento
    const result = await processPdfBuffer(
      Buffer.from(resp.data), 
      { 
        page: Number(page) || 1, 
        prefer, 
        tryAllPages: !!tryAllPages 
      }
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`Processamento concluído em ${processingTime}ms`);
    
    return res.json({
      ...result,
      processingTime
    });
  } catch (err) {
    const processingTime = Date.now() - startTime;
    console.error(`Erro no endpoint /extract:`, err.message);
    
    if (err.message && err.message.includes('timeout')) {
      return res.status(408).json({ 
        error: 'Timeout no processamento',
        processingTime
      });
    }
    
    return res.status(500).json({ 
      error: err && err.message ? err.message : String(err),
      processingTime
    });
  }
});

// POST /extract-upload  (multipart form-data com campo "file")
app.post('/extract-upload', upload.single('file'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie o arquivo em "file".' });
    
    const { page = 1, prefer = 'auto', tryAllPages = true } = req.body || {};
    
    console.log(`PDF recebido via upload, tamanho: ${req.file.buffer.length} bytes`);
    
    // Processamento
    const result = await processPdfBuffer(
      req.file.buffer, 
      { 
        page: Number(page) || 1, 
        prefer, 
        tryAllPages: !!tryAllPages 
      }
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`Processamento concluído em ${processingTime}ms`);
    
    return res.json({
      ...result,
      processingTime
    });
  } catch (err) {
    const processingTime = Date.now() - startTime;
    console.error(`Erro no endpoint /extract-upload:`, err.message);
    
    if (err.message && err.message.includes('timeout')) {
      return res.status(408).json({ 
        error: 'Timeout no processamento',
        processingTime
      });
    }
    
    return res.status(500).json({ 
      error: err && err.message ? err.message : String(err),
      processingTime
    });
  }
});

// Handlers de erro global
process.on('uncaughtException', (err) => {
  console.error('Erro não capturado:', err);
  console.error('Stack:', err.stack);
  // Não encerrar o processo automaticamente
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejeitada não tratada:', reason);
  console.error('Promise:', promise);
  // Não encerrar o processo automaticamente
});

// Graceful shutdown apenas para sinais explícitos
process.on('SIGINT', () => {
  console.log('\n[SIGINT] Recebido sinal de interrupção manual...');
  console.log('Encerrando servidor graciosamente...');
  server.close(() => {
    console.log('Servidor encerrado.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[SIGTERM] Recebido sinal de término...');
  console.log('Encerrando servidor graciosamente...');
  server.close(() => {
    console.log('Servidor encerrado.');
    process.exit(0);
  });
});

// Log quando o processo está sendo finalizado
process.on('exit', (code) => {
  console.log(`\n[EXIT] Processo finalizando com código: ${code}`);
});

// Log de sinais recebidos
process.on('SIGUSR1', () => {
  console.log('[SIGUSR1] Sinal recebido - ignorando');
});

process.on('SIGUSR2', () => {
  console.log('[SIGUSR2] Sinal recebido - ignorando');
});

// Configurar timeouts mais longos para requests
app.use((req, res, next) => {
  req.setTimeout(120000); // 2 minutos
  res.setTimeout(120000); // 2 minutos
  next();
});

// Monitoramento de memória
setInterval(() => {
  const used = process.memoryUsage();
  console.log(`Memory usage: RSS ${Math.round(used.rss / 1024 / 1024 * 100) / 100} MB, Heap ${Math.round(used.heapUsed / 1024 / 1024 * 100) / 100} MB`);
  
  // Force garbage collection se disponível
  if (global.gc && used.heapUsed > 500 * 1024 * 1024) { // > 500MB
    console.log('Forçando garbage collection...');
    global.gc();
  }
}, 30000); // A cada 30 segundos

const PORT = process.env.PORT || 8090;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`  Boleto Extractor Service`);
  console.log(`========================================\n`);
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📋 PID: ${process.pid}`);
  console.log(`🖥️  Node.js: ${process.version}`);
  console.log(`⏰ Iniciado em: ${new Date().toISOString()}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /extract - Processar PDF via URL`);
  console.log(`  POST /extract-upload - Upload de arquivo PDF`);
  console.log(`  GET /health - Status do servidor\n`);
});

// Log de eventos do servidor
server.on('error', (err) => {
  console.error('Erro no servidor:', err);
});

server.on('close', () => {
  console.log('Servidor HTTP fechado');
});

// Keepalive para manter processo ativo
const keepAlive = setInterval(() => {
  console.log(`[${new Date().toISOString()}] Processo ativo - PID: ${process.pid}, Uptime: ${Math.floor(process.uptime())}s`);
}, 60000); // A cada minuto

// Limpar interval no shutdown
process.on('exit', () => {
  clearInterval(keepAlive);
});

// Configurar timeout do servidor
server.timeout = 120000; // 2 minutos

module.exports = server;