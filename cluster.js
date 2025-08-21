const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`\n========================================`);
  console.log(`  Boleto Extractor - Cluster Mode`);
  console.log(`========================================\n`);
  console.log(`🚀 Master ${process.pid} iniciado`);
  console.log(`📊 Spawning ${numCPUs} workers`);

  const workers = new Map();

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    workers.set(worker.process.pid, worker);
    console.log(`👷 Worker ${worker.process.pid} iniciado`);
  }

  // Monitor workers
  cluster.on('exit', (worker, code, signal) => {
    console.log(`💀 Worker ${worker.process.pid} morreu (${signal || code})`);
    workers.delete(worker.process.pid);
    
    if (!worker.exitedAfterDisconnect) {
      console.log('🔄 Reiniciando worker...');
      const newWorker = cluster.fork();
      workers.set(newWorker.process.pid, newWorker);
      console.log(`👷 Worker ${newWorker.process.pid} iniciado`);
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutdown signal recebido...');
    console.log('📊 Encerrando workers gracefully...');
    
    const shutdownPromises = Array.from(workers.values()).map(worker => {
      return new Promise((resolve) => {
        worker.disconnect();
        
        const timeout = setTimeout(() => {
          console.log(`⏱️  Worker ${worker.process.pid} forçado a parar`);
          worker.kill();
          resolve();
        }, 10000);
        
        worker.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    });
    
    Promise.all(shutdownPromises).then(() => {
      console.log('✅ Todos os workers finalizados');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM recebido, encerrando...');
    process.emit('SIGINT');
  });

} else {
  // Worker process - carrega o servidor
  require('./server.js');
}