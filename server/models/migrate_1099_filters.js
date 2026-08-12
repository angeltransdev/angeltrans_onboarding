require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  try {
    const result = await db.query(`
      UPDATE sections
      SET employment_classification_filter = 'W2'
      WHERE section_number IN (1, 4, 5, 17, 24)
    `);
    console.log(`✅ ${result.rowCount} sections restricted to W2 only (S1, S4, S5, S17, S24).`);
    console.log('   1099 contractors will no longer see these sections.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
