const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Resend } = require('resend');
const db = require('../models/db');
const { runAssetReminders } = require('../utils/assetReminders');

(async () => {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY must be configured for asset reminders.');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await runAssetReminders({
    pool: db.pool,
    hrEmail: process.env.HR_EMAIL,
    sendEmail: async ({ to, subject, html, idempotencyKey }) => {
      const { error } = await resend.emails.send({
        from: `Angel Trans LLC <${process.env.FROM_EMAIL || 'hr@angeltransllc.com'}>`,
        to, subject, html,
      }, { idempotencyKey });
      if (error) throw new Error(error.message || 'Email delivery failed.');
    },
  });
  console.log(`Asset reminder job complete: ${result.sent} email(s) sent.`);
})().catch(err => {
  console.error('Asset reminder job failed:', err);
  process.exitCode = 1;
}).finally(() => db.pool.end());