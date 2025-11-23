import express from 'express';
import cors from 'cors';
import { generatePDF } from './services/pdf-generator.js';
import { renderDocumentToHTML } from './services/html-renderer.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'PDF Generation Service is running' });
});

// PDF Generation endpoint
app.post('/api/generate-pdf', async (req, res) => {
  try {
    const { document } = req.body;

    if (!document) {
      return res.status(400).json({ 
        error: 'Document data is required',
        message: 'Please provide a document object in the request body'
      });
    }

    console.log('Generating PDF for document:', document.title || 'Untitled');

    // Convert document to HTML
    const html = await renderDocumentToHTML(document);

    // Generate PDF from HTML
    const pdfBuffer = await generatePDF(html, document);

    // Set response headers
    const filename = `${(document.title || 'document').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

    console.log('PDF generated successfully:', filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PDF Generation Server running on http://localhost:${PORT}`);
  console.log(`📄 Health check: http://localhost:${PORT}/health`);
  console.log(`📦 PDF endpoint: POST http://localhost:${PORT}/api/generate-pdf`);
});

