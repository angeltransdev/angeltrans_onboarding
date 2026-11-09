const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  const schema = fs.readFileSync(path.join(__dirname, 'asset_schema.sql'), 'utf8');
  await db.query(schema);
  console.log('Asset schema migration complete.');
})().catch(err => {
  console.error('Asset schema migration failed:', err);
  process.exitCode = 1;
}).finally(() => db.pool.end());