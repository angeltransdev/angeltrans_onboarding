// Run once: node server/models/migrate_employee_details.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  await db.query(`
    ALTER TABLE employee_details
      ADD COLUMN IF NOT EXISTS sick_leave_option   VARCHAR(10)  DEFAULT '1',
      ADD COLUMN IF NOT EXISTS sick_leave_exempt   TEXT,
      ADD COLUMN IF NOT EXISTS emergency_decl      BOOLEAN      DEFAULT false,
      ADD COLUMN IF NOT EXISTS emergency_details   TEXT
  `);
  console.log('employee_details columns ready.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
