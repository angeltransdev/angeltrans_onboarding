require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    console.log('═══════════════════════════════════════════════════');
    console.log(' Angel Trans — Job-Title Section Fix');
    console.log('═══════════════════════════════════════════════════\n');

    // Find employees who have sections seeded for a different job title
    // Only flag sections where the job_title_filter does NOT match AND the section
    // is not a classification-specific section (employment_classification_filter IS NULL),
    // since classification sections like S29/S30 are managed separately.
    const wrongJobTitle = await client.query(`
      SELECT u.name, u.email, ed.job_title,
             s.section_number, s.title, s.job_title_filter, es.status AS section_status
      FROM users u
      JOIN employee_details ed ON ed.user_id = u.id
      JOIN employee_sections es ON es.user_id = u.id
      JOIN sections s ON s.id = es.section_id
      WHERE s.job_title_filter IS NOT NULL
        AND s.job_title_filter <> ed.job_title
        AND s.employment_classification_filter IS NULL
      ORDER BY u.name, s.section_number
    `);

    if (wrongJobTitle.rows.length === 0) {
      console.log('✅ No employees have sections for the wrong job title.');
    } else {
      console.log(`⚠️  Employees with wrong job-title sections (${wrongJobTitle.rows.length} records):`);
      wrongJobTitle.rows.forEach(r =>
        console.log(`   ${r.name} (${r.email}) [${r.job_title}] → S${r.section_number}: ${r.title} [filter: ${r.job_title_filter}] [${r.section_status}]`)
      );

      // Remove the mismatched rows (only general sections with wrong job_title_filter)
      const removed = await client.query(`
        DELETE FROM employee_sections
        WHERE id IN (
          SELECT es.id
          FROM employee_sections es
          JOIN sections s ON s.id = es.section_id
          JOIN employee_details ed ON ed.user_id = es.user_id
          WHERE s.job_title_filter IS NOT NULL
            AND s.job_title_filter <> ed.job_title
            AND s.employment_classification_filter IS NULL
        )
      `);
      console.log(`\n🗑  Removed ${removed.rowCount} wrong-job-title section record(s).`);
    }

    await client.query('COMMIT');

    console.log('\n═══════════════════════════════════════════════════');
    console.log(' Fix complete. All employees now have correct job-title sections.');
    console.log('═══════════════════════════════════════════════════');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Fix failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
})();
