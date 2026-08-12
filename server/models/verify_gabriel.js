require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  try {
    const empRes = await db.query("SELECT id FROM users WHERE email='gabriel369.lara@gmail.com'");
    const empId = empRes.rows[0]?.id;
    if (!empId) { console.log('Gabriel not found'); process.exit(1); }

    const progress = await db.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE es.status='Completed') AS completed
      FROM sections s
      JOIN employee_sections es ON es.section_id=s.id AND es.user_id=$1
      JOIN employee_details ed ON ed.user_id=$1
      WHERE s.is_active=TRUE
        AND (s.employment_classification_filter IS NULL
             OR s.employment_classification_filter = COALESCE(ed.employment_classification, 'W2'))
        AND (s.job_title_filter IS NULL OR s.job_title_filter = ed.job_title)
    `, [empId]);

    const total = parseInt(progress.rows[0].total);
    const completed = parseInt(progress.rows[0].completed);
    console.log(`Gabriel completion check: ${completed}/${total}`);
    console.log(total === completed && total > 0
      ? '✅ PASS — PDF can be generated'
      : '❌ FAIL — PDF blocked');

    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
