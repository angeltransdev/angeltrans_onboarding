const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  await db.query(`
    DELETE FROM termination_sections
    WHERE id NOT IN (
      SELECT DISTINCT ON (section_order) id
      FROM termination_sections
      ORDER BY section_order, id ASC
    )
  `);

  await db.query(`
    DELETE FROM section_acknowledgements
    WHERE id NOT IN (
      SELECT DISTINCT ON (section_id, item_order) id
      FROM section_acknowledgements
      ORDER BY section_id, item_order, id ASC
    )
  `);

  const [t, a] = await Promise.all([
    db.query('SELECT COUNT(*) FROM termination_sections'),
    db.query('SELECT COUNT(*) FROM section_acknowledgements'),
  ]);
  console.log('Termination sections:', t.rows[0].count);
  console.log('Section 4 ack items:', a.rows[0].count);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
