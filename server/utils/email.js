const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  const { data, error } = await resend.emails.send({
    from: `Angel Trans LLC <${process.env.FROM_EMAIL || 'hr@angeltransllc.com'}>`,
    to,
    subject,
    html,
    attachments: attachments.map(a => ({ filename: a.filename, content: a.content })),
  });
  if (error) throw new Error(error.message || 'Failed to send email');
  console.log(`Email sent to ${to}: ${data.id}`);
  return data;
};

module.exports = { sendEmail };
