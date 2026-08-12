require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  try {
    const r = await db.query(
      'UPDATE sections SET display_order = 1 WHERE section_number = 29'
    );
    console.log(`✅ S29 display_order set to 1 (${r.rowCount} row updated)`);

    const check = await db.query(
      'SELECT section_number, title, display_order FROM sections WHERE section_number IN (1, 29) ORDER BY section_number'
    );
    check.rows.forEach(s => console.log(JSON.stringify(s)));

    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
