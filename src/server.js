const express = require('express');
const Toolbox = require('./toolbox');

const app = express();

// Middlewares básicos
app.use(express.json({ limit: '20mb' }));

// Instanciar toolbox
const toolbox = new Toolbox();

// Health check endpoint - mais robusto para EasyPanel
app.get('/health', (req, res) => {
  try {
    const tools = toolbox.getToolsList();
    res.status(200).json({
      status: 'healthy',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      pid: process.pid,
      tools: tools.length
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

// Endpoint para listar ferramentas disponíveis
app.get('/tools', (req, res) => {
  res.json({
    service: 'Toolbox Service',
    version: '2.0.0',
    tools: toolbox.getToolsList()
  });
});

// Endpoint para root que mostra informações do toolbox
app.get('/', (req, res) => {
  const tools = toolbox.getToolsList();
  const allEndpoints = [];
  
  // Endpoints do sistema
  allEndpoints.push(
    { method: 'GET', path: '/health', description: 'Health check' },
    { method: 'GET', path: '/ping', description: 'Simple ping' },
    { method: 'GET', path: '/tools', description: 'Lista todas as ferramentas disponíveis' }
  );
  
  // Endpoints das ferramentas
  tools.forEach(tool => {
    allEndpoints.push(...tool.endpoints);
  });

  res.status(200).json({
    service: 'Toolbox Service',
    status: 'running',
    version: '2.0.0',
    description: 'Servidor de ferramentas utilitárias',
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      version: tool.version
    })),
    endpoints: allEndpoints
  });
});

// Registrar rotas das ferramentas
app.use('/api', toolbox.getRouter());

// Middleware de timeout
app.use((req, res, next) => {
  req.setTimeout(120000); // 2 minutos
  res.setTimeout(120000); // 2 minutos
  next();
});

// Handlers de erro global
process.on('uncaughtException', (err) => {
  console.error('Erro não capturado:', err);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejeitada não tratada:', reason);
  console.error('Promise:', promise);
});

// Graceful shutdown
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
  console.log(`  Toolbox Service`);
  console.log(`========================================\n`);
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📋 PID: ${process.pid}`);
  console.log(`🖥️  Node.js: ${process.version}`);
  console.log(`⏰ Iniciado em: ${new Date().toISOString()}`);
  console.log(`🔧 Tools carregadas: ${toolbox.getToolsList().length}`);
  console.log(`\nEndpoints principais:`);
  console.log(`  GET  /tools - Lista ferramentas disponíveis`);
  console.log(`  GET  /health - Status do servidor`);
  console.log(`  POST /api/<tool>/<endpoint> - Usar ferramentas\n`);
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