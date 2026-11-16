const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  await db.query(fs.readFileSync(path.join(__dirname, 'invoice_schema.sql'), 'utf8'));
  console.log('Invoice schema migration complete.');
})().catch(err => {
  console.error('Invoice schema migration failed:', err);
  process.exitCode = 1;
}).finally(() => db.pool.end());
