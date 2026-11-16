const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { Pool } = require('pg');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../models/db');

function pdfText(pdf) {
  const parts = [];
  for (const match of pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let stream;
    try { stream = zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString(); }
    catch (err) { if (err.code === 'Z_DATA_ERROR') continue; throw err; }
    for (const text of stream.matchAll(/\[([^\]]+)\] TJ/g)) {
      parts.push([...text[1].matchAll(/<([0-9a-f]+)>/g)].map(hex => Buffer.from(hex[1], 'hex').toString('latin1')).join(''));
    }
  }
  return parts.join('\n');
}

const connectionString = process.env.INVOICE_TEST_DATABASE_URL;
test('invoice lifecycle with isolated PostgreSQL and stubbed email', { skip: !connectionString }, async () => {
  const url = new URL(connectionString);
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(url.hostname), 'Integration test requires an isolated local database');
  const schema = `invoice_test_${Date.now()}`;
  const admin = new Pool({ connectionString });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  const originalQuery = db.query;
  const originalConnect = db.pool.connect;
  const emailPath = require.resolve('../utils/email');
  const oldEmail = require.cache[emailPath];
  const messages = [];
  let failEmail = false;
  let server;
  try {
    await pool.query('CREATE TABLE users (id UUID PRIMARY KEY)');
    await pool.query('CREATE TABLE company_settings (id INTEGER PRIMARY KEY, name TEXT, address TEXT, phone TEXT, email TEXT)');
    await pool.query("INSERT INTO company_settings VALUES (1,'Angel Trans LLC','Company address','555-0000','company@example.test')");
    const userId = '00000000-0000-0000-0000-000000000001';
    await pool.query('INSERT INTO users VALUES ($1)', [userId]);
    const schemaSql = fs.readFileSync(path.join(__dirname, '../models/invoice_schema.sql'), 'utf8');
    await pool.query(schemaSql.split('ALTER TABLE invoices ADD COLUMN')[0]);
    const oldCustomer = await pool.query("INSERT INTO invoice_customers (name,email) VALUES ('Legacy customer','legacy@example.test') RETURNING id");
    const oldInvoice = await pool.query(`INSERT INTO invoices (customer_id,invoice_date,due_date,items,total_cents,created_by)
      VALUES ($1,'2026-11-16','2026-12-16',$2,500,$3) RETURNING id`, [oldCustomer.rows[0].id, JSON.stringify([{ description: 'Legacy', amountCents: 500 }]), userId]);
    await pool.query(schemaSql);
    await pool.query(schemaSql);
    db.query = (...args) => pool.query(...args);
    db.pool.connect = (...args) => pool.connect(...args);
    require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: { sendEmail: async message => {
      if (failEmail) throw new Error('simulated delivery failure');
      messages.push(message);
    } } };
    process.env.JWT_SECRET = 'invoice-integration-secret';
    process.env.CLIENT_URL = 'https://example.test';
    const app = express();
    app.use(express.json());
    app.use('/api/invoices', require('../routes/invoices'));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const token = jwt.sign({ id: userId, role: 'owner' }, process.env.JWT_SECRET);
    const hr = jwt.sign({ id: userId, role: 'hr_admin' }, process.env.JWT_SECRET);
    const employee = jwt.sign({ id: userId, role: 'employee' }, process.env.JWT_SECRET);
    async function req(route, method = 'GET', body, auth = token) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/invoices${route}`, {
        method, headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Content-Type': 'application/json' },
        body: body && JSON.stringify(body),
      });
      if (response.headers.get('content-type')?.includes('application/pdf')) return { status: response.status, pdf: Buffer.from(await response.arrayBuffer()) };
      return { status: response.status, data: await response.json() };
    }
    assert.equal((await req('/', 'GET', null, null)).status, 401);
    assert.equal((await req('/', 'GET', null, employee)).status, 403);
    assert.equal((await req('/', 'GET', null, hr)).status, 200);
    const legacy = await req(`/${oldInvoice.rows[0].id}`);
    assert.equal(legacy.data.totalCents, '500');
    assert.equal(legacy.data.adjustmentCents, '0');
    assert.equal(legacy.data.items[0].amountCents, 500);
    assert.equal((await req(`/${oldInvoice.rows[0].id}`, 'PUT', { ...legacy.data, adjustmentCents: 0 })).status, 200);
    const updatedLegacy = (await req(`/${oldInvoice.rows[0].id}`)).data;
    assert.equal(updatedLegacy.items[0].quantity, 1);
    assert.equal(updatedLegacy.items[0].rateCents, 500);
    assert.equal(updatedLegacy.totalCents, '500');
    assert.equal((await req('/view', 'POST', { token: 'bad' }, null)).status, 404);
    const customer = await req('/customers', 'POST', { name: 'Customer', email: 'customer@example.test', address: 'Old address' });
    assert.equal(customer.status, 201);
    const draft = { customerId: customer.data.id, invoiceDate: '2026-11-16', dueDate: '2026-12-16',
      items: [{ description: 'Trip', serviceDate: '2026-11-15', quantity: 3, rateCents: 12505 }],
      adjustmentCents: -500, orderNumber: 'PO-1', subject: 'Transport', paymentTerms: 'Net 30', termsConditions: 'Terms',
      notes: 'Thank you', paymentInstructions: 'Bank transfer' };
    assert.equal((await req('/', 'POST', { ...draft, dueDate: '2025-01-01' })).status, 400);
    const printDraft = await req('/', 'POST', draft);
    const printId = printDraft.data.id;
    assert.equal((await req(`/${printId}/paid`, 'POST')).status, 400);
    assert.equal((await req(`/${printId}/approve`, 'POST', null, employee)).status, 403);
    assert.equal((await req(`/${printId}/approve`, 'POST')).status, 200);
    assert.equal(messages.length, 0);
    assert.equal((await req(`/${printId}/approve`, 'POST')).status, 400);
    assert.equal((await req(`/${printId}`, 'PUT', draft)).status, 400);
    const approved = (await req(`/${printId}`)).data;
    assert.equal(approved.status, 'Approved');
    assert.deepEqual(approved.activity.map(a => a.event), ['Approved']);
    const approvedPdf = pdfText((await req(`/${printId}/pdf`)).pdf);
    assert.match(approvedPdf, /Invoice #\d+   \|   Approved/);
    assert.doesNotMatch(approvedPdf, /Draft/);
    assert.equal((await req(`/${printId}/paid`, 'POST')).status, 200);
    assert.equal((await req(`/${printId}`)).data.status, 'Paid');
    assert.equal((await req(`/${printId}/approve`, 'POST')).status, 400);
    assert.equal((await req(`/${printId}/return-to-draft`, 'POST')).status, 400);
    assert.equal((await req(`/${printId}`, 'DELETE')).status, 400);

    const reversible = (await req('/', 'POST', draft)).data.id;
    assert.equal((await req(`/${reversible}/return-to-draft`, 'POST')).status, 400);
    assert.equal((await req(`/${reversible}/approve`, 'POST')).status, 200);
    assert.equal((await req(`/${reversible}`, 'DELETE')).status, 400);
    assert.equal((await req(`/${reversible}/return-to-draft`, 'POST', null, employee)).status, 403);
    await req(`/customers/${customer.data.id}`, 'PUT', { name: 'Updated customer', email: 'updated@example.test', address: 'New address' });
    await pool.query("UPDATE company_settings SET name='Updated company' WHERE id=1");
    assert.equal((await req(`/${reversible}/return-to-draft`, 'POST', null, hr)).status, 200);
    const reopened = (await req(`/${reversible}`)).data;
    assert.equal(reopened.status, 'Draft');
    assert.equal(reopened.customer.name, 'Updated customer');
    assert.equal(reopened.company, null);
    assert.deepEqual(reopened.activity.map(a => a.event), ['Returned to draft', 'Approved']);
    assert.equal((await req(`/${reversible}`, 'PUT', draft)).status, 200);
    assert.equal((await req(`/${reversible}/approve`, 'POST')).status, 200);
    const reapproved = (await req(`/${reversible}`)).data;
    assert.equal(reapproved.customer.name, 'Updated customer');
    assert.equal(reapproved.company.name, 'Updated company');
    assert.equal((await req(`/${reversible}/return-to-draft`, 'POST')).status, 200);
    assert.equal((await req(`/${reversible}`, 'DELETE', null, employee)).status, 403);
    assert.equal((await req(`/${reversible}`, 'DELETE', null, hr)).status, 200);
    assert.equal((await req(`/${reversible}`)).status, 404);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM invoice_activity WHERE invoice_id=$1', [reversible])).rows[0].count, 0);
    assert.equal((await req(`/${reversible}`, 'DELETE')).status, 404);
    await req(`/customers/${customer.data.id}`, 'PUT', { name: 'Customer', email: 'customer@example.test', address: 'Old address' });
    await pool.query("UPDATE company_settings SET name='Angel Trans LLC' WHERE id=1");

    const approvedToSend = await req('/', 'POST', draft);
    const approvedToSendId = approvedToSend.data.id;
    assert.equal((await req(`/${approvedToSendId}/approve`, 'POST')).status, 200);
    await req(`/customers/${customer.data.id}`, 'PUT', { name: 'Updated customer', email: 'updated@example.test', address: 'New address' });
    await pool.query("UPDATE company_settings SET name='Updated company' WHERE id=1");
    const frozen = (await req(`/${approvedToSendId}`)).data;
    assert.equal(frozen.customer.name, 'Customer');
    assert.equal(frozen.company.name, 'Angel Trans LLC');
    assert.equal((await req(`/${approvedToSendId}/send`, 'POST')).status, 200);
    assert.equal(messages[0].to, 'customer@example.test');
    assert.match(pdfText(messages[0].attachments[0].content), /Invoice #\d+   \|   Sent/);
    assert.match(pdfText(messages[0].attachments[0].content), /Angel Trans LLC/);
    assert.equal((await req(`/${approvedToSendId}`)).data.status, 'Sent');
    assert.equal((await req(`/${approvedToSendId}`, 'DELETE')).status, 400);
    const sentToken = new URL(messages[0].html.match(/href="([^"]+)"/)[1]).hash.slice(1);
    assert.equal((await req('/view', 'POST', { token: sentToken }, null)).status, 200);
    assert.ok((await req('/')).data.find(i => i.id === approvedToSendId).viewedAt);
    assert.equal((await req(`/${approvedToSendId}/return-to-draft`, 'POST', null, employee)).status, 403);
    assert.equal((await req(`/${approvedToSendId}/return-to-draft`, 'POST', null, hr)).status, 200);
    assert.equal((await req('/view', 'POST', { token: sentToken }, null)).status, 404);
    const returnedSent = (await req(`/${approvedToSendId}`)).data;
    assert.equal(returnedSent.status, 'Draft');
    assert.equal(returnedSent.customer.name, 'Updated customer');
    assert.equal(returnedSent.company, null);
    assert.equal(returnedSent.sentAt, null);
    assert.equal((await req('/')).data.find(i => i.id === approvedToSendId).viewedAt, null);
    assert.deepEqual(returnedSent.activity.map(a => a.event), ['Returned to draft', 'Viewed', 'Sent', 'Approved']);
    assert.equal((await req(`/${approvedToSendId}`, 'PUT', draft)).status, 200);
    assert.equal((await req(`/${approvedToSendId}/send`, 'POST')).status, 200);
    const newSentToken = new URL(messages[1].html.match(/href="([^"]+)"/)[1]).hash.slice(1);
    assert.equal((await req('/view', 'POST', { token: sentToken }, null)).status, 404);
    assert.equal((await req('/')).data.find(i => i.id === approvedToSendId).viewedAt, null);
    assert.equal((await req('/view', 'POST', { token: newSentToken }, null)).status, 200);
    assert.ok((await req('/')).data.find(i => i.id === approvedToSendId).viewedAt);
    assert.equal((await req(`/${approvedToSendId}/return-to-draft`, 'POST')).status, 200);
    assert.equal((await req(`/${approvedToSendId}`, 'DELETE')).status, 200);
    assert.equal((await req('/view', 'POST', { token: newSentToken }, null)).status, 404);
    messages.length = 0;
    await req(`/customers/${customer.data.id}`, 'PUT', { name: 'Customer', email: 'customer@example.test', address: 'Old address' });
    await pool.query("UPDATE company_settings SET name='Angel Trans LLC' WHERE id=1");
    const created = await req('/', 'POST', draft);
    assert.equal(created.status, 201);
    const id = created.data.id;
    const saved = (await req(`/${id}`)).data;
    assert.equal(saved.totalCents, '37015');
    assert.equal(saved.adjustmentCents, '-500');
    assert.equal(saved.orderNumber, 'PO-1');
    assert.equal(saved.items[0].quantity, 3);
    assert.equal(saved.items[0].rateCents, 12505);
    assert.equal(saved.items[0].serviceDate, '2026-11-15');
    assert.equal((await req(`/${id}/pdf`)).pdf.subarray(0, 5).toString(), '%PDF-');
    failEmail = true;
    assert.equal((await req(`/${id}/send`, 'POST')).status, 502);
    assert.equal((await req(`/${id}`)).data.status, 'Draft');
    assert.equal((await req(`/${id}`)).data.activity.length, 0);
    failEmail = false;
    assert.equal((await req(`/${id}/send`, 'POST')).status, 200);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].to, 'customer@example.test');
    assert.equal(messages[0].attachments[0].content.subarray(0, 5).toString(), '%PDF-');
    const sentPdf = pdfText(messages[0].attachments[0].content);
    assert.match(sentPdf, /Invoice #\d+   \|   Sent/);
    assert.doesNotMatch(sentPdf, /Draft/);
    const firstToken = new URL(messages[0].html.match(/href="([^"]+)"/)[1]).hash.slice(1);
    assert.equal((await req(`/${id}`, 'PUT', draft)).status, 400);
    await req(`/customers/${customer.data.id}`, 'PUT', { name: 'Changed', email: 'new@example.test', address: 'New address' });
    const viewed = await req('/view', 'POST', { token: firstToken }, null);
    assert.equal(viewed.status, 200);
    assert.equal(viewed.data.customer.name, 'Customer');
    assert.equal(viewed.data.totalCents, '37015');
    assert.equal(viewed.data.termsConditions, 'Terms');
    assert.equal((await req('/')).data.find(i => i.id === id).viewedAt !== null, true);
    assert.equal((await req(`/${id}/send`, 'POST')).status, 200);
    assert.equal(messages[1].to, 'customer@example.test');
    const secondToken = new URL(messages[1].html.match(/href="([^"]+)"/)[1]).hash.slice(1);
    assert.equal((await req('/view', 'POST', { token: firstToken }, null)).status, 404);
    assert.equal((await req('/')).data.find(i => i.id === id).viewedAt, null);
    assert.equal((await req(`/${id}/paid`, 'POST')).status, 200);
    assert.equal((await req(`/${id}/paid`, 'POST')).status, 400);
    assert.equal((await req(`/${id}/return-to-draft`, 'POST')).status, 400);
    assert.equal((await req('/view', 'POST', { token: secondToken }, null)).data.status, 'Paid');
    assert.deepEqual((await req(`/${id}`)).data.activity.map(a => a.event), ['Viewed', 'Paid', 'Sent', 'Viewed', 'Sent']);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    db.query = originalQuery;
    db.pool.connect = originalConnect;
    if (oldEmail) require.cache[emailPath] = oldEmail; else delete require.cache[emailPath];
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    await db.pool.end();
  }
});
