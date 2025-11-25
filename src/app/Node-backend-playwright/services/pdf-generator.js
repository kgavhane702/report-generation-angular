import { chromium } from 'playwright';

/**
 * Generate PDF from HTML using Playwright (Chromium)
 * Mirrors Puppeteer flow but keeps its own process on port 4000.
 * @param {string} html
 * @param {Object} document
 * @returns {Promise<Buffer>}
 */
export async function generatePDF(html, document = {}) {
  let browser;
  let context;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    const viewport = calculateViewport(document);
    context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1
    });

    const page = await context.newPage();
    await page.setContent(html, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm'
      }
    });

    return pdfBuffer;
  } catch (error) {
    console.error('[Playwright] Error in PDF generation:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

function calculateViewport(document) {
  const pageSize = document.pageSize || {};
  const baseWidthMm = pageSize.widthMm || 254;
  const baseHeightMm = pageSize.heightMm || 190.5;
  const dpi = pageSize.dpi || 96;

  let maxWidthMm = baseWidthMm;
  let maxHeightMm = baseHeightMm;

  const sections = document.sections || [];
  for (const section of sections) {
    const subsections = section?.subsections || [];
    for (const subsection of subsections) {
      const pages = subsection?.pages || [];
      for (const page of pages) {
        const orientation = page?.orientation || 'landscape';
        let pageWidth;
        let pageHeight;
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

  return {
    width: Math.round((maxWidthMm / 25.4) * dpi),
    height: Math.round((maxHeightMm / 25.4) * dpi)
  };
}

