require('dotenv').config();
const db = require('./db');

(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id                           SERIAL PRIMARY KEY,
        user_id                      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        employee_address             TEXT,
        employee_phone               VARCHAR(20),
        has_medical_restrictions     BOOLEAN NOT NULL DEFAULT FALSE,
        medical_restrictions_detail  TEXT,
        primary_name                 VARCHAR(200),
        primary_relationship         VARCHAR(100),
        primary_address              TEXT,
        primary_phone                VARCHAR(20),
        primary_alt_phone            VARCHAR(20),
        secondary_name               VARCHAR(200),
        secondary_relationship       VARCHAR(100),
        secondary_address            TEXT,
        secondary_phone              VARCHAR(20),
        secondary_alt_phone          VARCHAR(20),
        doctor_name                  VARCHAR(200),
        doctor_address               TEXT,
        doctor_phone                 VARCHAR(20),
        employee_signature           TEXT,
        signature_date               DATE,
        submitted                    BOOLEAN NOT NULL DEFAULT FALSE,
        created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);
    console.log('✅ emergency_contacts table created');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
