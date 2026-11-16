const router = require('express').Router();
const crypto = require('crypto');
const db = require('../models/db');
const { authenticate, requireHR } = require('../middleware/auth');
const validation = require('../utils/invoiceValidation');
const { invoicePdf } = require('../utils/invoicePdf');
const { sendEmail } = require('../utils/email');

const columns = `i.id, i.number::text, i.customer_id AS "customerId",
  i.invoice_date::text AS "invoiceDate", i.due_date::text AS "dueDate",
  i.items, i.notes, i.payment_instructions AS "paymentInstructions",
  i.order_number AS "orderNumber", i.subject, i.payment_terms AS "paymentTerms",
  i.terms_conditions AS "termsConditions", i.adjustment_cents::text AS "adjustmentCents",
  i.total_cents::text AS "totalCents", i.status, i.sent_at AS "sentAt", i.paid_at AS "paidAt",
  COALESCE(i.customer_snapshot, jsonb_build_object('name', c.name, 'email', c.email, 'address', c.address, 'phone', c.phone)) AS customer,
  i.company_snapshot AS company`;
const queryInvoice = `SELECT ${columns} FROM invoices i JOIN invoice_customers c ON c.id=i.customer_id`;
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

async function company(query) {
  const { rows } = await query('SELECT name, address, phone, email FROM company_settings WHERE id=1');
  if (!rows.length) throw new Error('Company settings must be configured before generating an invoice.');
  return rows[0];
}

function parse(validator, body, res) {
  try { return validator(body || {}); }
  catch (err) { res.status(400).json({ message: err.message }); return null; }
}

// A deliberate click, rather than loading an email image or link, records a view.
router.post('/view', asyncRoute(async (req, res) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(404).json({ message: 'Invoice link is invalid or no longer available.' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`${queryInvoice} WHERE i.view_token_hash=$1 AND i.status IN ('Sent','Paid')`, [hash(token)]);
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Invoice link is invalid or no longer available.' });
    }
    await client.query("INSERT INTO invoice_activity (invoice_id, event) VALUES ($1,'Viewed')", [result.rows[0].id]);
    await client.query('COMMIT');
    res.set('Cache-Control', 'no-store').json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}));

router.use(authenticate, requireHR);
router.param('id', (req, res, next, value) => {
  if (!validation.uuid(value)) return res.status(400).json({ message: 'Invalid ID.' });
  next();
});

router.get('/customers', asyncRoute(async (req, res) => {
  const { rows } = await db.query('SELECT id, name, email, address, phone FROM invoice_customers ORDER BY name, id');
  res.json(rows);
}));
router.post('/customers', asyncRoute(async (req, res) => {
  const c = parse(validation.customer, req.body, res); if (!c) return;
  const { rows } = await db.query('INSERT INTO invoice_customers (name,email,address,phone) VALUES ($1,$2,$3,$4) RETURNING id,name,email,address,phone', [c.name, c.email, c.address, c.phone]);
  res.status(201).json(rows[0]);
}));
router.put('/customers/:id', asyncRoute(async (req, res) => {
  const c = parse(validation.customer, req.body, res); if (!c) return;
  const { rows } = await db.query('UPDATE invoice_customers SET name=$1,email=$2,address=$3,phone=$4,updated_at=NOW() WHERE id=$5 RETURNING id,name,email,address,phone', [c.name, c.email, c.address, c.phone, req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Customer not found.' });
  res.json(rows[0]);
}));
router.get('/', asyncRoute(async (req, res) => {
  const { rows } = await db.query(`SELECT ${columns}, (SELECT MAX(created_at) FROM invoice_activity WHERE invoice_id=i.id AND event='Viewed') AS "viewedAt"
    FROM invoices i JOIN invoice_customers c ON c.id=i.customer_id ORDER BY i.created_at DESC`);
  res.json(rows);
}));
router.post('/', asyncRoute(async (req, res) => {
  const i = parse(validation.invoice, req.body, res); if (!i) return;
  const { rows } = await db.query(`INSERT INTO invoices (customer_id,invoice_date,due_date,items,notes,payment_instructions,total_cents,created_by,order_number,subject,payment_terms,terms_conditions,adjustment_cents)
    SELECT id,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13 FROM invoice_customers WHERE id=$1 RETURNING id`,
  [i.customerId, i.invoiceDate, i.dueDate, JSON.stringify(i.items), i.notes, i.paymentInstructions, i.totalCents, req.user.id,
    i.orderNumber, i.subject, i.paymentTerms, i.termsConditions, i.adjustmentCents]);
  if (!rows.length) return res.status(404).json({ message: 'Customer not found.' });
  res.status(201).json(rows[0]);
}));
router.put('/:id', asyncRoute(async (req, res) => {
  const i = parse(validation.invoice, req.body, res); if (!i) return;
  const { rows } = await db.query(`UPDATE invoices SET customer_id=$1,invoice_date=$2,due_date=$3,items=$4,notes=$5,payment_instructions=$6,total_cents=$7,
    order_number=$8,subject=$9,payment_terms=$10,terms_conditions=$11,adjustment_cents=$12,updated_at=NOW()
    WHERE id=$13 AND status='Draft' AND EXISTS (SELECT 1 FROM invoice_customers WHERE id=$1) RETURNING id`,
  [i.customerId, i.invoiceDate, i.dueDate, JSON.stringify(i.items), i.notes, i.paymentInstructions, i.totalCents,
    i.orderNumber, i.subject, i.paymentTerms, i.termsConditions, i.adjustmentCents, req.params.id]);
  if (!rows.length) return res.status(400).json({ message: 'Invoice must be a draft and the customer must exist.' });
  res.json(rows[0]);
}));
router.get('/:id', asyncRoute(async (req, res) => {
  const { rows } = await db.query(`${queryInvoice} WHERE i.id=$1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Invoice not found.' });
  const activity = await db.query('SELECT event, created_at AS "createdAt" FROM invoice_activity WHERE invoice_id=$1 ORDER BY created_at DESC, id DESC', [req.params.id]);
  res.json({ ...rows[0], activity: activity.rows });
}));
router.get('/:id/pdf', asyncRoute(async (req, res) => {
  const { rows } = await db.query(`${queryInvoice} WHERE i.id=$1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Invoice not found.' });
  const invoice = rows[0];
  if (!invoice.company) invoice.company = await company(db.query);
  const pdf = await invoicePdf(invoice);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="invoice-${invoice.number}.pdf"`, 'Cache-Control': 'no-store' }).send(pdf);
}));
router.post('/:id/send', asyncRoute(async (req, res) => {
  const client = await db.pool.connect();
  let emailSent = false;
  let emailAttempted = false;
  try {
    await client.query('BEGIN');
    const result = await client.query(`${queryInvoice} WHERE i.id=$1 FOR UPDATE OF i`, [req.params.id]);
    const invoice = result.rows[0];
    if (!invoice) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Invoice not found.' }); }
    if (invoice.status === 'Paid') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Paid invoices cannot be sent.' }); }
    if (!process.env.CLIENT_URL) throw new Error('CLIENT_URL must be configured to send invoice links.');
    const url = new URL('/invoice/view', process.env.CLIENT_URL);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('CLIENT_URL must use HTTPS.');
    const token = crypto.randomBytes(32).toString('hex');
    url.hash = token;
    if (!invoice.company) invoice.company = await company(client.query.bind(client));
    const pdf = await invoicePdf(invoice);
    await client.query(`UPDATE invoices SET customer_snapshot=$1,company_snapshot=$2,view_token_hash=$3,status='Sent',sent_at=NOW(),updated_at=NOW() WHERE id=$4`,
      [JSON.stringify(invoice.customer), JSON.stringify(invoice.company), hash(token), invoice.id]);
    await client.query("INSERT INTO invoice_activity (invoice_id,event,actor_id) VALUES ($1,'Sent',$2)", [invoice.id, req.user.id]);
    emailAttempted = true;
    await sendEmail({ to: invoice.customer.email, subject: `Invoice #${invoice.number} from ${invoice.company.name}`,
      html: `<p>Please find your invoice attached.</p><p><a href="${escapeHtml(url.toString())}">View your invoice securely</a></p>`,
      attachments: [{ filename: `invoice-${invoice.number}.pdf`, content: pdf }] });
    emailSent = true;
    await client.query('COMMIT');
    res.json({ message: 'Invoice sent.' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (emailSent) console.error('Invoice email sent but database commit failed; delivery status needs reconciliation:', req.params.id, err);
    if (emailAttempted) {
      console.error('Invoice delivery could not be confirmed:', req.params.id, err);
      return res.status(502).json({ message: 'Delivery could not be confirmed. The customer may have received an email with an invalid link; check with them before sending again.' });
    }
    throw err;
  } finally { client.release(); }
}));
router.post('/:id/paid', asyncRoute(async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query("UPDATE invoices SET status='Paid',paid_at=NOW(),updated_at=NOW() WHERE id=$1 AND status='Sent' RETURNING id", [req.params.id]);
    if (!result.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Only sent invoices can be marked paid.' }); }
    await client.query("INSERT INTO invoice_activity (invoice_id,event,actor_id) VALUES ($1,'Paid',$2)", [req.params.id, req.user.id]);
    await client.query('COMMIT');
    res.json({ message: 'Invoice marked paid.' });
  } catch (err) { await client.query('ROLLBACK'); throw err; }
  finally { client.release(); }
}));
router.use((err, req, res, next) => {
  console.error('Invoice request failed:', err);
  res.status(500).json({ message: 'Invoice request failed. Please try again or contact an administrator.' });
});

module.exports = router;
