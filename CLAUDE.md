# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a boleto extractor service that processes PDF files to extract payment information. It can extract:
- QR codes (typically for PIX payments)
- Linha digitável (47-48 digit payment codes for Brazilian bank slips/boletos)

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

The server runs on port 3000 by default (configurable via PORT environment variable).

## Architecture

### Core Components

1. **server.js** - Main Express server with two endpoints:
   - `/extract` - Accepts PDF URL and downloads it for processing
   - `/extract-upload` - Accepts PDF file upload via multipart form-data

2. **PDF Processing Pipeline**:
   - Uses `pdfjs-dist` (legacy build for Node.js compatibility) to parse PDFs
   - Renders pages to canvas using `node-canvas`
   - Extracts text content directly from PDF structure
   - Scans rendered images for QR codes using `jsqr`

3. **Data Extraction Logic**:
   - `extractLinhaDigitavel()` - Extracts 47/48 digit payment codes from text using regex patterns
   - `renderPageImageData()` - Renders PDF page to image and extracts text content
   - `processPdfBuffer()` - Main processing function that attempts both QR and text extraction

### Processing Options

Both endpoints accept these parameters:
- `page` (default: 1) - Starting page to process
- `tryAllPages` (default: true) - Whether to scan all pages or just specified page
- `prefer` (default: 'auto') - Extraction preference:
  - 'qr' - Only try QR code extraction
  - 'linha' - Only try linha digitável extraction
  - 'auto' - Try both methods

### Response Format

Returns JSON with extraction results:
- QR code found: `{ page: number, type: 'qr', payload: string }`
- Linha digitável found: `{ page: number, type: 'linha_digitavel', formatted: string, digitsOnly: string }`
- Nothing found: `{ type: 'none', message: string }`

## Technical Notes

- Uses `@napi-rs/canvas` for cross-platform canvas support without native compilation
- Uses `pdfjs-dist@2.16.105` with worker disabled for Node.js compatibility
- QR code detection uses `jsqr` library with dual-resolution scanning (3.0x and 1.5x scale)
- PDF rendering includes font warnings which are suppressed but don't affect functionality
- Supports both formatted (with dots/spaces) and continuous digit formats for linha digitável
- Successfully extracts PIX QR codes and returns the complete "copia e cola" payload