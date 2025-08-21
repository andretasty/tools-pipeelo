# Tools Directory

Este diretório contém todas as ferramentas (tools) disponíveis no toolbox.

## Como Criar uma Nova Tool

1. **Crie um novo arquivo** no diretório `src/tools/` com nome descritivo (ex: `my-tool.js`)

2. **Importe e estenda a classe BaseTool:**

```javascript
const BaseTool = require('./base-tool');

class MyTool extends BaseTool {
  constructor() {
    super('my-tool', 'Descrição da minha ferramenta', '1.0.0');
  }

  getRoutes() {
    return [
      {
        method: 'POST', // GET, POST, PUT, DELETE
        path: '/my-endpoint',
        handler: this.myHandler.bind(this),
        description: 'Descrição do endpoint'
      }
    ];
  }

  myHandler(req, res) {
    try {
      // Sua lógica aqui
      const { data } = req.body;
      
      // Para retornar sucesso:
      this.sendSuccess(res, { result: 'algum resultado' }, 'Operação realizada');
      
      // Para tratar erros:
      // this.handleError(res, error, 400);
    } catch (error) {
      this.handleError(res, error);
    }
  }
}

module.exports = MyTool;
```

3. **Reinicie o servidor** - A ferramenta será carregada automaticamente!

## Estrutura de uma Tool

### Propriedades Obrigatórias
- `name`: Nome único da ferramenta (usado na URL)
- `description`: Descrição do que a ferramenta faz
- `version`: Versão da ferramenta

### Métodos Obrigatórios
- `getRoutes()`: Retorna array com as rotas da ferramenta

### Métodos Auxiliares (da BaseTool)
- `log(message, level)`: Para logging
- `handleError(res, error, statusCode)`: Para tratar erros
- `sendSuccess(res, data, message)`: Para respostas de sucesso

## Exemplo de Endpoints

Depois de criar uma ferramenta chamada `my-tool` com endpoint `/my-endpoint`, ela ficará disponível em:

```
POST /api/my-tool/my-endpoint
```

## Tools Disponíveis

### extractor
- **Descrição**: Extração de QR codes e linha digitável de PDFs de boletos
- **Endpoints**:
  - `POST /api/extractor/extract` - Extrai dados de PDF via URL
  - `POST /api/extractor/extract-upload` - Extrai dados de PDF via upload

### text-utils
- **Descrição**: Utilitários para manipulação de texto
- **Endpoints**:
  - `POST /api/text-utils/uppercase` - Converte texto para maiúsculas
  - `POST /api/text-utils/lowercase` - Converte texto para minúsculas
  - `POST /api/text-utils/clean-phone` - Remove formatação de números de telefone
  - `POST /api/text-utils/format-cpf` - Formata CPF com pontos e traços
  - `POST /api/text-utils/validate-email` - Valida formato de email

## Middlewares

Para tools que precisam de middlewares (como upload de arquivos), use array no handler:

```javascript
getRoutes() {
  return [
    {
      method: 'POST',
      path: '/upload',
      handler: [this.upload.single('file'), this.processUpload.bind(this)],
      description: 'Upload e processamento'
    }
  ];
}
```