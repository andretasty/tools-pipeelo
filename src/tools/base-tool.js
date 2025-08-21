/**
 * Classe base para todas as ferramentas do toolbox
 */
class BaseTool {
  constructor(name, description, version = '1.0.0') {
    this.name = name;
    this.description = description;
    this.version = version;
  }

  /**
   * Método que deve ser implementado por cada ferramenta
   * Retorna array de rotas no formato:
   * [
   *   {
   *     method: 'GET' | 'POST' | 'PUT' | 'DELETE',
   *     path: '/rota',
   *     handler: (req, res) => {},
   *     description: 'Descrição do endpoint'
   *   }
   * ]
   */
  getRoutes() {
    throw new Error('Método getRoutes() deve ser implementado pela ferramenta');
  }

  /**
   * Método auxiliar para logging consistente
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] [${this.name}] ${message}`);
  }

  /**
   * Método auxiliar para tratamento de erros
   */
  handleError(res, error, statusCode = 500) {
    this.log(`Erro: ${error.message}`, 'error');
    res.status(statusCode).json({
      error: error.message,
      tool: this.name,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Método auxiliar para resposta de sucesso
   */
  sendSuccess(res, data, message = 'Operação realizada com sucesso') {
    res.json({
      success: true,
      message,
      data,
      tool: this.name,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = BaseTool;