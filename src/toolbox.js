const express = require('express');
const path = require('path');
const fs = require('fs');

class Toolbox {
  constructor() {
    this.router = express.Router();
    this.tools = new Map();
    this.loadTools();
  }

  loadTools() {
    const toolsDir = path.join(__dirname, 'tools');
    
    // Criar diretório se não existir
    if (!fs.existsSync(toolsDir)) {
      fs.mkdirSync(toolsDir, { recursive: true });
    }

    // Carregar todas as ferramentas do diretório
    const toolFiles = fs.readdirSync(toolsDir).filter(file => file.endsWith('.js'));
    
    toolFiles.forEach(file => {
      try {
        const toolPath = path.join(toolsDir, file);
        const Tool = require(toolPath);
        const toolInstance = new Tool();
        
        if (this.validateTool(toolInstance)) {
          this.registerTool(toolInstance);
        } else {
          console.warn(`Tool ${file} não é válida - ignorando`);
        }
      } catch (error) {
        console.error(`Erro ao carregar tool ${file}:`, error.message);
      }
    });
  }

  validateTool(tool) {
    return (
      tool.name &&
      tool.description &&
      tool.version &&
      typeof tool.getRoutes === 'function'
    );
  }

  registerTool(tool) {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} já existe - sobrescrevendo`);
    }

    this.tools.set(tool.name, tool);
    
    // Registrar rotas da ferramenta
    const routes = tool.getRoutes();
    routes.forEach(route => {
      const { method, path: routePath, handler } = route;
      // handler pode ser uma função ou array de middlewares
      if (Array.isArray(handler)) {
        this.router[method.toLowerCase()](`/${tool.name}${routePath}`, ...handler);
      } else {
        this.router[method.toLowerCase()](`/${tool.name}${routePath}`, handler);
      }
    });

    console.log(`✅ Tool registrada: ${tool.name} v${tool.version} - ${tool.description}`);
  }

  getToolsList() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      version: tool.version,
      endpoints: tool.getRoutes().map(route => ({
        method: route.method,
        path: `/${tool.name}${route.path}`,
        description: route.description
      }))
    }));
  }

  getRouter() {
    return this.router;
  }
}

module.exports = Toolbox;