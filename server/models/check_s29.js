require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  try {
    const r = await db.query(
      'SELECT section_number, title, job_title_filter, employment_classification_filter FROM sections WHERE section_number IN (29, 30) ORDER BY section_number'
    );
    console.log('S29/S30 column values:');
    r.rows.forEach(s => console.log(JSON.stringify(s)));

    // Also check Gabriel's current employee_sections
    const g = await db.query(`
      SELECT u.name, s.section_number, s.title, s.job_title_filter, s.employment_classification_filter, es.status
      FROM users u
      JOIN employee_sections es ON es.user_id = u.id
      JOIN sections s ON s.id = es.section_id
      WHERE u.email = 'gabriel369.lara@gmail.com'
      ORDER BY s.section_number
    `);
    console.log('\nGabriel current sections:');
    g.rows.forEach(r => console.log(`  S${r.section_number}: ${r.title} | job_filter=${r.job_title_filter} | class_filter=${r.employment_classification_filter} | ${r.status}`));

    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
