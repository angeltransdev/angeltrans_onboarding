// Run once: node server/models/migrate_settings.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  // Company settings table (single row, id always = 1)
  await db.query(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      name       VARCHAR(255) NOT NULL DEFAULT 'Angel Trans LLC',
      address    TEXT         NOT NULL DEFAULT '1333 Howe Ave # 201, Sacramento, CA 95825',
      phone      VARCHAR(50)  NOT NULL DEFAULT '(916) 259-3249',
      email      VARCHAR(255) NOT NULL DEFAULT 'hr@angeltransllc.com',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row CHECK (id = 1)
    )
  `);

  // Seed default row if missing
  await db.query(`
    INSERT INTO company_settings (id, name, address, phone, email)
    VALUES (1, 'Angel Trans LLC', '1333 Howe Ave # 201, Sacramento, CA 95825', '(916) 259-3249', 'hr@angeltransllc.com')
    ON CONFLICT (id) DO NOTHING
  `);

  // Add phone column to users if missing
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)
  `);

  console.log('Migration complete.');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
