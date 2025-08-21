# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modular toolbox service with multiple utility endpoints. The main tool is the boleto extractor that processes PDF files to extract payment information:
- QR codes (typically for PIX payments)
- Linha digitável (47-48 digit payment codes for Brazilian bank slips/boletos)

The system is designed as a toolbox where new tools can be easily added by creating new modules in the `src/tools/` directory.

## Commands

### Development
```bash
# Install dependencies
npm install

# Start the server
npm start
# or
node server.js
```

The server runs on port 8090 by default (configurable via PORT environment variable).

## Architecture

### Core Components

1. **src/server.js** - Main Express server that loads and registers tools
2. **src/toolbox.js** - Toolbox manager that auto-loads tools from `src/tools/` directory
3. **src/tools/** - Directory containing all tool modules

### Main Endpoints

- `GET /` - Service information and available tools
- `GET /tools` - Detailed list of all tools and their endpoints  
- `GET /health` - Health check endpoint
- `POST /api/<tool-name>/<endpoint>` - Tool-specific endpoints

### Available Tools

#### extractor (Boleto Extractor)
- `POST /api/extractor/extract` - Process PDF from URL
- `POST /api/extractor/extract-upload` - Upload PDF file for processing

**Parameters:**
- `page` (default: 1) - Starting page to process
- `tryAllPages` (default: true) - Whether to scan all pages or just specified page
- `prefer` (default: 'auto') - Extraction preference: 'qr', 'linha', or 'auto'

**Response Format:**
- QR code found: `{ page: number, type: 'qr', payload: string }`
- Linha digitável found: `{ page: number, type: 'linha_digitavel', formatted: string, digitsOnly: string }`
- Nothing found: `{ type: 'none', message: string }`

#### text-utils (Text Utilities)
- `POST /api/text-utils/uppercase` - Convert text to uppercase
- `POST /api/text-utils/lowercase` - Convert text to lowercase  
- `POST /api/text-utils/clean-phone` - Clean phone number formatting
- `POST /api/text-utils/format-cpf` - Format CPF with dots and dashes
- `POST /api/text-utils/validate-email` - Validate email format

### Adding New Tools

Create a new file in `src/tools/` that extends `BaseTool`:

```javascript
const BaseTool = require('./base-tool');

class MyTool extends BaseTool {
  constructor() {
    super('my-tool', 'Tool description', '1.0.0');
  }

  getRoutes() {
    return [
      {
        method: 'POST',
        path: '/my-endpoint', 
        handler: this.myHandler.bind(this),
        description: 'Endpoint description'
      }
    ];
  }

  myHandler(req, res) {
    // Implementation
  }
}

module.exports = MyTool;
```

Tools are automatically discovered and loaded on server start.

## Technical Notes

- Uses `@napi-rs/canvas` for cross-platform canvas support without native compilation
- Uses `pdfjs-dist@2.16.105` with worker disabled for Node.js compatibility
- QR code detection uses `jsqr` library with dual-resolution scanning (3.0x and 1.5x scale)
- PDF rendering includes font warnings which are suppressed but don't affect functionality
- Supports both formatted (with dots/spaces) and continuous digit formats for linha digitável
- Successfully extracts PIX QR codes and returns the complete "copia e cola" payload