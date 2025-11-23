import puppeteer from 'puppeteer';

/**
 * Generate PDF from HTML using Puppeteer
 * Supports per-page orientation and exact positioning
 * @param {string} html - HTML content to convert to PDF
 * @param {Object} document - Document model with page size information
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generatePDF(html, document) {
  let browser = null;

  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Get base page size from document
    const pageSize = document.pageSize || {};
    const baseWidthMm = pageSize.widthMm || 254; // Default: 10 inches
    const baseHeightMm = pageSize.heightMm || 190.5; // Default: 7.5 inches
    const dpi = pageSize.dpi || 96;

    // Calculate max dimensions for viewport (to handle all pages)
    let maxWidthMm = baseWidthMm;
    let maxHeightMm = baseHeightMm;

    // Check all pages for orientation to determine max viewport size
    if (document.sections && Array.isArray(document.sections)) {
      for (const section of document.sections) {
        if (section.subsections && Array.isArray(section.subsections)) {
          for (const subsection of section.subsections) {
            if (subsection.pages && Array.isArray(subsection.pages)) {
              for (const pageModel of subsection.pages) {
                const orientation = pageModel.orientation || 'landscape';
                let pageWidth, pageHeight;
                
                if (orientation === 'portrait') {
                  pageWidth = Math.min(baseWidthMm, baseHeightMm);
                  pageHeight = Math.max(baseWidthMm, baseHeightMm);
                } else {
                  pageWidth = Math.max(baseWidthMm, baseHeightMm);
                  pageHeight = Math.min(baseWidthMm, baseHeightMm);
                }
                
                maxWidthMm = Math.max(maxWidthMm, pageWidth);
                maxHeightMm = Math.max(maxHeightMm, pageHeight);
              }
            }
          }
        }
      }
    }

    // Convert mm to pixels for viewport
    const widthPx = (maxWidthMm / 25.4) * dpi;
    const heightPx = (maxHeightMm / 25.4) * dpi;

    // Set viewport to accommodate largest page
    await page.setViewport({
      width: Math.round(widthPx),
      height: Math.round(heightPx),
      deviceScaleFactor: 1
    });

    // Set content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Generate PDF with format that respects CSS page sizes
    // This allows each page to have its own size/orientation
    const pdfBuffer = await page.pdf({
      format: 'A4', // This will be overridden by CSS page sizes
      printBackground: true,
      preferCSSPageSize: true, // Critical: use CSS page sizes from HTML
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    });

    return pdfBuffer;
  } catch (error) {
    console.error('Error in PDF generation:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

