const { Worker } = require('worker_threads');
const path = require('path');

class WorkerPool {
  constructor(workerScript, poolSize = require('os').cpus().length) {
    this.workerScript = workerScript;
    this.poolSize = poolSize;
    this.workers = [];
    this.freeWorkers = [];
    this.tasks = new Map();
    this.taskIdCounter = 0;
    
    this.initializeWorkers();
  }
  
  initializeWorkers() {
    for (let i = 0; i < this.poolSize; i++) {
      this.createWorker();
    }
  }
  
  createWorker() {
    const worker = new Worker(this.workerScript);
    
    worker.on('message', (data) => {
      const { taskId, success, result, error } = data;
      const task = this.tasks.get(taskId);
      
      if (task) {
        this.tasks.delete(taskId);
        this.freeWorkers.push(worker);
        
        if (success) {
          task.resolve(result);
        } else {
          task.reject(new Error(error));
        }
      }
    });
    
    worker.on('error', (error) => {
      console.error('Worker error:', error);
      this.restartWorker(worker);
    });
    
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
        this.restartWorker(worker);
      }
    });
    
    this.workers.push(worker);
    this.freeWorkers.push(worker);
  }
  
  restartWorker(deadWorker) {
    const index = this.workers.indexOf(deadWorker);
    if (index !== -1) {
      this.workers.splice(index, 1);
      const freeIndex = this.freeWorkers.indexOf(deadWorker);
      if (freeIndex !== -1) {
        this.freeWorkers.splice(freeIndex, 1);
      }
      this.createWorker();
    }
  }
  
  async execute(data, timeout = 120000) {
    return new Promise((resolve, reject) => {
      const taskId = ++this.taskIdCounter;
      
      // Timeout para a tarefa
      const timeoutId = setTimeout(() => {
        if (this.tasks.has(taskId)) {
          this.tasks.delete(taskId);
          reject(new Error('Timeout de processamento excedido'));
        }
      }, timeout);
      
      this.tasks.set(taskId, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
      
      if (this.freeWorkers.length > 0) {
        const worker = this.freeWorkers.pop();
        worker.postMessage({ taskId, ...data });
      } else {
        // Se não há workers livres, aguardar na fila
        setTimeout(() => {
          if (this.tasks.has(taskId) && this.freeWorkers.length > 0) {
            const worker = this.freeWorkers.pop();
            worker.postMessage({ taskId, ...data });
          }
        }, 100);
      }
    });
  }
  
  async terminate() {
    const promises = this.workers.map(worker => worker.terminate());
    await Promise.all(promises);
    this.workers = [];
    this.freeWorkers = [];
    this.tasks.clear();
  }
}

function promiseTimeout(promise, timeout, errorMessage = 'Operation timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeout)
    )
  ]);
}

function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: formatBytes(usage.rss),
    heapTotal: formatBytes(usage.heapTotal),
    heapUsed: formatBytes(usage.heapUsed),
    external: formatBytes(usage.external)
  };
}

module.exports = {
  WorkerPool,
  promiseTimeout,
  formatBytes,
  getMemoryUsage
};