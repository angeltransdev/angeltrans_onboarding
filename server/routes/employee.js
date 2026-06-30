const router = require('express').Router();
const db     = require('../models/db');
const { authenticate, requireEmployee } = require('../middleware/auth');
const { injectFields }  = require('../utils/injectFields');
const { generateOnboardingPDF, generateTerminationPDF } = require('../utils/pdfGenerator');
const { sendEmail } = require('../utils/email');
const { logActivity } = require('../utils/activityLog');

router.use(authenticate, requireEmployee);

// Track in-progress PDF generations to prevent duplicate runs
const generatingUsers = new Set();
// Track recent generation failures so the client gets a real error instead of looping forever
const generationFailed = new Map(); // userId → { message, at }
const FAILURE_COOLDOWN = 120_000; // 2 min — don't auto-retry after a hard failure

// ── GET /api/employee/sections ────────────────────────────────────────────────
router.get('/sections', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT s.id, s.section_number AS "sectionNumber", s.title,
             COALESCE(es.status, 'Not Started') AS status
      FROM sections s
      LEFT JOIN employee_sections es ON es.section_id = s.id AND es.user_id = $1
      WHERE s.is_active = TRUE
      ORDER BY s.section_number
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/employee/sections/progress ───────────────────────────────────────
router.get('/sections/progress', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE es.status = 'Completed') AS completed
      FROM sections s
      JOIN employee_sections es ON es.section_id = s.id AND es.user_id = $1
      WHERE s.is_active = TRUE
    `, [req.user.id]);
    const total     = parseInt(rows[0].total);
    const completed = parseInt(rows[0].completed);
    res.json({ total, completed, allComplete: total > 0 && total === completed });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/employee/sections/:id ───────────────────────────────────────────
router.get('/sections/:id', async (req, res) => {
  try {
    // Get section content
    const [secRes, detailRes, ackRes, sigRes] = await Promise.all([
      db.query('SELECT * FROM sections WHERE id=$1', [req.params.id]),
      db.query(`SELECT ed.*, u.name FROM employee_details ed
                JOIN users u ON u.id = ed.user_id WHERE ed.user_id = $1`, [req.user.id]),
      db.query(`SELECT id, item_order AS "itemOrder", item_text AS "text"
                FROM section_acknowledgements WHERE section_id=$1 ORDER BY item_order`, [req.params.id]),
      db.query(`SELECT * FROM employee_sections WHERE section_id=$1 AND user_id=$2`,
                [req.params.id, req.user.id]),
    ]);

    if (!secRes.rows[0]) return res.status(404).json({ message: 'Section not found.' });

    const section = secRes.rows[0];
    const details = detailRes.rows[0];
    const existing = sigRes.rows[0];

    // Inject employee-specific fields into content
    // For S24 Annual Agreement, pass today's date so year is auto-filled
    const signingDate = new Date().toISOString().split('T')[0];
    const injectedContent = injectFields(section.content, details, signingDate);

    // Build prefilled fields for display
    const prefilledFields = details ? [
      { key:'employeeName',    label:'Employee Name',    value: details.name },
      { key:'jobTitle',        label:'Job Title',        value: details.job_title },
      { key:'employmentType',  label:'Employment Type',  value: details.employment_type },
      { key:'startDate',       label:'Start Date',       value: details.start_date ? new Date(details.start_date).toLocaleDateString() : '' },
      { key:'hourlyRate',      label:'Hourly Rate',      value: details.hourly_rate ? `$${Number(details.hourly_rate).toFixed(2)}/hr` : '' },
      { key:'overtimeRate',    label:'Overtime Rate',    value: details.overtime_rate ? `$${Number(details.overtime_rate).toFixed(2)}/hr` : '' },
    ].filter(f => f.value) : [];

    res.json({
      id:              section.id,
      sectionNumber:   section.section_number,
      title:           section.title,
      content:         injectedContent,
      hasInitials:     section.has_initials,
      acknowledgements: ackRes.rows,
      prefilledFields,
      status:          existing?.status || 'Not Started',
      savedSignature:  existing?.signature || '',
      savedName:       existing?.printed_name || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/employee/sections/:id/save (save progress) ─────────────────────
router.post('/sections/:id/save', async (req, res) => {
  const { fields, initials } = req.body;
  try {
    await db.query(`
      INSERT INTO employee_sections (user_id, section_id, status, signature, printed_name, saved_at)
      VALUES ($1,$2,'In Progress',$3,$4,NOW())
      ON CONFLICT (user_id, section_id) DO UPDATE
      SET status='In Progress', signature=$3, printed_name=$4, saved_at=NOW()
    `, [req.user.id, req.params.id, fields?.signature, fields?.printedName]);

    // Save initials if any
    if (initials) {
      for (const [ackId, initialed] of Object.entries(initials)) {
        await db.query(`
          INSERT INTO employee_initials (user_id, ack_item_id, initialed)
          VALUES ($1,$2,$3)
          ON CONFLICT (user_id, ack_item_id) DO UPDATE SET initialed=$3
        `, [req.user.id, ackId, initialed]);
      }
    }

    // Update last activity
    await db.query('UPDATE employee_details SET last_activity=NOW() WHERE user_id=$1', [req.user.id]);
    res.json({ message: 'Progress saved.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/employee/sections/:id/sign (complete section) ──────────────────
router.post('/sections/:id/sign', async (req, res) => {
  const { fields, initials } = req.body;
  if (!fields?.signature || !fields?.date)
    return res.status(400).json({ message: 'Signature and date are required.' });
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    await db.query(`
      INSERT INTO employee_sections (user_id, section_id, status, signature, printed_name, date_signed, ip_address, signed_at)
      VALUES ($1,$2,'Completed',$3,$4,$5,$6,NOW())
      ON CONFLICT (user_id, section_id) DO UPDATE
      SET status='Completed', signature=$3, printed_name=$4, date_signed=$5, ip_address=$6, signed_at=NOW()
    `, [req.user.id, req.params.id, fields.signature, fields.printedName, fields.date, ip]);

    // Save initials
    if (initials) {
      for (const [ackId, initialed] of Object.entries(initials)) {
        await db.query(`
          INSERT INTO employee_initials (user_id, ack_item_id, initialed, initialed_at)
          VALUES ($1,$2,$3,NOW())
          ON CONFLICT (user_id, ack_item_id) DO UPDATE SET initialed=$3, initialed_at=NOW()
        `, [req.user.id, ackId, initialed]);
      }
    }

    await db.query('UPDATE employee_details SET last_activity=NOW() WHERE user_id=$1', [req.user.id]);

    const sectionRes = await db.query('SELECT title FROM sections WHERE id=$1', [req.params.id]);
    logActivity({
      userId: req.user.id,
      eventType: 'section_signed',
      description: `Completed section: ${sectionRes.rows[0]?.title || req.params.id}`,
      ip,
    });

    // Check if all sections complete — if so generate PDF
    const progress = await db.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE es.status='Completed') AS completed
      FROM sections s
      JOIN employee_sections es ON es.section_id=s.id AND es.user_id=$1
      WHERE s.is_active=TRUE
    `, [req.user.id]);

    const total     = parseInt(progress.rows[0].total);
    const completed = parseInt(progress.rows[0].completed);

    console.log(`Progress for user ${req.user.id}: ${completed}/${total} sections completed`);

    if (total > 0 && total === completed) {
      console.log(`All sections complete for ${req.user.id} — generating PDF...`);
      // Generate PDF — awaited so we know if it fails
      generateOnboardingPDF(req.user.id)
        .then(() => console.log(`✅ PDF ready for ${req.user.id}`))
        .catch(err => console.error(`❌ PDF failed for ${req.user.id}:`, err.message));
    }

    res.json({ message: 'Section signed.', allComplete: total > 0 && total === completed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/employee/generate-pdf (manual trigger) ─────────────────────────
router.post('/generate-pdf', async (req, res) => {
  try {
    const force  = req.body?.force === true;
    const fs     = require('fs');
    const path   = require('path');
    const pdfDir = path.join(__dirname, '..', 'pdfs');

    // Check all sections are complete
    const progress = await db.query(`
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE es.status='Completed') AS completed
      FROM sections s
      JOIN employee_sections es ON es.section_id=s.id AND es.user_id=$1
      WHERE s.is_active=TRUE
    `, [req.user.id]);

    const total     = parseInt(progress.rows[0].total);
    const completed = parseInt(progress.rows[0].completed);

    if (total === 0 || total !== completed) {
      return res.status(400).json({
        message: `Not all sections complete. ${completed} of ${total} done.`
      });
    }

    // Check if a valid DB record + file already exists
    const existing = await db.query(
      `SELECT * FROM documents WHERE user_id=$1 AND type='Onboarding Packet' ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );

    if (!force && existing.rows[0] && fs.existsSync(existing.rows[0].storage_path)) {
      return res.json({ message: 'PDF already generated.', ready: true });
    }

    // Recovery: DB record missing but a valid PDF file exists on disk from a prior run
    if (!existing.rows[0] && !force && fs.existsSync(pdfDir)) {
      const orphans = fs.readdirSync(pdfDir)
        .filter(f => f.startsWith(`onboarding_${req.user.id}_`) && f.endsWith('.pdf'))
        .sort().reverse(); // newest first

      if (orphans.length > 0) {
        const latestPath = path.join(pdfDir, orphans[0]);
        const header = Buffer.alloc(5);
        const fd = fs.openSync(latestPath, 'r');
        fs.readSync(fd, header, 0, 5, 0);
        fs.closeSync(fd);
        if (header.toString('ascii') === '%PDF-') {
          // Re-link valid orphaned file back into the DB
          await db.query(
            `INSERT INTO documents (user_id, type, storage_path, date_completed)
             VALUES ($1,'Onboarding Packet',$2,CURRENT_DATE)`,
            [req.user.id, latestPath]
          );
          console.log(`↩️ Re-linked orphaned PDF for ${req.user.id}: ${orphans[0]}`);
          return res.json({ message: 'PDF already generated.', ready: true });
        }
      }
    }

    // If already generating for this user, don't start another process
    if (generatingUsers.has(req.user.id)) {
      return res.json({ message: 'PDF generation in progress. Please wait.', ready: false });
    }

    // Return the real error if a recent generation failed (prevents infinite retry storm)
    const lastFail = generationFailed.get(req.user.id);
    if (!force && lastFail && (Date.now() - lastFail.at) < FAILURE_COOLDOWN) {
      return res.status(500).json({ message: `PDF generation failed: ${lastFail.message}` });
    }

    // Clear stale error before a fresh attempt
    generationFailed.delete(req.user.id);

    // Fire-and-forget — LibreOffice can take 30-60 s; don't block the HTTP request
    // pdfGenerator.js handles DELETE+INSERT atomically after successful conversion
    generatingUsers.add(req.user.id);
    console.log(`PDF generation queued for ${req.user.id} (force=${force})`);
    generateOnboardingPDF(req.user.id)
      .then(() => console.log(`✅ PDF ready for ${req.user.id}`))
      .catch(err => {
        console.error(`❌ PDF failed for ${req.user.id}:`, err.message);
        generationFailed.set(req.user.id, { message: err.message, at: Date.now() });
      })
      .finally(() => generatingUsers.delete(req.user.id));

    res.json({ message: 'PDF generation started. Please wait a moment, then download.', ready: false });
  } catch (err) {
    console.error('Manual PDF generation error:', err);
    res.status(500).json({ message: `PDF generation failed: ${err.message}` });
  }
});

// ── GET /api/employee/download-packet ────────────────────────────────────────
router.get('/download-packet', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM documents WHERE user_id=$1 AND type='Onboarding Packet' ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'PDF not ready yet. Please try again in a moment.' });
    const filePath = rows[0].storage_path;
    const fs = require('fs');
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Your PDF has expired or was cleared. Click "Generate PDF" to create a fresh copy.' });
    const userRes = await db.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
    const name = userRes.rows[0]?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'employee';
    logActivity({ userId: req.user.id, eventType: 'pdf_downloaded', description: 'Downloaded onboarding packet PDF' });
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

// ── GET /api/employee/termination-packet ─────────────────────────────────────
router.get('/termination-packet', async (req, res) => {
  try {
    // Check employee has a pending termination
    const termRes = await db.query(
      `SELECT * FROM terminations WHERE user_id=$1 AND status='Pending' ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!termRes.rows[0]) return res.status(404).json({ message: 'No termination packet found.' });

    const { rows } = await db.query(
      `SELECT ts.id, ts.section_order AS "sectionOrder", ts.title, ts.content,
              tsg.signature, tsg.date_signed AS "dateSigned"
       FROM termination_sections ts
       LEFT JOIN termination_signing tsg ON tsg.section_id=ts.id AND tsg.termination_id=$1
       ORDER BY ts.section_order`,
      [termRes.rows[0].id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/employee/termination-packet/:sectionId/sign ────────────────────
router.post('/termination-packet/:sectionId/sign', async (req, res) => {
  const { signature, printedName, date } = req.body;
  if (!signature || !date) return res.status(400).json({ message: 'Signature and date required.' });
  try {
    const termRes = await db.query(
      `SELECT * FROM terminations WHERE user_id=$1 AND status='Pending' ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!termRes.rows[0]) return res.status(404).json({ message: 'No active termination found.' });
    const termId = termRes.rows[0].id;

    await db.query(`
      INSERT INTO termination_signing (termination_id, section_id, signature, printed_name, date_signed, signed_at)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (termination_id, section_id) DO UPDATE
      SET signature=$3, printed_name=$4, date_signed=$5, signed_at=NOW()
    `, [termId, req.params.sectionId, signature, printedName, date]);

    // Check if all termination sections signed
    const check = await db.query(`
      SELECT COUNT(ts.id) AS total,
             COUNT(tsg.id) AS signed
      FROM termination_sections ts
      LEFT JOIN termination_signing tsg ON tsg.section_id=ts.id AND tsg.termination_id=$1
    `, [termId]);

    if (parseInt(check.rows[0].total) === parseInt(check.rows[0].signed)) {
      // Mark termination complete + lock user out
      await db.query(`UPDATE terminations SET status='Complete' WHERE id=$1`, [termId]);
      await db.query(`UPDATE users SET status='Terminated', updated_at=NOW() WHERE id=$1`, [req.user.id]);
      // Generate PDF async
      generateTerminationPDF(req.user.id, termId).catch(console.error);
    }

    res.json({ message: 'Signed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/employee/handbook-status ────────────────────────────────────────
router.get('/handbook-status', async (req, res) => {
  try {
    const fs   = require('fs');
    const path = require('path');
    const { rows } = await db.query(
      'SELECT acknowledged_at FROM handbook_acknowledgements WHERE user_id=$1',
      [req.user.id]
    );
    const handbookPath = path.join(__dirname, '..', 'templates', 'employee_handbook.pdf');
    res.json({
      acknowledged:   !!rows[0],
      acknowledgedAt: rows[0]?.acknowledged_at || null,
      available:      fs.existsSync(handbookPath),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── POST /api/employee/acknowledge-handbook ───────────────────────────────────
router.post('/acknowledge-handbook', async (req, res) => {
  const fs   = require('fs');
  const path = require('path');
  const handbookPath = path.join(__dirname, '..', 'templates', 'employee_handbook.pdf');

  if (!fs.existsSync(handbookPath)) {
    return res.status(404).json({ message: 'Employee handbook PDF not yet uploaded. Please contact HR.' });
  }

  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userRes = await db.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
    const name = userRes.rows[0]?.name || '';

    // Record acknowledgement (upsert — re-downloads just update timestamp)
    await db.query(`
      INSERT INTO handbook_acknowledgements (user_id, ip_address, name_at_time)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) DO UPDATE SET acknowledged_at=NOW(), ip_address=$2
    `, [req.user.id, ip, name]);
    logActivity({ userId: req.user.id, eventType: 'handbook_acknowledged', description: 'Acknowledged & downloaded Employee Handbook', ip });

    const { size } = fs.statSync(handbookPath);
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_') || 'employee';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Employee_Handbook.pdf"`);
    fs.createReadStream(handbookPath).pipe(res);
  } catch (err) {
    console.error('Handbook download error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/employee/documents ───────────────────────────────────────────────
router.get('/documents', async (req, res) => {
  try {
    const fs   = require('fs');
    const path = require('path');

    const [packetRes, handbookRes] = await Promise.all([
      db.query(
        `SELECT storage_path, date_completed FROM documents
         WHERE user_id=$1 AND type='Onboarding Packet' ORDER BY created_at DESC LIMIT 1`,
        [req.user.id]
      ),
      db.query(
        'SELECT acknowledged_at FROM handbook_acknowledgements WHERE user_id=$1',
        [req.user.id]
      ),
    ]);

    const handbookPath = path.join(__dirname, '..', 'templates', 'employee_handbook.pdf');

    res.json({
      packet: {
        ready:         !!(packetRes.rows[0] && fs.existsSync(packetRes.rows[0].storage_path)),
        dateCompleted: packetRes.rows[0]?.date_completed || null,
      },
      handbook: {
        available:     fs.existsSync(handbookPath),
        acknowledged:  !!handbookRes.rows[0],
        acknowledgedAt: handbookRes.rows[0]?.acknowledged_at || null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ── GET /api/employee/termination-packet/download ─────────────────────────────
router.get('/termination-packet/download', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT * FROM documents WHERE user_id=$1 AND type='Termination Packet' ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'PDF not ready yet.' });
    const filePath = rows[0].storage_path;
    const fs = require('fs');
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'PDF file not found.' });
    const userRes = await db.query('SELECT name FROM users WHERE id=$1', [req.user.id]);
    const name = userRes.rows[0]?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'employee';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}_Termination_Packet.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
