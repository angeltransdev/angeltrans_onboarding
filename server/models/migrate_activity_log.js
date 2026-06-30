const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
      actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
      event_type  VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      ip_address  VARCHAR(45),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id, created_at DESC)`);
  console.log('activity_log table ready.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
