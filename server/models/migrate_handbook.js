const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS handbook_acknowledgements (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
      acknowledged_at TIMESTAMPTZ DEFAULT NOW(),
      ip_address      VARCHAR(45),
      name_at_time    VARCHAR(255),
      UNIQUE(user_id)
    )
  `);
  console.log('handbook_acknowledgements table ready.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
