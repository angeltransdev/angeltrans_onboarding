// Run once: node server/models/migrate_dual_role.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_hr_admin BOOLEAN NOT NULL DEFAULT FALSE`);
  console.log('is_hr_admin column ready.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
