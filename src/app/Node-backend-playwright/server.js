import express from 'express';
import cors from 'cors';
import { renderDocumentToHTML } from '../Node-backend/services/html-renderer.js';
import { generatePDF } from './services/pdf-generator.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Playwright PDF Generation Service is running' });
});

app.post('/api/generate-pdf', async (req, res) => {
  try {
    const { document } = req.body;

    if (!document) {
      return res.status(400).json({
        error: 'Document data is required',
        message: 'Please provide a document object in the request body'
      });
    }

    console.log('[Playwright] Generating PDF for document:', document.title || 'Untitled');

    const html = await renderDocumentToHTML(document);
    const pdfBuffer = await generatePDF(html, document);

    const filename = `${(document.title || 'document').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
    console.log('[Playwright] PDF generated successfully:', filename);
  } catch (error) {
    console.error('[Playwright] Error generating PDF:', error);
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Playwright PDF Server running on http://localhost:${PORT}`);
  console.log(`📄 Health check: http://localhost:${PORT}/health`);
  console.log(`📦 PDF endpoint: POST http://localhost:${PORT}/api/generate-pdf`);
});

