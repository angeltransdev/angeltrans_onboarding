const nodemailer = require('nodemailer');

const SMTP_PORT = Number(process.env.SMTP_PORT || 465);

const transporter = nodemailer.createTransport({
  host:       process.env.SMTP_HOST,
  port:       SMTP_PORT,
  secure:     SMTP_PORT === 465,  // native SSL/TLS for 465; STARTTLS upgrade for 587
  requireTLS: SMTP_PORT === 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  const info = await transporter.sendMail({
    from: `"Angel Trans LLC" <${process.env.FROM_EMAIL || 'hr@angeltrans.com'}>`,
    to, subject, html, attachments,
  });
  console.log(`Email sent to ${to}: ${info.messageId}`);
  return info;
};

module.exports = { sendEmail };
