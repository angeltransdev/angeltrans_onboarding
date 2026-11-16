const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { customer, invoice } = require('../utils/invoiceValidation');
const { invoicePdf } = require('../utils/invoicePdf');

const valid = {
  customerId: '00000000-0000-0000-0000-000000000001',
  invoiceDate: '2026-11-16', dueDate: '2026-12-16',
  items: [{ description: 'Transport', amountCents: 12505 }],
  notes: '', paymentInstructions: '',
};

test('validates customers, dates and integer-cent amounts', () => {
  assert.equal(customer({ name: ' Customer ', email: 'a@example.test' }).name, 'Customer');
  assert.throws(() => customer({ name: 'A', email: 'bad' }));
  assert.equal(invoice(valid).totalCents, 12505);
  assert.throws(() => invoice({ ...valid, invoiceDate: '2026-02-30' }));
  assert.throws(() => invoice({ ...valid, invoiceDate: '0000-01-01' }));
  assert.throws(() => invoice({ ...valid, dueDate: '2026-01-01' }));
  assert.throws(() => invoice({ ...valid, items: [{ description: 'A', amountCents: 0.1 }] }));
  assert.throws(() => invoice({ ...valid, items: [] }));
  assert.throws(() => invoice({ ...valid, items: [{ description: 'A', amountCents: -1 }] }));
});

test('calculates whole-quantity charges and signed adjustments on the server', () => {
  const data = invoice({ ...valid, items: [{ description: 'Transport', serviceDate: '2026-11-15', quantity: 3, rateCents: 12505, amountCents: 1 }],
    adjustmentCents: -500, orderNumber: 'PO-1', subject: 'Services', paymentTerms: 'Net 30', termsConditions: 'Thank you' });
  assert.equal(data.items[0].amountCents, 37515);
  assert.equal(data.totalCents, 37015);
  assert.equal(data.items[0].serviceDate, '2026-11-15');
  assert.equal(data.orderNumber, 'PO-1');
  assert.throws(() => invoice({ ...valid, items: [{ description: 'Trip', quantity: 1.5, rateCents: 100 }] }));
  assert.throws(() => invoice({ ...valid, items: [{ description: 'Trip', quantity: 0, rateCents: 100 }] }));
  assert.throws(() => invoice({ ...valid, items: [{ description: 'Trip', quantity: 1, rateCents: 100, serviceDate: '2026-02-30' }] }));
  assert.throws(() => invoice({ ...valid, adjustmentCents: -12506 }));
  assert.equal(invoice({ ...valid, adjustmentCents: 500 }).totalCents, 13005);
  assert.deepEqual(invoice(valid).items[0], { description: 'Transport', quantity: 1, rateCents: 12505, amountCents: 12505, serviceDate: '' });
});

test('generates a PDF with the item calculations and terms', async () => {
  const data = invoice({ ...valid, items: [{ description: 'Trip', quantity: 3, rateCents: 12505, serviceDate: '2026-11-15' }],
    adjustmentCents: -500, orderNumber: 'PO-1', subject: 'Transport', paymentTerms: 'Net 30', termsConditions: 'Custom terms' });
  const pdf = await invoicePdf({ ...data, number: '42', status: 'Draft',
    customer: { name: 'Customer', email: 'a@example.test' }, company: { name: 'Angel Trans LLC' } });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const parts = [];
  for (const match of pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let stream;
    try { stream = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString(); }
    catch (err) { if (err.code === 'Z_DATA_ERROR') continue; throw err; }
    for (const text of stream.matchAll(/\[([^\]]+)\] TJ/g)) {
      parts.push([...text[1].matchAll(/<([0-9a-f]+)>/g)].map(hex => Buffer.from(hex[1], 'hex').toString('latin1')).join(''));
    }
  }
  const content = parts.join('\n');
  for (const value of ['PO-1', 'Transport', 'Net 30', 'Trip', '2026-11-15', '$125.05', '$375.15', '-$5.00', '$370.15', 'Custom terms']) {
    assert.ok(content.includes(value), `PDF missing ${value}`);
  }
});
