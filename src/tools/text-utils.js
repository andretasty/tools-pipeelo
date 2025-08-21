const BaseTool = require('./base-tool');

class TextUtilsTool extends BaseTool {
  constructor() {
    super('text-utils', 'Utilitários para manipulação de texto', '1.0.0');
  }

  getRoutes() {
    return [
      {
        method: 'POST',
        path: '/uppercase',
        handler: this.toUpperCase.bind(this),
        description: 'Converte texto para maiúsculas'
      },
      {
        method: 'POST',
        path: '/lowercase',
        handler: this.toLowerCase.bind(this),
        description: 'Converte texto para minúsculas'
      },
      {
        method: 'POST',
        path: '/clean-phone',
        handler: this.cleanPhone.bind(this),
        description: 'Remove formatação de números de telefone'
      },
      {
        method: 'POST',
        path: '/format-cpf',
        handler: this.formatCpf.bind(this),
        description: 'Formata CPF com pontos e traços'
      },
      {
        method: 'POST',
        path: '/validate-email',
        handler: this.validateEmail.bind(this),
        description: 'Valida formato de email'
      }
    ];
  }

  toUpperCase(req, res) {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Campo "text" é obrigatório' });
      }

      const result = text.toUpperCase();
      this.sendSuccess(res, { original: text, result }, 'Texto convertido para maiúsculas');
    } catch (error) {
      this.handleError(res, error);
    }
  }

  toLowerCase(req, res) {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Campo "text" é obrigatório' });
      }

      const result = text.toLowerCase();
      this.sendSuccess(res, { original: text, result }, 'Texto convertido para minúsculas');
    } catch (error) {
      this.handleError(res, error);
    }
  }

  cleanPhone(req, res) {
    try {
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({ error: 'Campo "phone" é obrigatório' });
      }

      // Remove tudo que não é número
      const cleaned = phone.replace(/\D/g, '');
      
      this.sendSuccess(res, { 
        original: phone, 
        cleaned,
        length: cleaned.length,
        isValid: cleaned.length >= 10 && cleaned.length <= 11
      }, 'Telefone limpo');
    } catch (error) {
      this.handleError(res, error);
    }
  }

  formatCpf(req, res) {
    try {
      const { cpf } = req.body;
      
      if (!cpf) {
        return res.status(400).json({ error: 'Campo "cpf" é obrigatório' });
      }

      // Remove tudo que não é número
      const numbers = cpf.replace(/\D/g, '');
      
      if (numbers.length !== 11) {
        return res.status(400).json({ error: 'CPF deve ter 11 dígitos' });
      }

      // Formatar CPF
      const formatted = numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      
      this.sendSuccess(res, { 
        original: cpf, 
        cleaned: numbers,
        formatted 
      }, 'CPF formatado');
    } catch (error) {
      this.handleError(res, error);
    }
  }

  validateEmail(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: 'Campo "email" é obrigatório' });
      }

      // Regex simples para validar email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValid = emailRegex.test(email);
      
      this.sendSuccess(res, { 
        email, 
        isValid,
        domain: isValid ? email.split('@')[1] : null
      }, isValid ? 'Email válido' : 'Email inválido');
    } catch (error) {
      this.handleError(res, error);
    }
  }
}

module.exports = TextUtilsTool;