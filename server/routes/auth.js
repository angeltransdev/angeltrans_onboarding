const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const db       = require('../models/db');
const { sendEmail } = require('../utils/email');
const { logActivity } = require('../utils/activityLog');

// ── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required.' });
  try {
    const { rows } = await db.query(
      'SELECT *, is_hr_admin AS "isHrAdmin" FROM users WHERE email = $1', [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user || !user.password_hash)
      return res.status(401).json({ message: 'Invalid email or password.' });
    if (user.status === 'Terminated')
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact HR.' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ message: 'Invalid email or password.' });
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, isHrAdmin: user.isHrAdmin || false },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    if (user.role === 'employee') {
      logActivity({
        userId: user.id,
        eventType: 'login',
        description: 'Logged in',
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      });
    }
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/set-password (employee sets password from invite link) ────
router.post('/set-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password)
    return res.status(400).json({ message: 'Token and password are required.' });
  try {
    const { rows } = await db.query(
      `SELECT * FROM users WHERE invite_token = $1 AND token_expires > NOW()`, [token]
    );
    if (!rows[0])
      return res.status(400).json({ message: 'Invalid or expired invite link. Please contact HR.' });
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      `UPDATE users SET password_hash = $1, invite_token = NULL, token_expires = NULL,
       status = 'Onboarding', updated_at = NOW() WHERE id = $2`,
      [hash, rows[0].id]
    );
    const jwtToken = jwt.sign(
      { id: rows[0].id, name: rows[0].name, email: rows[0].email, role: rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token: jwtToken });
  } catch (err) {
    console.error('Set password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email?.toLowerCase()]);
    // Always return success to prevent email enumeration
    if (!rows[0]) return res.json({ message: 'If that email exists, a reset link has been sent.' });
    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.query(
      'UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
      [token, expiry, rows[0].id]
    );
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    try {
      await sendEmail({
        to: email,
        subject: 'Reset your Angel Trans Portal password',
        html: `
          <p>Hi ${rows[0].name},</p>
          <p>You requested a password reset for your Angel Trans HR Portal account.</p>
          <p><a href="${resetUrl}" style="background:#9e0000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;">Reset Password</a></p>
          <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
          <p>— Angel Trans LLC HR Team</p>
        `
      });
    } catch (mailErr) {
      console.warn('Forgot password email delivery failed:', mailErr.message);
    }
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  try {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_expires > NOW()', [token]
    );
    if (!rows[0])
      return res.status(400).json({ message: 'Invalid or expired reset link.' });
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      'UPDATE users SET password_hash=$1, reset_token=NULL, reset_expires=NULL WHERE id=$2',
      [hash, rows[0].id]
    );
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
