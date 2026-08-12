require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Find all 1099 employees who have W2-only sections assigned
    const affected = await client.query(`
      SELECT DISTINCT u.id, u.name, u.email
      FROM users u
      JOIN employee_details ed ON ed.user_id = u.id
      JOIN employee_sections es ON es.user_id = u.id
      JOIN sections s ON s.id = es.section_id
      WHERE ed.employment_classification = '1099'
        AND s.section_number IN (1, 4, 5, 17, 24)
      ORDER BY u.name
    `);

    if (affected.rows.length === 0) {
      console.log('✅ No 1099 employees found with W2-only sections. Nothing to fix.');
      await client.query('ROLLBACK');
      process.exit(0);
    }

    console.log(`Found ${affected.rows.length} 1099 employee(s) with W2-only sections:`);
    affected.rows.forEach(r => console.log(`  - ${r.name} (${r.email})`));
    console.log('');

    // Remove W2-only sections from 1099 employees
    const removed = await client.query(`
      DELETE FROM employee_sections
      WHERE user_id IN (
        SELECT user_id FROM employee_details WHERE employment_classification = '1099'
      )
      AND section_id IN (
        SELECT id FROM sections WHERE section_number IN (1, 4, 5, 17, 24)
      )
    `);
    console.log(`🗑  Removed ${removed.rowCount} W2-only section record(s) from 1099 employees`);

    // Get the S29 section id
    const s29Res = await client.query(`SELECT id FROM sections WHERE section_number = 29`);
    if (!s29Res.rows[0]) {
      console.error('❌ Section 29 not found — run migrate_add_s29.js first');
      await client.query('ROLLBACK');
      process.exit(1);
    }
    const s29Id = s29Res.rows[0].id;

    // Get the S30 section id (ICA)
    const s30Res = await client.query(`SELECT id FROM sections WHERE section_number = 30`);
    const s30Id = s30Res.rows[0]?.id;

    // Add S29 for 1099 employees who don't already have it
    const addedS29 = await client.query(`
      INSERT INTO employee_sections (user_id, section_id, status)
      SELECT ed.user_id, $1, 'Not Started'
      FROM employee_details ed
      WHERE ed.employment_classification = '1099'
        AND NOT EXISTS (
          SELECT 1 FROM employee_sections es
          WHERE es.user_id = ed.user_id AND es.section_id = $1
        )
    `, [s29Id]);
    console.log(`➕ Added S29 (1099 Offer Letter) to ${addedS29.rowCount} employee(s)`);

    // Add S30 for 1099 employees who don't already have it (if it exists)
    if (s30Id) {
      const addedS30 = await client.query(`
        INSERT INTO employee_sections (user_id, section_id, status)
        SELECT ed.user_id, $1, 'Not Started'
        FROM employee_details ed
        WHERE ed.employment_classification = '1099'
          AND NOT EXISTS (
            SELECT 1 FROM employee_sections es
            WHERE es.user_id = ed.user_id AND es.section_id = $1
          )
      `, [s30Id]);
      console.log(`➕ Added S30 (Independent Contractor Agreement) to ${addedS30.rowCount} employee(s)`);
    }

    await client.query('COMMIT');

    // Summary per employee
    console.log('\n📋 Summary per employee:');
    for (const emp of affected.rows) {
      const sections = await db.query(`
        SELECT s.section_number, s.title, es.status
        FROM employee_sections es
        JOIN sections s ON s.id = es.section_id
        WHERE es.user_id = $1
        ORDER BY s.section_number
      `, [emp.id]);
      console.log(`\n  ${emp.name}:`);
      sections.rows.forEach(s =>
        console.log(`    S${s.section_number}: ${s.title} — ${s.status}`)
      );
    }

    console.log('\n✅ Done. 1099 employees now have correct sections.');
    console.log('   Affected employees will need to sign S29 (and S30 if not already signed).');
    console.log('   HR can regenerate their PDFs once signing is complete.');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
})();
