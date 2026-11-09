const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateAsset, validateRecord, validDate } = require('../utils/assetValidation');
const { reminderStage, runAssetReminders } = require('../utils/assetReminders');

const asset = { name: 'Medic 1', category: 'Vehicle', status: 'In Use' };
const record = { title: 'Insurance', category: 'Insurance', status: 'Open', dueDate: '2027-02-28' };

test('validates required fields, categories and dates', () => {
  assert.equal(validateAsset(asset).name, 'Medic 1');
  assert.throws(() => validateAsset({ ...asset, name: '  ' }), /required/);
  assert.throws(() => validateAsset({ ...asset, status: 'Unknown' }), /Invalid/);
  assert.equal(validDate('2028-02-29'), true);
  assert.equal(validDate('2027-02-29'), false);
  assert.equal(validDate('0000-01-01'), false);
  assert.throws(() => validateRecord({ ...record, dueDate: '2027-02-29' }), /valid due date/);
});

test('accepts only HTTPS Google Drive and Docs document links', () => {
  assert.equal(validateRecord({ ...record, documentUrl: 'https://drive.google.com/file/d/123' }).documentUrl, 'https://drive.google.com/file/d/123');
  assert.equal(validateRecord({ ...record, documentUrl: 'https://docs.google.com/document/d/123' }).documentUrl, 'https://docs.google.com/document/d/123');
  for (const url of ['javascript:alert(1)', 'https://drive.google.com.evil.test/file', 'http://drive.google.com/file', 'https://x@drive.google.com/file']) {
    assert.throws(() => validateRecord({ ...record, documentUrl: url }), /Google Drive/);
  }
});

test('reminder stages use 30, 14, 7 and due day with catch-up', () => {
  for (const [days, stage] of [[31, null], [30, 30], [15, 30], [14, 14], [8, 14], [7, 7], [1, 7], [0, 0], [-4, 0]]) {
    assert.equal(reminderStage(days), stage, `days=${days}`);
  }
});

function fakePool(days = 30) {
  const deliveries = new Set();
  let released = 0;
  const client = {
    async query(sql, params = []) {
      if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ locked: true }] };
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('FROM users')) return { rows: [{ email: 'owner@example.test' }, { email: 'HR@example.test' }] };
      if (sql.includes('FROM asset_records r')) return { rows: [{ id: '123', title: '<Inspection>', asset_name: 'Vehicle & 1', due_date: '2027-01-30', days_until_due: days }] };
      if (sql.includes('SELECT 1 FROM asset_reminder_deliveries')) return { rows: deliveries.has(params.join('|')) ? [{}] : [] };
      if (sql.includes('INSERT INTO asset_reminder_deliveries')) { deliveries.add(params.join('|')); return { rows: [] }; }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() { released++; },
  };
  return { pool: { connect: async () => client }, deliveries, get released() { return released; } };
}

test('sends once per stage and recipient, deduplicates HR/owner, and escapes HTML', async () => {
  const fake = fakePool();
  const messages = [];
  const options = { pool: fake.pool, hrEmail: 'hr@example.test', sendEmail: async email => messages.push(email) };
  assert.equal((await runAssetReminders(options)).sent, 2);
  assert.equal((await runAssetReminders(options)).sent, 0);
  assert.equal(messages.length, 2);
  assert.match(messages[0].html, /&lt;Inspection&gt;/);
  assert.match(messages[0].html, /Vehicle &amp; 1/);
  assert.equal(fake.released, 4);
});

test('records successes and retries failed recipients', async () => {
  const fake = fakePool(7);
  let fail = true;
  const sent = [];
  const options = { pool: fake.pool, hrEmail: 'hr@example.test', sendEmail: async email => {
    if (email.to === 'owner@example.test' && fail) throw new Error('test failure');
    sent.push(email.to);
  } };
  await assert.rejects(runAssetReminders(options), /1 asset reminder/);
  fail = false;
  assert.equal((await runAssetReminders(options)).sent, 1);
  assert.deepEqual(sent.sort(), ['hr@example.test', 'owner@example.test']);
});