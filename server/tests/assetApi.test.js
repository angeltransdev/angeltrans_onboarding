const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const originalQuery = db.query;
const secret = 'asset-test-secret';
process.env.JWT_SECRET = secret;
const router = require('../routes/assets');
const app = express();
app.use(express.json());
app.use('/api/assets', router);
const server = app.listen(0, '127.0.0.1');
after(() => { db.query = originalQuery; server.close(); db.pool.end(); });

async function request(path, { role = 'hr_admin', method = 'GET', body, token = true } = {}) {
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  const headers = {};
  if (token) headers.Authorization = `Bearer ${jwt.sign({ id: '00000000-0000-0000-0000-000000000001', role }, secret)}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/assets${path}`, { method, headers, body: body && JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}

test('asset routes require HR authorization', async () => {
  assert.equal((await request('/', { token: false })).status, 401);
  assert.equal((await request('/', { role: 'employee' })).status, 403);
  db.query = async () => ({ rows: [] });
  assert.equal((await request('/', { role: 'owner' })).status, 200);
});

test('validates inputs and surfaces database failures', async () => {
  assert.equal((await request('/', { method: 'POST', body: { name: '', category: 'Vehicle', status: 'Available' } })).status, 400);
  assert.equal((await request('/invalid/records')).status, 400);
  db.query = async () => { throw new Error('test database failure'); };
  assert.equal((await request('/')).status, 500);
});

test('creates a record for an existing asset and returns 404 for a missing asset', async () => {
  const id = '00000000-0000-0000-0000-000000000001';
  const body = { title: 'Inspection', category: 'Inspection', dueDate: '2027-04-15', status: 'Open' };
  db.query = async (sql, params) => { assert.equal(params[0], id); assert.match(sql, /INSERT INTO asset_records/); return { rows: [{ id, assetId: id, ...body }] }; };
  const response = await request(`/${id}/records`, { method: 'POST', body });
  assert.equal(response.status, 201);
  assert.equal(response.data.title, 'Inspection');
  db.query = async () => ({ rows: [] });
  assert.equal((await request(`/${id}/records`, { method: 'POST', body })).status, 404);
});