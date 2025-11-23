# Report PDF Generation Backend

Node.js backend service for converting exported report documents to PDF format with exact visual rendering.

## Features

- ✅ Converts JSON document exports to high-quality PDFs
- ✅ Exact visual rendering using Puppeteer (Chromium)
- ✅ Supports all widget types (text, tables, images, charts)
- ✅ Handles page orientation (portrait/landscape)
- ✅ Preserves table styling, icons, and formatting
- ✅ Multiple pages support
- ✅ RESTful API endpoint

## Installation

```bash
cd src/app/Node-backend
npm install
```

## Usage

### Start the server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### API Endpoints

#### Health Check
```
GET /health
```

#### Generate PDF
```
POST /api/generate-pdf
Content-Type: application/json

Body:
{
  "document": {
    "id": "...",
    "title": "My Report",
    "version": "1.0.0",
    "pageSize": {
      "widthMm": 254,
      "heightMm": 190.5,
      "dpi": 96
    },
    "sections": [...]
  }
}
```

Response: PDF file (binary)

### Example Usage from Angular

```typescript
import { HttpClient } from '@angular/common/http';

export class PdfService {
  constructor(private http: HttpClient) {}

  async generatePDF(document: DocumentModel): Promise<Blob> {
    const response = await this.http.post(
      'http://localhost:3000/api/generate-pdf',
      { document },
      { responseType: 'blob' }
    ).toPromise();
    
    return response;
  }

  async downloadPDF(document: DocumentModel): Promise<void> {
    const pdfBlob = await this.generatePDF(document);
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${document.title || 'document'}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}
```

## Dependencies

- **express**: Web server framework
- **puppeteer**: Headless Chrome for PDF generation
- **cors**: Cross-origin resource sharing
- **multer**: File upload handling (if needed)

## Architecture

- `server.js`: Main Express server and routes
- `services/pdf-generator.js`: PDF generation using Puppeteer
- `services/html-renderer.js`: Converts document JSON to HTML

## Notes

- Puppeteer requires Chromium to be downloaded on first install
- For production, consider using a Docker container or serverless function
- PDF quality matches the visual appearance in the editor exactly

