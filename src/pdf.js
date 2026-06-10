// Assembles cleaned line-art pages into a print-ready A4 PDF colouring book,
// one design per page, centered with margins.

import PDFDocument from 'pdfkit';

/**
 * @param {Array<{buffer: Buffer, prompt: string}>} pages
 * @param {object} [opts]
 * @param {string} [opts.title]
 * @returns {Promise<Buffer>}
 */
export function buildPdf(pages, opts = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, autoFirstPage: false });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title page
    doc.addPage();
    doc.fontSize(30).text(opts.title || 'My Colouring Book', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).fillColor('#666').text(`${pages.length} original designs`, { align: 'center' });
    doc.fillColor('black');

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 36;
    const usableW = pageW - margin * 2;
    const usableH = pageH - margin * 2 - 24; // leave room for caption

    for (const page of pages) {
      doc.addPage();
      const size = Math.min(usableW, usableH);
      const x = (pageW - size) / 2;
      const y = margin;
      doc.image(page.buffer, x, y, { width: size, height: size });
      doc
        .fontSize(9)
        .fillColor('#999')
        .text(truncate(page.prompt, 110), margin, y + size + 8, { width: usableW, align: 'center' });
      doc.fillColor('black');
    }

    doc.end();
  });
}

function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
