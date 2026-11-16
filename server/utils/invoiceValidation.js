const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function text(value, label, max, required = false) {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new Error(`${label} must ${required ? 'not be empty and ' : ''}be at most ${max} characters.`);
  return result;
}

function customer(body) {
  const name = text(body.name, 'Name', 255, true);
  const email = text(body.email, 'Email', 255, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  return { name, email, address: text(body.address || '', 'Address', 2000), phone: text(body.phone || '', 'Phone', 100) };
}

function date(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) throw new Error(`${label} must be a valid date.`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${label} must be a valid date.`);
  return value;
}

function invoice(body) {
  if (!uuid(body.customerId)) throw new Error('Select a customer.');
  const invoiceDate = date(body.invoiceDate, 'Invoice date');
  const dueDate = date(body.dueDate, 'Due date');
  if (dueDate < invoiceDate) throw new Error('Due date cannot be before invoice date.');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 100) throw new Error('Enter between 1 and 100 charges.');
  const items = body.items.map(item => {
    const description = text(item.description, 'Description', 500, true);
    const quantity = item.quantity === undefined ? 1 : item.quantity;
    const rateCents = item.rateCents === undefined ? item.amountCents : item.rateCents;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) throw new Error('Quantity must be a whole number between 1 and 1,000,000.');
    if (!Number.isSafeInteger(rateCents) || rateCents < 0 || rateCents > 10000000000) throw new Error('Enter a valid rate.');
    const amountCents = quantity * rateCents;
    if (!Number.isSafeInteger(amountCents) || amountCents > 1000000000000) throw new Error('A charge cannot exceed $10,000,000,000.');
    const serviceDate = item.serviceDate ? date(item.serviceDate, 'Service date') : '';
    return { description, quantity, rateCents, amountCents, serviceDate };
  });
  const subtotalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
  const adjustmentCents = body.adjustmentCents === undefined ? 0 : body.adjustmentCents;
  if (!Number.isSafeInteger(adjustmentCents) || Math.abs(adjustmentCents) > 1000000000000) throw new Error('Enter a valid adjustment.');
  const totalCents = subtotalCents + adjustmentCents;
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 1000000000000 || totalCents < 0 || totalCents > 1000000000000) throw new Error('Subtotal and total must be between $0 and $10,000,000,000.');
  return { customerId: body.customerId, invoiceDate, dueDate, items,
    totalCents, adjustmentCents,
    orderNumber: text(body.orderNumber || '', 'Order number', 255),
    subject: text(body.subject || '', 'Subject', 500),
    paymentTerms: text(body.paymentTerms || '', 'Payment terms', 100),
    termsConditions: text(body.termsConditions || '', 'Terms and conditions', 4000),
    notes: text(body.notes || '', 'Notes', 4000), paymentInstructions: text(body.paymentInstructions || '', 'Payment instructions', 4000) };
}

module.exports = { customer, invoice, uuid };
