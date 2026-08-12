require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  try {
    const r = await db.query(
      'SELECT section_number, title, content FROM sections WHERE section_number IN (1, 29) ORDER BY section_number'
    );
    r.rows.forEach(s => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`S${s.section_number}: ${s.title}`);
      console.log('='.repeat(60));
      console.log(s.content);
    });
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
