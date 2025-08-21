const express = require('express');
const multer = require('multer');
const axios = require('axios').default;
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const PQueue = require('p-queue');
const path = require('path');
const cluster = require('cluster');
const { WorkerPool, promiseTimeout, getMemoryUsage } = require('./utils');

const app = express();
app.use(express.json({ limit: '20mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por janela de tempo
  message: {
    error: 'Muitas requisições deste IP, tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Slow down requests after threshold
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutos
  delayAfter: 20, // allow 20 requests per 15 minutes at full speed
  delayMs: () => 500, // slow down subsequent requests by 500ms per request
  validate: { delayMs: false } // disable warning
});

app.use(limiter);
app.use(speedLimiter);

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// Worker pool para processamento PDF
const workerPool = new WorkerPool(path.join(__dirname, 'worker.js'), 2);

// Queue para controlar concorrência
const processingQueue = new PQueue({ 
  concurrency: 4,
  timeout: 120000,
  throwOnTimeout: true
});

// Memory monitoring
setInterval(() => {
  const usage = getMemoryUsage();
  if (cluster.isWorker) {
    console.log(`[Worker ${process.pid}] Memory: ${usage.heapUsed}/${usage.heapTotal}`);
  }
}, 30000);

// Health check endpoint
app.get('/health', (req, res) => {
  const usage = getMemoryUsage();
  res.json({
    status: 'ok',
    pid: process.pid,
    memory: usage,
    queue: {
      size: processingQueue.size,
      pending: processingQueue.pending
    },
    uptime: process.uptime()
  });
});

async function processPdfWithWorker(pdfBuffer, options = {}) {
  return await processingQueue.add(async () => {
    console.log(`[Worker ${process.pid}] Processando PDF...`);
    return await workerPool.execute({ pdfBuffer, options }, 120000);
  });
}

// POST /extract  (via URL)
app.post('/extract', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { pdfUrl, page = 1, prefer = 'auto', tryAllPages = true } = req.body || {};
    if (!pdfUrl) return res.status(400).json({ error: 'Informe pdfUrl.' });
    
    console.log(`[Worker ${process.pid}] Baixando PDF de: ${pdfUrl}`);
    
    // Download com timeout
    const resp = await promiseTimeout(
      axios.get(pdfUrl, { 
        responseType: 'arraybuffer', 
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024 // 50MB max
      }),
      35000,
      'Timeout no download do PDF'
    );
    
    console.log(`[Worker ${process.pid}] PDF baixado, tamanho: ${resp.data.byteLength} bytes`);
    
    // Processamento via worker thread
    const result = await processPdfWithWorker(
      Buffer.from(resp.data), 
      { 
        page: Number(page) || 1, 
        prefer, 
        tryAllPages: !!tryAllPages 
      }
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`[Worker ${process.pid}] Processamento concluído em ${processingTime}ms`);
    
    return res.json({
      ...result,
      processingTime,
      worker: process.pid
    });
  } catch (err) {
    const processingTime = Date.now() - startTime;
    console.error(`[Worker ${process.pid}] Erro no endpoint /extract:`, err.message);
    
    if (err.message.includes('Timeout')) {
      return res.status(408).json({ 
        error: err.message,
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
    
    console.log(`[Worker ${process.pid}] PDF recebido via upload, tamanho: ${req.file.buffer.length} bytes`);
    
    // Processamento via worker thread
    const result = await processPdfWithWorker(
      req.file.buffer, 
      { 
        page: Number(page) || 1, 
        prefer, 
        tryAllPages: !!tryAllPages 
      }
    );
    
    const processingTime = Date.now() - startTime;
    console.log(`[Worker ${process.pid}] Processamento concluído em ${processingTime}ms`);
    
    return res.json({
      ...result,
      processingTime,
      worker: process.pid
    });
  } catch (err) {
    const processingTime = Date.now() - startTime;
    console.error(`[Worker ${process.pid}] Erro no endpoint /extract-upload:`, err.message);
    
    if (err.message.includes('Timeout')) {
      return res.status(408).json({ 
        error: err.message,
        processingTime
      });
    }
    
    return res.status(500).json({ 
      error: err && err.message ? err.message : String(err),
      processingTime
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(`\n[Worker ${process.pid}] Recebido SIGINT, encerrando gracefully...`);
  
  try {
    await workerPool.terminate();
    console.log(`[Worker ${process.pid}] Worker pool finalizado`);
    process.exit(0);
  } catch (err) {
    console.error(`[Worker ${process.pid}] Erro no shutdown:`, err);
    process.exit(1);
  }
});

process.on('SIGTERM', () => {
  console.log(`\n[Worker ${process.pid}] Recebido SIGTERM`);
  process.emit('SIGINT');
});

const PORT = process.env.PORT || 8080;
const server = app.listen(PORT, () => {
  if (cluster.isWorker) {
    console.log(`\n[Worker ${process.pid}] ✅ Servidor rodando na porta ${PORT}`);
  } else {
    console.log(`\n========================================`);
    console.log(`  Boleto Extractor - QR Code & Linha Digitável`);
    console.log(`========================================\n`);
    console.log(`✅ Servidor rodando na porta ${PORT}`);
    console.log(`\nEndpoints disponíveis:`);
    console.log(`  📤 POST http://localhost:${PORT}/extract`);
    console.log(`     - Enviar: { "pdfUrl": "http://..." }`);
    console.log(`\n  📁 POST http://localhost:${PORT}/extract-upload`);
    console.log(`     - Enviar arquivo PDF via form-data (campo: file)`);
    console.log(`\n  🔍 GET http://localhost:${PORT}/health`);
    console.log(`     - Status e métricas do servidor\n`);
    console.log(`Opções (ambos endpoints):`);
    console.log(`  - page: número da página inicial (padrão: 1)`);
    console.log(`  - tryAllPages: tentar todas as páginas (padrão: true)`);
    console.log(`  - prefer: 'qr', 'linha' ou 'auto' (padrão: 'auto')\n`);
    console.log(`Rate Limiting: 100 requests/15min por IP`);
    console.log(`Concorrência: 4 PDFs simultâneos por worker\n`);
  }
});

module.exports = server;