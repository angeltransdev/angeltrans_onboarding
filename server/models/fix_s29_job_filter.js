require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Fix S29: job_title_filter should be NULL (applies to all 1099 contractors, any job title)
    const fix = await client.query(`
      UPDATE sections
      SET job_title_filter = NULL
      WHERE section_number = 29 AND job_title_filter IS NOT NULL
    `);
    console.log(`Fixed S29 job_title_filter → NULL (${fix.rowCount} row updated)`);

    // Get S29 id
    const s29 = await client.query(`SELECT id FROM sections WHERE section_number = 29`);
    const s29Id = s29.rows[0]?.id;
    if (!s29Id) throw new Error('S29 not found');

    // Re-add S29 to all 1099 employees who don't have it (e.g. Gabriel after the fix_job_title_sections run)
    const reAdded = await client.query(`
      INSERT INTO employee_sections (user_id, section_id, status)
      SELECT ed.user_id, $1, 'Not Started'
      FROM employee_details ed
      WHERE ed.employment_classification = '1099'
        AND NOT EXISTS (
          SELECT 1 FROM employee_sections es
          WHERE es.user_id = ed.user_id AND es.section_id = $1
        )
    `, [s29Id]);
    console.log(`Re-added S29 to ${reAdded.rowCount} 1099 employee(s)`);

    // Retroactively mark S29 as Completed for already-Active 1099 employees
    const retro = await client.query(`
      UPDATE employee_sections es
      SET status = 'Completed',
          date_signed = CURRENT_DATE
      FROM users u
      JOIN employee_details ed ON ed.user_id = u.id
      WHERE es.user_id = u.id
        AND es.section_id = $1
        AND es.status = 'Not Started'
        AND ed.employment_classification = '1099'
        AND u.status = 'Active'
    `, [s29Id]);
    console.log(`Retroactively marked S29 Completed for ${retro.rowCount} Active 1099 employee(s)`);

    await client.query('COMMIT');

    // Show Gabriel's final section list
    const g = await db.query(`
      SELECT s.section_number, s.title, s.job_title_filter, s.employment_classification_filter, es.status
      FROM employee_sections es
      JOIN sections s ON s.id = es.section_id
      JOIN users u ON u.id = es.user_id
      WHERE u.email = 'gabriel369.lara@gmail.com'
      ORDER BY s.section_number
    `);
    console.log('\nGabriel sections after fix:');
    g.rows.forEach(r =>
      console.log(`  S${r.section_number}: ${r.title} | job=${r.job_title_filter ?? 'NULL'} | class=${r.employment_classification_filter ?? 'NULL'} | ${r.status}`)
    );

    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Fix failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
})();
