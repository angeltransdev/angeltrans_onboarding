const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const db       = require('../models/db');
const { authenticate, requireHR, requireOwner } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const { generateOnboardingPDF, generateTerminationPDF } = require('../utils/pdfGenerator');
const { logActivity } = require('../utils/activityLog');

// All HR routes require authentication + HR role
router.use(authenticate, requireHR);

// ── GET /api/hr/stats ────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*)                                               AS total,
        COUNT(*) FILTER (WHERE status = 'Onboarding')        AS onboarding,
        COUNT(*) FILTER (WHERE status = 'Active')            AS active,
        COUNT(*) FILTER (WHERE status = 'Termination Pending') AS "termPending",
        COUNT(*) FILTER (WHERE status = 'Terminated')        AS terminated
      FROM users WHERE role = 'employee'
    `);
    const s = rows[0];
    res.json({
      total:       parseInt(s.total),
      onboarding:  parseInt(s.onboarding),
      active:      parseInt(s.active),
      termPending: parseInt(s.termPending),
      terminated:  parseInt(s.terminated),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/hr/employees ────────────────────────────────────────────────────
router.get('/employees', async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
      SELECT u.id, u.name, u.email, u.status,
             ed.job_title AS "jobTitle", ed.department, ed.date_sent AS "dateSent",
             ed.last_activity AS "lastActivity",
             COUNT(es.id) FILTER (WHERE es.status = 'Completed') AS "completedSections",
             COUNT(es.id) AS "totalSections"
      FROM users u
      LEFT JOIN employee_details ed ON ed.user_id = u.id
      LEFT JOIN employee_sections es ON es.user_id = u.id
      WHERE u.role = 'employee'
    `;
    const params = [];
    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      params.push(statuses);
      query += ` AND u.status = ANY($1)`;
    }
    query += ` GROUP BY u.id, u.name, u.email, u.status, ed.job_title, ed.department, ed.date_sent, ed.last_activity
               ORDER BY ed.date_sent DESC`;
    const { rows } = await db.query(query, params);
    const employees = rows.map(r => ({
      ...r,
      completedSections: parseInt(r.completedSections) || 0,
      totalSections:     parseInt(r.totalSections) || 28,
      progress: r.totalSections > 0
        ? Math.round((parseInt(r.completedSections) / parseInt(r.totalSections)) * 100)
        : 0,
      dateSent:     r.dateSent ? new Date(r.dateSent).toLocaleDateString() : '—',
      lastActivity: r.lastActivity ? new Date(r.lastActivity).toLocaleDateString() : '—',
    }));
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/hr/employees/:id ────────────────────────────────────────────────
router.get('/employees/:id', async (req, res) => {
  try {
    const [empRes, hbRes] = await Promise.all([
      db.query(`
        SELECT u.id, u.name, u.email, u.phone, u.status,
               ed.job_title AS "jobTitle", ed.employment_type AS "employmentType",
               ed.start_date AS "startDate", ed.hourly_rate AS "hourlyRate",
               ed.overtime_rate AS "overtimeRate", ed.department, ed.manager,
               ed.sick_leave_option AS "sickLeaveOption",
               ed.sick_leave_exempt AS "sickLeaveExemptReason",
               ed.emergency_decl AS "emergencyDecl",
               ed.emergency_details AS "emergencyDetails"
        FROM users u
        LEFT JOIN employee_details ed ON ed.user_id = u.id
        WHERE u.id = $1 AND u.role = 'employee'
      `, [req.params.id]),
      db.query(
        'SELECT acknowledged_at FROM handbook_acknowledgements WHERE user_id=$1',
        [req.params.id]
      ),
    ]);
    if (!empRes.rows[0]) return res.status(404).json({ message: 'Employee not found.' });
    res.json({
      ...empRes.rows[0],
      handbookAcknowledged:   !!hbRes.rows[0],
      handbookAcknowledgedAt: hbRes.rows[0]?.acknowledged_at || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/hr/employees/:id/sections ───────────────────────────────────────
router.get('/employees/:id/sections', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.id, s.section_number AS "sectionNumber", s.title,
             COALESCE(es.status, 'Not Started') AS status,
             es.date_signed AS "dateSigned", es.signed_at AS "signedAt"
      FROM sections s
      LEFT JOIN employee_sections es ON es.section_id = s.id AND es.user_id = $1
      WHERE s.is_active = TRUE
      ORDER BY s.section_number
    `, [req.params.id]);
    res.json(rows.map(r => ({ ...r, signed: r.status === 'Completed' })));
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/hr/employees/:id/activity ───────────────────────────────────────
router.get('/employees/:id/activity', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT al.id, al.event_type AS "eventType", al.description, al.ip_address AS "ipAddress",
             al.created_at AS "createdAt", actor.name AS "actorName"
      FROM activity_log al
      LEFT JOIN users actor ON actor.id = al.actor_id
      WHERE al.user_id = $1
      ORDER BY al.created_at DESC
      LIMIT 200
    `, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/hr/employees/:id/resend ────────────────────────────────────────
router.post('/employees/:id/resend', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Employee not found.' });
    const token   = crypto.randomBytes(32).toString('hex');
    const expiry  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await db.query(
      'UPDATE users SET invite_token=$1, token_expires=$2 WHERE id=$3',
      [token, expiry, rows[0].id]
    );
    const link = `${process.env.CLIENT_URL}/set-password?token=${token}`;
    await sendEmail({
      to: rows[0].email,
      subject: 'Your Angel Trans Onboarding Link',
      html: `<p>Hi ${rows[0].name},</p>
             <p>Here is your updated onboarding link:</p>
             <p><a href="${link}" style="background:#9e0000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;">Access Onboarding Portal</a></p>
             <p>This link expires in 7 days.</p>`
    });
    logActivity({ userId: rows[0].id, actorId: req.user.id, eventType: 'link_resent', description: `Onboarding link resent by ${req.user.name}` });
    res.json({ message: 'Invitation resent.' });
  } catch (err) {
    console.error('Resend error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to resend link.' });
  }
});

// ── GET /api/hr/employees/:id/download ───────────────────────────────────────
router.get('/employees/:id/download', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM documents WHERE user_id=$1 AND type=$2 ORDER BY created_at DESC LIMIT 1',
      [req.params.id, 'Onboarding Packet']
    );
    if (!rows[0]) return res.status(404).json({ message: 'No packet found. Click "Generate PDF" to create it.' });
    const filePath = rows[0].storage_path;
    const fs = require('fs');
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'PDF file missing on server. Click "Generate PDF" to regenerate.' });
    const empRes = await db.query('SELECT name FROM users WHERE id=$1', [req.params.id]);
    const name = empRes.rows[0]?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'employee';
    const { size } = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `attachment; filename="${name}_Onboarding_Packet.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/hr/employees/:id/generate-pdf ──────────────────────────────────
router.post('/employees/:id/generate-pdf', async (req, res) => {
  try {
    const empId = req.params.id;

    // Verify the employee exists
    const { rows: userRows } = await db.query(
      'SELECT * FROM users WHERE id=$1 AND role=$2', [empId, 'employee']
    );
    if (!userRows[0]) return res.status(404).json({ message: 'Employee not found.' });

    // Check completion status
    const progress = await db.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE es.status='Completed') AS completed
      FROM sections s
      JOIN employee_sections es ON es.section_id=s.id AND es.user_id=$1
      WHERE s.is_active=TRUE
    `, [empId]);

    const total     = parseInt(progress.rows[0].total);
    const completed = parseInt(progress.rows[0].completed);

    if (total === 0 || total !== completed) {
      return res.status(400).json({
        message: `Cannot generate PDF — employee has only completed ${completed} of ${total} sections.`
      });
    }

    // Fire-and-forget — LibreOffice can take 30-60 s; don't block the HTTP request
    generateOnboardingPDF(empId)
      .then(() => console.log(`✅ HR-triggered PDF ready for ${empId}`))
      .catch(err => console.error(`❌ HR-triggered PDF failed for ${empId}:`, err.message));

    res.json({ message: 'PDF generation started. Please wait a moment, then download.', ready: false });
  } catch (err) {
    console.error('HR generate-pdf error:', err);
    res.status(500).json({ message: `PDF generation failed: ${err.message}` });
  }
});

// ── PUT /api/hr/employees/:id/details (upsert employment details) ─────────────
router.put('/employees/:id/details', async (req, res) => {
  const { jobTitle, employmentType, startDate, hourlyRate, overtimeRate, manager, department,
          sickLeaveOption, sickLeaveExemptReason, hasEmergencyDeclaration, emergencyDeclarationDetails } = req.body;
  if (!jobTitle || !startDate || !hourlyRate || !overtimeRate)
    return res.status(400).json({ message: 'Job title, start date, hourly rate, and overtime rate are required.' });
  try {
    const empRes = await db.query('SELECT id FROM users WHERE id=$1 AND role=$2', [req.params.id, 'employee']);
    if (!empRes.rows[0]) return res.status(404).json({ message: 'Employee not found.' });

    await db.query(`
      INSERT INTO employee_details
        (user_id, job_title, employment_type, start_date, hourly_rate, overtime_rate, manager, department,
         sick_leave_option, sick_leave_exempt, emergency_decl, emergency_details, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (user_id) DO UPDATE SET
        job_title=$2, employment_type=$3, start_date=$4, hourly_rate=$5, overtime_rate=$6,
        manager=$7, department=$8, sick_leave_option=$9, sick_leave_exempt=$10,
        emergency_decl=$11, emergency_details=$12
    `, [req.params.id, jobTitle, employmentType || 'Full-Time', startDate, hourlyRate, overtimeRate,
        manager || null, department || null,
        sickLeaveOption || '1', sickLeaveExemptReason || null,
        hasEmergencyDeclaration === 'yes' || hasEmergencyDeclaration === true,
        emergencyDeclarationDetails || null, req.user.id]);

    res.json({ message: 'Employee details saved.' });
  } catch (err) {
    console.error('Update employee details error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/hr/send-onboarding ─────────────────────────────────────────────
router.post('/send-onboarding', async (req, res) => {
  const { fullName, email, phone, jobTitle, employmentType, startDate, hourlyRate, overtimeRate, manager, department } = req.body;
  if (!fullName || !email || !jobTitle || !startDate || !hourlyRate || !overtimeRate)
    return res.status(400).json({ message: 'Please fill all required fields.' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Check for duplicate
    const existing = await client.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (existing.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'An employee with this email already exists.' });
    }

    // Create user
    const token   = crypto.randomBytes(32).toString('hex');
    const expiry  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { rows } = await client.query(
      `INSERT INTO users (name, email, phone, role, status, invite_token, token_expires)
       VALUES ($1, $2, $3, 'employee', 'Onboarding', $4, $5) RETURNING id`,
      [fullName, email.toLowerCase(), phone || null, token, expiry]
    );
    const userId = rows[0].id;

    // Extract Section 5 fields
    const { sickLeaveOption, sickLeaveExemptReason, hasEmergencyDeclaration, emergencyDeclarationDetails } = req.body;

    // Save employee details
    await client.query(
      `INSERT INTO employee_details (user_id, job_title, employment_type, start_date, hourly_rate, overtime_rate, manager, department, sick_leave_option, sick_leave_exempt, emergency_decl, emergency_details, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [userId, jobTitle, employmentType, startDate, hourlyRate, overtimeRate, manager, department,
       sickLeaveOption || '1', sickLeaveExemptReason || null,
       hasEmergencyDeclaration === 'yes', emergencyDeclarationDetails || null,
       req.user.id]
    );

    // Seed employee_sections rows (one per section)
    await client.query(
      `INSERT INTO employee_sections (user_id, section_id, status)
       SELECT $1, id, 'Not Started' FROM sections WHERE is_active = TRUE`,
      [userId]
    );

    await client.query('COMMIT');

    logActivity({ userId, actorId: req.user.id, eventType: 'employee_created', description: `Onboarding invite created by ${req.user.name}` });

    // Send invite email
    const link = `${process.env.CLIENT_URL}/set-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Welcome to Angel Trans LLC — Complete Your Onboarding',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#9e0000;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;">Angel Trans LLC</h1>
            <p style="color:#ffdad4;margin:8px 0 0;">Non-Emergency Medical Transportation</p>
          </div>
          <div style="padding:32px 24px;">
            <p>Hi <strong>${fullName}</strong>,</p>
            <p>Welcome to Angel Trans LLC! You've been invited to complete your employee onboarding.</p>
            <p>Please click the button below to create your account and begin your orientation packet:</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${link}" style="background:#9e0000;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                Begin Onboarding
              </a>
            </div>
            <p><strong>Your details:</strong></p>
            <ul>
              <li>Position: ${jobTitle}</li>
              <li>Start Date: ${new Date(startDate).toLocaleDateString()}</li>
              <li>Employment Type: ${employmentType}</li>
            </ul>
            <p style="color:#666;font-size:14px;">This link expires in 7 days. Contact HR at hr@angeltrans.com if you have questions.</p>
          </div>
        </div>
      `
    });
    res.status(201).json({ message: `Onboarding packet sent to ${fullName}.` });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Send onboarding error:', err);
    res.status(500).json({ message: 'Server error.' });
  } finally {
    client.release();
  }
});

// ── POST /api/hr/initiate-termination ────────────────────────────────────────
router.post('/initiate-termination', async (req, res) => {
  const { employeeId, reason, effectiveDate, finalPayDate, comments } = req.body;
  if (!employeeId || !reason || !effectiveDate || !finalPayDate)
    return res.status(400).json({ message: 'Please fill all required fields.' });
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE id=$1 AND role=$2', [employeeId, 'employee']);
    if (!rows[0]) return res.status(404).json({ message: 'Employee not found.' });

    // Create termination record
    const termResult = await db.query(
      `INSERT INTO terminations (user_id, initiated_by, reason, effective_date, final_pay_date, comments)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [employeeId, req.user.id, reason, effectiveDate, finalPayDate, comments]
    );

    // Update employee status
    await db.query(
      `UPDATE users SET status='Termination Pending', updated_at=NOW() WHERE id=$1`,
      [employeeId]
    );

    // Send termination packet email
    const link = `${process.env.CLIENT_URL}/termination`;
    await sendEmail({
      to: rows[0].email,
      subject: 'Important: Angel Trans LLC — Termination Documents',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#141d23;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;">Angel Trans LLC</h1>
          </div>
          <div style="padding:32px 24px;">
            <p>Hi <strong>${rows[0].name}</strong>,</p>
            <p>Your employment separation documents are ready for your review and signature.</p>
            <p>Please sign in to the portal to complete your termination paperwork:</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="${link}" style="background:#141d23;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                View Termination Packet
              </a>
            </div>
            <p><strong>Effective Date:</strong> ${new Date(effectiveDate).toLocaleDateString()}</p>
            <p><strong>Final Pay Date:</strong> ${new Date(finalPayDate).toLocaleDateString()}</p>
            <p style="color:#666;font-size:14px;">If you have questions, contact HR at hr@angeltrans.com or (916) 259-3249.</p>
          </div>
        </div>
      `
    });
    res.json({ message: 'Termination packet sent.' });
  } catch (err) {
    console.error('Initiate termination error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/hr/documents ─────────────────────────────────────────────────────
router.get('/documents', async (req, res) => {
  const { type } = req.query;
  try {
    let query = `
      SELECT d.id, u.name AS "employeeName", d.type, d.date_completed AS "dateCompleted", d.storage_path AS "storagePath"
      FROM documents d
      JOIN users u ON u.id = d.user_id
    `;
    const params = [];
    if (type && type !== 'all') {
      params.push(type === 'onboarding' ? 'Onboarding Packet' : 'Termination Packet');
      query += ` WHERE d.type = $1`;
    }
    query += ` ORDER BY d.created_at DESC`;
    const { rows } = await db.query(query, params);
    res.json(rows.map(r => ({ ...r, dateCompleted: r.dateCompleted ? new Date(r.dateCompleted).toLocaleDateString() : '—' })));
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/hr/documents/:id/download ───────────────────────────────────────
router.get('/documents/:id/download', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT d.*, u.name FROM documents d JOIN users u ON u.id=d.user_id WHERE d.id=$1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Document not found.' });
    const filePath = rows[0].storage_path;
    const fs = require('fs');
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'PDF has expired or was cleared. Click "Generate PDF" to create a fresh copy.' });
    const name = rows[0].name?.replace(/[^a-zA-Z0-9]/g, '_') || 'employee';
    const type = rows[0].type === 'Termination Packet' ? 'Termination' : 'Onboarding';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}_${type}_Packet.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/hr/settings ─────────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM company_settings WHERE id=1');
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── PUT /api/hr/settings (owner only) ────────────────────────────────────────
router.put('/settings', requireOwner, async (req, res) => {
  const { name, address, phone, email } = req.body;
  if (!name || !address || !phone || !email)
    return res.status(400).json({ message: 'All fields are required.' });
  try {
    const { rows } = await db.query(`
      INSERT INTO company_settings (id, name, address, phone, email, updated_at)
      VALUES (1, $1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET name=$1, address=$2, phone=$3, email=$4, updated_at=NOW()
      RETURNING *
    `, [name, address, phone, email]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/hr/admins ────────────────────────────────────────────────────────
router.get('/admins', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, role FROM users WHERE role IN ('hr_admin','owner') ORDER BY created_at`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/hr/admins (owner only) ─────────────────────────────────────────
router.post('/admins', requireOwner, async (req, res) => {
  const { name, email, role } = req.body;
  if (!name || !email) return res.status(400).json({ message: 'Name and email required.' });
  try {
    const existing = await db.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (existing.rows[0]) return res.status(409).json({ message: 'A user with this email already exists.' });
    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const validRole = ['hr_admin','owner'].includes(role) ? role : 'hr_admin';
    await db.query(
      `INSERT INTO users (name, email, role, status, invite_token, token_expires)
       VALUES ($1,$2,$3,'Active',$4,$5)`,
      [name, email.toLowerCase(), validRole, token, expiry]
    );
    const link = `${process.env.CLIENT_URL}/set-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: 'Angel Trans HR Portal — Admin Access',
      html: `<p>Hi ${name},</p>
             <p>You have been granted HR Admin access to the Angel Trans HR Portal.</p>
             <p><a href="${link}" style="background:#9e0000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;">Create Your Account</a></p>
             <p>This link expires in 7 days.</p>`
    });
    res.status(201).json({ message: `Admin invitation sent to ${name}.` });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── DELETE /api/hr/admins/:id (owner only) ────────────────────────────────────
router.delete('/admins/:id', requireOwner, async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ message: 'You cannot remove yourself.' });
    await db.query(`DELETE FROM users WHERE id=$1 AND role IN ('hr_admin','owner')`, [req.params.id]);
    res.json({ message: 'Admin removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
