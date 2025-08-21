# 🧰 Tools Pipeelo

Um servidor de ferramentas utilitárias modular e extensível, construído com Node.js e Express. Originalmente um extrator de boletos, agora transformado em uma toolbox completa para diversas utilidades.

## 🚀 Funcionalidades

- **🏗️ Arquitetura Modular**: Adicione novas ferramentas facilmente
- **📄 Extração de Boletos**: Extrai QR codes PIX e linha digitável de PDFs
- **✏️ Utilitários de Texto**: Formatação, validação e manipulação de texto
- **🔄 Auto-loading**: Ferramentas são descobertas automaticamente
- **📊 Monitoramento**: Health check e métricas de performance
- **🐳 Docker Ready**: Containerizado e pronto para deploy

## 📋 Índice

- [Instalação](#instalação)
- [Uso Básico](#uso-básico)
- [Ferramentas Disponíveis](#ferramentas-disponíveis)
- [Como Adicionar Novas Tools](#como-adicionar-novas-tools)
- [API Reference](#api-reference)
- [Docker](#docker)
- [Desenvolvimento](#desenvolvimento)

## 🛠️ Instalação

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn

### Instalação Local

```bash
# Clone o repositório
git clone https://github.com/andretasty/tools-pipeelo.git
cd tools-pipeelo

# Instale as dependências
npm install

# Inicie o servidor
npm start
```

O servidor estará disponível em `http://localhost:8090`

## 🎯 Uso Básico

### Verificar Status do Servidor

```bash
curl http://localhost:8090/health
```

### Listar Todas as Ferramentas

```bash
curl http://localhost:8090/tools
```

### Usar uma Ferramenta

```bash
# Exemplo: Converter texto para maiúsculas
curl -X POST http://localhost:8090/api/text-utils/uppercase \
  -H "Content-Type: application/json" \
  -d '{"text": "hello world"}'
```

## 🔧 Ferramentas Disponíveis

### 📄 Extractor (Extração de Boletos)

Extrai informações de pagamento de PDFs de boletos brasileiros.

#### Endpoints:
- `POST /api/extractor/extract` - Processar PDF via URL
- `POST /api/extractor/extract-upload` - Upload de arquivo PDF

#### Exemplos:

**Extração via URL:**
```bash
curl -X POST http://localhost:8090/api/extractor/extract \
  -H "Content-Type: application/json" \
  -d '{
    "pdfUrl": "https://exemplo.com/boleto.pdf",
    "prefer": "auto",
    "tryAllPages": true
  }'
```

**Extração via Upload:**
```bash
curl -X POST http://localhost:8090/api/extractor/extract-upload \
  -F "file=@boleto.pdf" \
  -F "prefer=auto" \
  -F "tryAllPages=true"
```

#### Parâmetros:
- `page` (default: 1) - Página inicial para processar
- `tryAllPages` (default: true) - Escanear todas as páginas
- `prefer` (default: 'auto') - Preferência de extração:
  - `'qr'` - Apenas QR codes PIX
  - `'linha'` - Apenas linha digitável
  - `'auto'` - Ambos os métodos

### ✏️ Text Utils (Utilitários de Texto)

Ferramentas para manipulação e validação de texto.

#### Endpoints:
- `POST /api/text-utils/uppercase` - Converter para maiúsculas
- `POST /api/text-utils/lowercase` - Converter para minúsculas  
- `POST /api/text-utils/clean-phone` - Limpar formatação de telefone
- `POST /api/text-utils/format-cpf` - Formatar CPF
- `POST /api/text-utils/validate-email` - Validar email

#### Exemplos:

**Validar Email:**
```bash
curl -X POST http://localhost:8090/api/text-utils/validate-email \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario@exemplo.com"}'
```

**Formatar CPF:**
```bash
curl -X POST http://localhost:8090/api/text-utils/format-cpf \
  -H "Content-Type: application/json" \
  -d '{"cpf": "12345678901"}'
```

## 🎨 Como Adicionar Novas Tools

### 1. Criar Nova Ferramenta

Crie um arquivo em `src/tools/minha-tool.js`:

```javascript
const BaseTool = require('./base-tool');

class MinhaTool extends BaseTool {
  constructor() {
    super('minha-tool', 'Descrição da minha ferramenta', '1.0.0');
  }

  getRoutes() {
    return [
      {
        method: 'POST',
        path: '/processar',
        handler: this.processar.bind(this),
        description: 'Processa dados de entrada'
      },
      {
        method: 'GET',
        path: '/status',
        handler: this.obterStatus.bind(this),
        description: 'Obtém status da ferramenta'
      }
    ];
  }

  async processar(req, res) {
    try {
      const { dados } = req.body;
      
      if (!dados) {
        return res.status(400).json({ error: 'Dados são obrigatórios' });
      }

      // Sua lógica de processamento aqui
      const resultado = await this.processarDados(dados);
      
      this.sendSuccess(res, { resultado }, 'Dados processados com sucesso');
    } catch (error) {
      this.handleError(res, error);
    }
  }

  obterStatus(req, res) {
    this.sendSuccess(res, { 
      status: 'ativo',
      versao: this.version,
      uptime: process.uptime()
    });
  }

  async processarDados(dados) {
    // Implementar lógica específica
    return dados.toUpperCase();
  }
}

module.exports = MinhaTool;
```

### 2. Reiniciar o Servidor

```bash
npm start
```

Sua nova ferramenta estará disponível automaticamente em:
- `POST /api/minha-tool/processar`
- `GET /api/minha-tool/status`

### 3. Métodos Auxiliares da BaseTool

- `log(message, level)` - Logging consistente
- `handleError(res, error, statusCode)` - Tratamento de erros
- `sendSuccess(res, data, message)` - Resposta de sucesso

## 📚 API Reference

### Resposta Padrão de Sucesso

```json
{
  "success": true,
  "message": "Operação realizada com sucesso",
  "data": {
    // dados específicos da operação
  },
  "tool": "nome-da-tool",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Resposta de Erro

```json
{
  "error": "Descrição do erro",
  "tool": "nome-da-tool",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Endpoints do Sistema

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Informações do serviço |
| GET | `/tools` | Lista detalhada das ferramentas |
| GET | `/health` | Health check com métricas |
| GET | `/ping` | Ping simples |

## 🐳 Docker

### Usando Docker Compose

```bash
docker-compose up -d
```

### Build Manual

```bash
docker build -t tools-pipeelo .
docker run -p 8090:8090 tools-pipeelo
```

## 🛠️ Desenvolvimento

### Estrutura do Projeto

```
├── src/
│   ├── server.js          # Servidor principal
│   ├── toolbox.js         # Gerenciador de tools
│   └── tools/             # Diretório das ferramentas
│       ├── base-tool.js   # Classe base
│       ├── extractor.js   # Extrator de boletos
│       ├── text-utils.js  # Utilitários de texto
│       └── README.md      # Documentação das tools
├── server.js              # Entry point
├── package.json           # Dependências
├── Dockerfile            # Container Docker
└── docker-compose.yml    # Orquestração
```

### Scripts Disponíveis

```bash
npm start              # Iniciar servidor
npm run start:cluster  # Iniciar em cluster
npm run start:production # Produção com cluster
```

### Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | 8090 | Porta do servidor |
| `NODE_ENV` | development | Ambiente de execução |

## 🚦 Monitoramento

### Health Check

```bash
curl http://localhost:8090/health
```

Retorna:
- Status do servidor
- Uso de memória
- Uptime
- PID do processo
- Número de tools carregadas

### Logs

O sistema inclui logging automático com timestamps e identificação por ferramenta.

## 🤝 Contribuindo

1. Faça fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-tool`)
3. Implemente sua ferramenta seguindo o padrão das existentes
4. Commit suas mudanças (`git commit -am 'Add nova tool'`)
5. Push para a branch (`git push origin feature/nova-tool`)
6. Crie um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🔗 Links Úteis

- [Documentação das Tools](src/tools/README.md)
- [Exemplos de Uso](examples/)
- [Guia de Contribuição](CONTRIBUTING.md)

---

**Desenvolvido por Andre Tasty** 🚀

Transforme seu projeto em uma toolbox modular e adicione quantas ferramentas precisar!