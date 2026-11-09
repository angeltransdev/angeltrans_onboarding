const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../models/db');
const { runAssetReminders } = require('../utils/assetReminders');

const connectionString = process.env.ASSET_TEST_DATABASE_URL;
test('PostgreSQL asset routes and reminder tracking', { skip: !connectionString }, async () => {
  const url = new URL(connectionString);
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(url.hostname), 'Integration test requires an isolated local database');
  const schema = `asset_test_${Date.now()}`;
  const admin = new Pool({ connectionString });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  const originalQuery = db.query;
  let server;
  try {
    await pool.query(`CREATE TABLE users (id UUID PRIMARY KEY, email TEXT, role TEXT, status TEXT)`);
    await pool.query(fs.readFileSync(path.join(__dirname, '../models/asset_schema.sql'), 'utf8'));
    await pool.query(fs.readFileSync(path.join(__dirname, '../models/asset_schema.sql'), 'utf8'));
    const userId = '00000000-0000-0000-0000-000000000001';
    await pool.query("INSERT INTO users VALUES ($1,'owner@example.test','owner','Active')", [userId]);
    db.query = (...args) => pool.query(...args);
    process.env.JWT_SECRET = 'integration-secret';
    const app = express();
    app.use(express.json());
    app.use('/api/assets', require('../routes/assets'));
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const token = jwt.sign({ id: userId, role: 'owner' }, process.env.JWT_SECRET);
    async function req(route, method = 'GET', body) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/assets${route}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body && JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    }
    const asset = await req('/', 'POST', { name: 'Ambulance', category: 'Vehicle', status: 'In Use', location: 'Base' });
    assert.equal(asset.status, 201);
    const id = asset.data.id;
    const { rows } = await pool.query("SELECT ((NOW() AT TIME ZONE 'America/Los_Angeles')::date + 7)::text AS due");
    const body = { title: 'Insurance', category: 'Insurance', dueDate: rows[0].due, status: 'Open' };
    const record = await req(`/${id}/records`, 'POST', body);
    assert.equal(record.status, 201);
    assert.equal((await req(`/${id}/records`)).data.length, 1);
    const due = await req('/due');
    assert.equal(due.data.length, 1);
    assert.equal(due.data[0].daysUntilDue, 7);
    const messages = [];
    const options = { pool, hrEmail: 'hr@example.test', sendEmail: async email => messages.push(email) };
    assert.equal((await runAssetReminders(options)).sent, 2);
    assert.equal((await runAssetReminders(options)).sent, 0);
    assert.equal(messages.length, 2);
    for (const days of [30, 14, 0]) {
      await pool.query(`UPDATE asset_records SET due_date=(NOW() AT TIME ZONE 'America/Los_Angeles')::date + $1::integer WHERE id=$2`, [days, record.data.id]);
      assert.equal((await runAssetReminders(options)).sent, 2);
      assert.equal((await runAssetReminders(options)).sent, 0);
    }
    const stages = await pool.query('SELECT DISTINCT reminder_days FROM asset_reminder_deliveries ORDER BY reminder_days');
    assert.deepEqual(stages.rows.map(row => row.reminder_days), [0, 7, 14, 30]);
    assert.equal((await req(`/${id}/records/${record.data.id}`, 'PUT', { ...body, status: 'Resolved' })).status, 200);
    assert.equal((await req('/due')).data.length, 0);
    assert.equal((await req(`/${id}`, 'PUT', { ...asset.data, status: 'Retired' })).status, 200);
    assert.equal((await req(`/${id}/records/${record.data.id}`, 'PUT', body)).status, 200);
    assert.equal((await req('/due')).data.length, 0);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    db.query = originalQuery;
    await pool.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
    await db.pool.end();
  }
});