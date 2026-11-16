const PDFDocument = require('pdfkit');

const money = cents => `${Number(cents) < 0 ? '-' : ''}$${(Math.abs(Number(cents)) / 100).toFixed(2)}`;

function invoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const company = invoice.company || {};
    const customer = invoice.customer || {};
    const items = invoice.items;
    const subtotal = items.reduce((sum, item) => sum + Number(item.amountCents), 0);
    const adjustment = Number(invoice.adjustmentCents || 0);
    doc.fillColor('#9e0000').font('Helvetica-Bold').fontSize(20).text(company.name || 'Angel Trans LLC');
    doc.fillColor('#475569').font('Helvetica').fontSize(9).text([company.address, company.phone, company.email].filter(Boolean).join('\n'));
    doc.moveDown().fillColor('#17212b').font('Helvetica-Bold').fontSize(23).text('INVOICE');
    doc.fontSize(10).font('Helvetica').text(`Invoice #${invoice.number}   |   ${invoice.status}`);
    doc.moveDown().font('Helvetica-Bold').text('BILL TO').font('Helvetica')
      .text([customer.name, customer.address, customer.email].filter(Boolean).join('\n'));
    doc.moveDown().text(`Invoice date: ${invoice.invoiceDate}    Due date: ${invoice.dueDate}`);
    if (invoice.orderNumber) doc.text(`Order number: ${invoice.orderNumber}`);
    if (invoice.paymentTerms) doc.text(`Payment terms: ${invoice.paymentTerms}`);
    if (invoice.subject) doc.moveDown(0.5).text(`Subject: ${invoice.subject}`);
    doc.moveDown();

    const tableHeader = () => {
      const y = doc.y;
      doc.rect(50, y, 512, 24).fill('#f1f5f9');
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8);
      doc.text('DESCRIPTION / SERVICE DATE', 58, y + 8, { width: 250, lineBreak: false });
      doc.text('QTY', 315, y + 8, { width: 38, align: 'right', lineBreak: false });
      doc.text('RATE', 359, y + 8, { width: 84, align: 'right', lineBreak: false });
      doc.text('AMOUNT', 448, y + 8, { width: 106, align: 'right', lineBreak: false });
      doc.y = y + 30;
    };
    if (doc.y > 650) doc.addPage();
    tableHeader();
    for (const item of items) {
      const description = item.serviceDate ? `${item.description}\nService date: ${item.serviceDate}` : item.description;
      doc.font('Helvetica').fontSize(9);
      const height = Math.max(22, doc.heightOfString(description, { width: 245 }) + 12);
      if (doc.y + height > doc.page.height - 60) { doc.addPage(); tableHeader(); }
      const y = doc.y;
      doc.fillColor('#17212b').text(description, 58, y + 4, { width: 245 });
      doc.text(String(item.quantity ?? 1), 315, y + 4, { width: 38, align: 'right', lineBreak: false });
      doc.text(money(item.rateCents ?? item.amountCents), 359, y + 4, { width: 84, align: 'right', lineBreak: false });
      doc.text(money(item.amountCents), 448, y + 4, { width: 106, align: 'right', lineBreak: false });
      doc.moveTo(50, y + height).lineTo(562, y + height).strokeColor('#e2e8f0').stroke();
      doc.y = y + height + 3;
    }
    if (doc.y > doc.page.height - 160) doc.addPage();
    doc.x = 50;
    doc.moveDown().fontSize(10).font('Helvetica').text(`Subtotal: ${money(subtotal)}`, { align: 'right' });
    if (adjustment) doc.text(`Adjustment: ${money(adjustment)}`, { align: 'right' });
    doc.moveDown(0.3).font('Helvetica-Bold').fontSize(14).text(`Total: ${money(invoice.totalCents)}`, { align: 'right' });
    const section = (label, value) => {
      if (!value) return;
      doc.moveDown().fillColor('#17212b').font('Helvetica-Bold').fontSize(10).text(label)
        .font('Helvetica').fontSize(9).text(value);
    };
    section('Payment instructions', invoice.paymentInstructions);
    section('Customer notes', invoice.notes);
    section('Terms and conditions', invoice.termsConditions);
    doc.end();
  });
}

module.exports = { invoicePdf };
