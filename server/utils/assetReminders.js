const crypto = require('crypto');

function reminderStage(daysUntilDue) {
  if (daysUntilDue <= 0) return 0;
  if (daysUntilDue <= 7) return 7;
  if (daysUntilDue <= 14) return 14;
  if (daysUntilDue <= 30) return 30;
  return null;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function runAssetReminders({ pool, sendEmail, hrEmail }) {
  if (!hrEmail || !hrEmail.trim()) throw new Error('HR_EMAIL must be configured for asset reminders.');
  const lockClient = await pool.connect();
  let client;
  let transactionOpen = false;
  const failures = [];
  let sent = 0;
  try {
    await lockClient.query('BEGIN');
    transactionOpen = true;
    const lock = await lockClient.query("SELECT pg_try_advisory_xact_lock(hashtext('angeltrans_asset_reminders')) AS locked");
    if (!lock.rows[0].locked) throw new Error('Another asset reminder job is already running.');
    client = await pool.connect();

    const owners = await client.query("SELECT email FROM users WHERE role='owner' AND status <> 'Terminated' AND email IS NOT NULL");
    const recipients = [...new Set([hrEmail, ...owners.rows.map(row => row.email)].map(email => email.trim().toLowerCase()).filter(Boolean))];
    const due = await client.query(`SELECT r.id, r.title, r.due_date::text AS due_date,
      r.due_date - (NOW() AT TIME ZONE 'America/Los_Angeles')::date AS days_until_due,
      a.name AS asset_name
      FROM asset_records r JOIN assets a ON a.id=r.asset_id
      WHERE r.status='Open' AND a.status <> 'Retired'
        AND r.due_date <= (NOW() AT TIME ZONE 'America/Los_Angeles')::date + 30
      ORDER BY r.due_date, r.id`);

    for (const record of due.rows) {
      const stage = reminderStage(record.days_until_due);
      for (const recipient of recipients) {
        const existing = await client.query(`SELECT 1 FROM asset_reminder_deliveries
          WHERE record_id=$1 AND due_date=$2 AND reminder_days=$3 AND recipient=$4`,
          [record.id, record.due_date, stage, recipient]);
        if (existing.rows.length) continue;
        const key = crypto.createHash('sha256').update(`${record.id}:${record.due_date}:${stage}:${recipient}`).digest('hex');
        const time = record.days_until_due < 0 ? 'is overdue' : record.days_until_due === 0 ? 'is due today' : `is due in ${record.days_until_due} days`;
        try {
          await sendEmail({
            to: recipient,
            subject: `Asset reminder: ${record.asset_name} - ${record.title}`,
            html: `<p>The asset record <strong>${escapeHtml(record.title)}</strong> for <strong>${escapeHtml(record.asset_name)}</strong> ${time} (${escapeHtml(record.due_date)}).</p><p>Open the asset management page to review it.</p>`,
            idempotencyKey: `asset-${key}`,
          });
          await client.query(`INSERT INTO asset_reminder_deliveries (record_id, due_date, reminder_days, recipient)
            VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [record.id, record.due_date, stage, recipient]);
          sent++;
        } catch (err) {
          console.error(`Asset reminder failed for record ${record.id} and recipient ${recipient}:`, err.message);
          failures.push({ recordId: record.id, recipient });
        }
      }
    }
    if (failures.length) throw new Error(`${failures.length} asset reminder delivery attempt(s) failed; retry the job.`);
    return { sent };
  } finally {
    if (client) client.release();
    if (transactionOpen) {
      try { await lockClient.query('ROLLBACK'); }
      catch (err) { console.error('Failed to release asset reminder lock:', err); }
    }
    lockClient.release();
  }
}

module.exports = { reminderStage, runAssetReminders };