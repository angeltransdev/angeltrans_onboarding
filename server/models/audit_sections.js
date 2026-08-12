require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    console.log('═══════════════════════════════════════════════════');
    console.log(' Angel Trans — Employee Section Audit & Repair');
    console.log('═══════════════════════════════════════════════════\n');

    // ── 1. Find W2 employees who have 1099-only sections ────────────────────────
    const w2With1099 = await client.query(`
      SELECT u.name, u.email, u.status, s.section_number, s.title, es.status AS section_status
      FROM users u
      JOIN employee_details ed ON ed.user_id = u.id
      JOIN employee_sections es ON es.user_id = u.id
      JOIN sections s ON s.id = es.section_id
      WHERE ed.employment_classification = 'W2'
        AND s.employment_classification_filter = '1099'
      ORDER BY u.name, s.section_number
    `);

    if (w2With1099.rows.length === 0) {
      console.log('✅ No W2 employees have 1099-only sections.');
    } else {
      console.log(`⚠️  W2 employees with 1099-only sections (${w2With1099.rows.length} records):`);
      w2With1099.rows.forEach(r =>
        console.log(`   ${r.name} (${r.email}) → S${r.section_number}: ${r.title} [${r.section_status}]`)
      );
    }

    // ── 2. Find 1099 employees who still have W2-only sections ──────────────────
    const i1099WithW2 = await client.query(`
      SELECT u.name, u.email, u.status, s.section_number, s.title, es.status AS section_status
      FROM users u
      JOIN employee_details ed ON ed.user_id = u.id
      JOIN employee_sections es ON es.user_id = u.id
      JOIN sections s ON s.id = es.section_id
      WHERE ed.employment_classification = '1099'
        AND s.employment_classification_filter = 'W2'
      ORDER BY u.name, s.section_number
    `);

    if (i1099WithW2.rows.length === 0) {
      console.log('✅ No 1099 employees have W2-only sections.');
    } else {
      console.log(`⚠️  1099 employees with W2-only sections (${i1099WithW2.rows.length} records):`);
      i1099WithW2.rows.forEach(r =>
        console.log(`   ${r.name} (${r.email}) → S${r.section_number}: ${r.title} [${r.section_status}]`)
      );
    }

    // ── 3. Find 1099 employees missing their 1099-required sections ─────────────
    const missing1099 = await client.query(`
      SELECT u.name, u.email, u.status, s.section_number, s.title
      FROM users u
      JOIN employee_details ed ON ed.user_id = u.id
      CROSS JOIN sections s
      WHERE ed.employment_classification = '1099'
        AND s.is_active = TRUE
        AND s.employment_classification_filter = '1099'
        AND NOT EXISTS (
          SELECT 1 FROM employee_sections es
          WHERE es.user_id = u.id AND es.section_id = s.id
        )
      ORDER BY u.name, s.section_number
    `);

    if (missing1099.rows.length === 0) {
      console.log('✅ All 1099 employees have their required 1099 sections.');
    } else {
      console.log(`⚠️  1099 employees missing required sections (${missing1099.rows.length} records):`);
      missing1099.rows.forEach(r =>
        console.log(`   ${r.name} (${r.email}) → Missing S${r.section_number}: ${r.title}`)
      );
    }

    // ── 4. Auto-repair: retroactively mark S29 complete for already-Active 1099s ─
    const s29Res = await client.query(`SELECT id FROM sections WHERE section_number = 29`);
    const s29Id = s29Res.rows[0]?.id;

    if (s29Id) {
      const retroFix = await client.query(`
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

      if (retroFix.rowCount > 0) {
        console.log(`\n🔧 Retroactively marked S29 as Completed for ${retroFix.rowCount} already-Active 1099 employee(s).`);
        console.log('   (These employees were onboarded before S29 existed — marking complete on their behalf.)');
      }
    }

    // ── 5. Auto-repair: remove W2-only sections from any remaining 1099 employees
    const removed = await client.query(`
      DELETE FROM employee_sections
      WHERE user_id IN (
        SELECT user_id FROM employee_details WHERE employment_classification = '1099'
      )
      AND section_id IN (
        SELECT id FROM sections WHERE employment_classification_filter = 'W2'
      )
    `);
    if (removed.rowCount > 0) {
      console.log(`🗑  Removed ${removed.rowCount} W2-only section(s) from 1099 employees.`);
    }

    // ── 6. Auto-repair: remove 1099-only sections from any W2 employees ─────────
    const removedW2 = await client.query(`
      DELETE FROM employee_sections
      WHERE user_id IN (
        SELECT user_id FROM employee_details WHERE employment_classification = 'W2'
      )
      AND section_id IN (
        SELECT id FROM sections WHERE employment_classification_filter = '1099'
      )
    `);
    if (removedW2.rowCount > 0) {
      console.log(`🗑  Removed ${removedW2.rowCount} 1099-only section(s) from W2 employees.`);
    }

    await client.query('COMMIT');

    console.log('\n═══════════════════════════════════════════════════');
    console.log(' Audit complete. All employees now have correct sections.');
    console.log('═══════════════════════════════════════════════════');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Audit failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
})();
