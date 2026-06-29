const path        = require('path');
const fs          = require('fs');
const PDFDocument = require('pdfkit');
const db          = require('../models/db');
const { sendEmail }    = require('./email');
const { injectFields } = require('./injectFields');

const PDF_DIR  = path.join(__dirname, '..', 'pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

// ── Brand constants ────────────────────────────────────────────────────────────
const RED  = '#9e0000';
const DARK = '#141d23';
const GREY = '#555555';
const W    = 612;
const ML   = 50;
const MR   = 50;
const TW   = W - ML - MR; // 512

// ── Calligraphy font ───────────────────────────────────────────────────────────
// Prefer script fonts that look genuinely hand-signed; fall back gracefully.
const _detectCaliFont = () => {
  const candidates = [
    path.join(__dirname, '..', 'fonts', 'DancingScript-Regular.ttf'),
    path.join(__dirname, '..', 'fonts', 'GreatVibes-Regular.ttf'),
    'C:\\Windows\\Fonts\\FREESCPT.TTF',   // Freestyle Script
    'C:\\Windows\\Fonts\\ITCEDSCR.TTF',   // Edwardian Script ITC
    'C:\\Windows\\Fonts\\MTCORSVA.TTF',   // Monotype Corsiva
    'C:\\Windows\\Fonts\\Gabriola.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
  ];
  for (const fp of candidates) {
    try { if (fs.existsSync(fp)) return fp; } catch { /* ignore */ }
  }
  return 'Helvetica-Oblique';
};
const CALI_FONT = _detectCaliFont();

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (d, opts = { month: 'long', day: 'numeric', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-US', opts) : '—';

const money = (v) => (v ? `$${Number(v).toFixed(2)}/hr` : '—');

// Full-width red bar used at top of every section page
const pageHeader = (doc, line1, line2) => {
  doc.rect(0, 0, W, 52).fill(RED);
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9)
     .text(line1, ML, 9, { width: TW });
  doc.font('Helvetica-Bold').fontSize(13)
     .text(line2, ML, 24, { width: TW });
};

// Label + value row in a two-column info grid
const infoRow = (doc, x, y, label, value, colW = 240) => {
  doc.fillColor(GREY).font('Helvetica-Bold').fontSize(8.5)
     .text(label, x, y, { width: 95, lineBreak: false });
  doc.fillColor(DARK).font('Helvetica').fontSize(8.5)
     .text(value || '—', x + 98, y, { width: colW - 100, lineBreak: false });
};

// ── Markdown table support ─────────────────────────────────────────────────────

const isTableLine = (line) => { const t = line.trim(); return t.startsWith('|') && t.length > 1; };

const isSepLine = (line) => {
  const inner = line.trim().replace(/\|/g, '').trim();
  return inner.length > 0 && /^[-:\s]+$/.test(inner);
};

const renderMarkdownTable = (doc, tableLines, y) => {
  const rows = [];
  for (const line of tableLines) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    if (isSepLine(t)) continue;
    const raw   = t.startsWith('|') && t.endsWith('|') ? t.slice(1, -1) : t.slice(1);
    const cells = raw.split('|').map(c => c.trim());
    if (cells.some(c => c.length > 0)) rows.push(cells);
  }
  if (rows.length === 0) return y;

  const flat = rows.flat().join(' ').toLowerCase();
  if (/employee signature|printed name/.test(flat)) return y; // handled by sigBlock
  if (rows.every(r => r.every(c => !c))) return y;

  const colCount = Math.max(...rows.map(r => r.length));
  y += 6;

  if (colCount <= 2) {
    for (const row of rows) {
      const [key = '', val = ''] = row;
      if (!key && !val) { y += 3; continue; }
      const kH = key ? doc.heightOfString(key, { width: 155, fontSize: 9.5 }) : 12;
      const vH = val ? doc.heightOfString(val, { width: TW - 168, fontSize: 9.5 }) : 12;
      const h  = Math.max(kH, vH) + 5;
      if (y + h > doc.page.height - 140) { doc.addPage(); doc.rect(0,0,W,18).fill(RED); y = 26; }
      if (key) doc.fillColor(GREY).font('Helvetica-Bold').fontSize(9.5).text(key, ML + 4, y, { width: 155, lineBreak: false });
      if (val) doc.fillColor(DARK).font('Helvetica').fontSize(9.5).text(val, ML + 164, y, { width: TW - 168 });
      y += h;
    }
  } else {
    const isNumbered = rows.length > 0 && /^\d+$/.test(rows[0][0] || '');
    for (const cells of rows) {
      if (cells.every(c => !c)) { y += 3; continue; }
      let text;
      if (isNumbered && /^\d+$/.test(cells[0] || '')) {
        const desc = cells.slice(1).filter(c => c && !/^Initials/i.test(c)).join(' — ');
        text = `${cells[0]}.  ${desc}`;
      } else {
        text = cells.filter(c => c && !/^Initials/i.test(c)).join('   ');
      }
      if (!text.trim()) continue;
      const h = doc.heightOfString(text, { width: TW - 14, fontSize: 9.5 }) + 4;
      if (y + h > doc.page.height - 140) { doc.addPage(); doc.rect(0,0,W,18).fill(RED); y = 26; }
      doc.fillColor(DARK).font('Helvetica').fontSize(9.5).text(text, ML + 14, y, { width: TW - 14 });
      y += h;
    }
  }
  return y + 4;
};

// ── Content preprocessing ──────────────────────────────────────────────────────

// Strips the trailing Employee Acknowledgement markdown table and fills HR info
const preprocessContent = (content, hrUser) => {
  if (!content) return '';

  if (hrUser?.name) {
    content = content
      .replace(/((?:^|\|\s*)Name:\s*)_{5,}/gm,  `$1${hrUser.name}`)
      .replace(/(Title:\s*)_{5,}/gm,              `$1Human Resources`);
  }

  // Strip "Employee Acknowledgement & Signature:" block when followed by a markdown table
  const lines = content.split('\n');
  let cutIdx  = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^Employee Acknowledgement\s*[&]?\s*Signature/i.test(lines[i].trim())) {
      for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
        if (lines[j].trim().startsWith('|')) { cutIdx = i; break; }
      }
    }
  }
  if (cutIdx !== -1) {
    while (cutIdx > 0 && !lines[cutIdx - 1].trim()) cutIdx--;
    return lines.slice(0, cutIdx).join('\n').trimEnd();
  }
  return content.trimEnd();
};

// ── Body text renderer ─────────────────────────────────────────────────────────

const renderContent = (doc, text, startY) => {
  let y = startY;
  const lines = (text || '').split('\n');
  let tableBuffer = [];

  const flushTable = () => {
    if (tableBuffer.length > 0) { y = renderMarkdownTable(doc, tableBuffer, y); tableBuffer = []; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (isTableLine(line) || (line.trim() && isSepLine(line))) { tableBuffer.push(line); continue; }
    flushTable();
    if (!line) { y += 5; continue; }

    const needH = doc.heightOfString(line, { width: TW, fontSize: 9.5 }) + 4;
    if (y + needH > doc.page.height - 140) { doc.addPage(); doc.rect(0,0,W,18).fill(RED); y = 26; }

    if (/^#{1,3}\s/.test(line)) {
      doc.fillColor(RED).font('Helvetica-Bold').fontSize(10).text(line.replace(/^#+\s*/, ''), ML, y, { width: TW }); y += 15;
    } else if (/^[-•]\s/.test(line) || /^\d+\.\s/.test(line)) {
      const isBullet = /^[-•]/.test(line);
      const mark     = isBullet ? '•' : line.match(/^(\d+\.)/)[1];
      const body     = line.replace(/^[-•\d.]\s+/, '');
      const bH       = doc.heightOfString(body, { width: TW - 22, fontSize: 9.5 });
      doc.fillColor(DARK).font('Helvetica').fontSize(9.5)
         .text(mark, ML + 8, y, { width: 14, lineBreak: false })
         .text(body, ML + 22, y, { width: TW - 22 });
      y += bH + 4;
    } else {
      const lH = doc.heightOfString(line, { width: TW, fontSize: 9.5 });
      doc.fillColor(DARK).font('Helvetica').fontSize(9.5).text(line, ML, y, { width: TW });
      y += lH + 4;
    }
  }
  flushTable();
  return y;
};

// ── Employee signature block ───────────────────────────────────────────────────
const sigBlock = (doc, y, section) => {
  const H = 120;
  if (y + H > doc.page.height - 60) { doc.addPage(); y = 44; }
  y += 14;

  doc.rect(ML, y, TW, H).fill('#f7f7f7');
  doc.strokeColor('#ccc').lineWidth(0.5).rect(ML, y, TW, H).stroke();

  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5)
     .text('Employee Acknowledgement & Signature', ML + 10, y + 8, { width: TW - 20 });

  // Calligraphy signature
  if (section.signature) {
    doc.fillColor('#1a1a5c').font(CALI_FONT).fontSize(22)
       .text(section.signature, ML + 10, y + 24, { width: 240, lineBreak: false });
  }
  doc.moveTo(ML + 10,  y + 56).lineTo(ML + 252, y + 56).strokeColor('#999').lineWidth(0.7).stroke();
  doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text('Employee Signature', ML + 10, y + 59);

  // Date
  if (section.date_signed) {
    doc.fillColor(DARK).font('Helvetica').fontSize(9.5)
       .text(fmt(section.date_signed, { month: 'short', day: 'numeric', year: 'numeric' }), ML + 272, y + 36, { lineBreak: false });
  }
  doc.moveTo(ML + 272, y + 56).lineTo(TW + ML - 10, y + 56).strokeColor('#999').lineWidth(0.7).stroke();
  doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text('Date', ML + 272, y + 59);

  // Printed name
  if (section.printed_name) {
    doc.fillColor(DARK).font('Helvetica').fontSize(9.5)
       .text(section.printed_name, ML + 10, y + 74, { width: 240, lineBreak: false });
  }
  doc.moveTo(ML + 10,  y + 92).lineTo(ML + 252, y + 92).strokeColor('#999').lineWidth(0.7).stroke();
  doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text('Printed Name', ML + 10, y + 95);

  // Audit trail
  const meta = [
    section.ip_address ? `IP: ${section.ip_address}` : null,
    section.signed_at  ? `Signed: ${new Date(section.signed_at).toLocaleString()}` : null,
  ].filter(Boolean).join('   |   ');
  if (meta) {
    doc.fillColor('#aaa').font('Helvetica').fontSize(7)
       .text(meta, ML + 10, y + 106, { width: TW - 20 });
  }
  return y + H + 10;
};

// ── Employer authorization block (bilateral sections) ─────────────────────────
const hrSigBlock = (doc, y, hrUser) => {
  if (!hrUser) return y;
  const H = 88;
  if (y + H > doc.page.height - 40) { doc.addPage(); y = 44; }
  y += 10;

  doc.rect(ML, y, TW, H).fill('#fff5f5');
  doc.strokeColor(RED).lineWidth(0.4).rect(ML, y, TW, H).stroke();

  doc.fillColor(RED).font('Helvetica-Bold').fontSize(9.5)
     .text('Employer Authorization', ML + 10, y + 8, { width: TW - 20 });

  // HR name (pre-filled)
  doc.fillColor(DARK).font('Helvetica').fontSize(9.5)
     .text(hrUser.name, ML + 10, y + 28, { width: 240, lineBreak: false });
  doc.moveTo(ML + 10, y + 46).lineTo(ML + 252, y + 46).strokeColor('#999').lineWidth(0.7).stroke();
  doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text('Authorized Representative', ML + 10, y + 49);

  // Signature line (blank for wet signature)
  doc.moveTo(ML + 272, y + 46).lineTo(TW + ML - 10, y + 46).strokeColor('#999').lineWidth(0.7).stroke();
  doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text('Signature', ML + 272, y + 49);

  doc.fillColor(DARK).font('Helvetica').fontSize(9.5)
     .text('Human Resources  ·  Angel Trans LLC', ML + 10, y + 64, { width: TW - 20 });

  return y + H + 8;
};

// Draw a vector checkmark — no font/encoding issues
const drawCheckmark = (doc, cx, cy, size, color) => {
  doc.save()
     .strokeColor(color || '#1a7a1a')
     .lineWidth(size * 0.14)
     .lineJoin('round')
     .lineCap('round')
     .moveTo(cx - size * 0.32, cy)
     .lineTo(cx - size * 0.02, cy + size * 0.32)
     .lineTo(cx + size * 0.38, cy - size * 0.32)
     .stroke()
     .restore();
};

// ── Section 28: Completion Checklist (grid table) ─────────────────────────────
const renderCompletionChecklist = (doc, startY, allSections, section, hrUser, details) => {
  // Rows are sections 1-27 (all except the checklist itself)
  const rows = allSections.filter(s => s.section_number < 28 || !/completion checklist/i.test(s.title));

  let y = startY;

  // Intro text
  doc.fillColor(GREY).font('Helvetica').fontSize(9)
     .text('Use this page to confirm all sections have been reviewed and signed. HR should retain a completed copy of this checklist in the employee personnel file.',
           ML, y, { width: TW }); y += 28;

  // ── Table layout ────────────────────────────────────────────────
  // Columns: #(28) | Document/Section(354) | Signed(70) | HR Init(60)
  const COL = { num: ML, title: ML + 28, emp: ML + 382, hr: ML + 452 };
  const CW  = { num: 28, title: 354, emp: 70, hr: 60 };

  const drawHeader = (hy) => {
    doc.rect(ML, hy, TW, 20).fill(DARK);
    [
      [COL.num,   CW.num,   '#',                  'left'],
      [COL.title, CW.title, 'Document / Section', 'left'],
      [COL.emp,   CW.emp,   'Signed',             'center'],
      [COL.hr,    CW.hr,    'HR Init.',           'center'],
    ].forEach(([x, w, label, align]) => {
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8.5)
         .text(label, x + 3, hy + 6, { width: w - 6, lineBreak: false, align });
    });
    return hy + 20;
  };

  y = drawHeader(y);

  rows.forEach((s, idx) => {
    const titleH = doc.heightOfString(s.title, { width: CW.title - 8, fontSize: 8 });
    const rowH   = Math.max(16, titleH + 6);

    if (y + rowH > doc.page.height - 150) {
      doc.addPage();
      doc.rect(0, 0, W, 18).fill(RED);
      y = 26;
      y = drawHeader(y);
    }

    // Alternating row background
    doc.rect(ML, y, TW, rowH).fill(idx % 2 === 0 ? '#f8f8f8' : '#ffffff');

    // # column
    doc.fillColor(GREY).font('Helvetica-Bold').fontSize(8.5)
       .text(s.section_number.toString(), COL.num + 3, y + (rowH - 10) / 2,
             { width: CW.num - 6, lineBreak: false, align: 'center' });

    // Title column
    doc.fillColor(DARK).font('Helvetica').fontSize(8)
       .text(s.title, COL.title + 4, y + 4, { width: CW.title - 8 });

    // Employee signed — vector checkmark (no font encoding issues)
    const checkCX = COL.emp + CW.emp / 2;
    const checkCY = y + rowH / 2;
    drawCheckmark(doc, checkCX, checkCY, 9);

    // HR initials line
    const hrLineY = y + rowH - 5;
    doc.moveTo(COL.hr + 8, hrLineY).lineTo(COL.hr + CW.hr - 8, hrLineY)
       .strokeColor('#bbb').lineWidth(0.5).stroke();

    // Row bottom border
    doc.moveTo(ML, y + rowH).lineTo(ML + TW, y + rowH)
       .strokeColor('#e5e5e5').lineWidth(0.3).stroke();

    // Vertical column dividers
    [COL.title, COL.emp, COL.hr].forEach(cx => {
      doc.moveTo(cx, y).lineTo(cx, y + rowH)
         .strokeColor('#e5e5e5').lineWidth(0.3).stroke();
    });

    y += rowH;
  });

  y += 20;

  // ── HR Representative box ────────────────────────────────────────
  const hrBoxH = 78;
  if (y + hrBoxH > doc.page.height - 80) { doc.addPage(); y = 44; }

  doc.rect(ML, y, TW, hrBoxH).fill('#fff5f5');
  doc.strokeColor(RED).lineWidth(0.5).rect(ML, y, TW, hrBoxH).stroke();

  doc.fillColor(RED).font('Helvetica-Bold').fontSize(9.5)
     .text('HR Representative Completing Orientation', ML + 10, y + 8, { width: TW - 20 });

  const sigY = y + 28;

  // Name (pre-filled)
  if (hrUser?.name) {
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10)
       .text(hrUser.name, ML + 10, sigY - 2, { width: 180, lineBreak: false });
  }
  doc.moveTo(ML + 10, sigY + 16).lineTo(ML + 195, sigY + 16).strokeColor('#999').lineWidth(0.7).stroke();
  doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text('HR Representative', ML + 10, sigY + 19);

  // Date (date packet was sent to employee)
  const sentDate = details?.date_sent ? fmt(details.date_sent) : '—';
  doc.fillColor(DARK).font('Helvetica').fontSize(10)
     .text(sentDate, ML + 212, sigY - 2, { width: 130, lineBreak: false });
  doc.moveTo(ML + 210, sigY + 16).lineTo(ML + 340, sigY + 16).strokeColor('#999').lineWidth(0.7).stroke();
  doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text('Date Issued', ML + 210, sigY + 19);

  // HR calligraphy signature
  if (hrUser?.name) {
    doc.fillColor('#1a1a5c').font(CALI_FONT).fontSize(22)
       .text(hrUser.name, ML + 352, sigY - 10, { width: TW - 362, lineBreak: false });
  }
  doc.moveTo(ML + 350, sigY + 16).lineTo(ML + TW - 10, sigY + 16).strokeColor('#999').lineWidth(0.7).stroke();
  doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text('Signature', ML + 350, sigY + 19);

  y += hrBoxH + 14;

  // Company footer line
  doc.fillColor(GREY).font('Helvetica').fontSize(7.5)
     .text('Angel Trans LLC  •  1333 Howe Ave, #201, Sacramento, CA 95825  •  (916) 259-3249  •  hr@angeltransllc.com',
           ML, y, { width: TW, align: 'center' });
  y += 14;

  return y;
};

// ── Generate Onboarding PDF ────────────────────────────────────────────────────
const generateOnboardingPDF = async (userId) => {
  const [userRes, detailRes, sectionsRes, hrRes] = await Promise.all([
    db.query('SELECT * FROM users WHERE id=$1', [userId]),
    db.query(`SELECT ed.*, u.name, u.email
              FROM employee_details ed JOIN users u ON u.id=ed.user_id
              WHERE ed.user_id=$1`, [userId]),
    db.query(`SELECT s.section_number, s.title, s.content,
                     es.signature, es.printed_name, es.date_signed,
                     es.signed_at, es.ip_address
              FROM sections s
              JOIN employee_sections es ON es.section_id=s.id AND es.user_id=$1
              WHERE es.status='Completed'
              ORDER BY s.section_number`, [userId]),
    db.query(`SELECT u.name, u.email
              FROM users u
              JOIN employee_details ed ON ed.created_by = u.id
              WHERE ed.user_id = $1`, [userId]),
  ]);

  const user     = userRes.rows[0];
  const details  = detailRes.rows[0];
  const sections = sectionsRes.rows;
  const hrUser   = hrRes.rows[0] || null;

  if (!user)    throw new Error(`User ${userId} not found`);
  if (!details) throw new Error(`Employee details not found for user ${userId}`);

  const fileName   = `onboarding_${userId}_${Date.now()}.pdf`;
  const outputPath = path.join(PDF_DIR, fileName);

  await new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'LETTER', autoFirstPage: true,
                                     margins: { top: 50, bottom: 50, left: ML, right: MR } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error',  reject);

    const startDate = fmt(details.start_date);
    const dateSent  = fmt(details.date_sent || new Date());

    // ── COVER PAGE ─────────────────────────────────────────────────
    doc.rect(0, 0, W, 60).fill(RED);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(20)
       .text('Angel Trans LLC', ML, 16, { width: TW });
    doc.font('Helvetica').fontSize(9)
       .text('Employee Orientation Packet — Signed Copy', ML, 40, { width: TW });

    let y = 78;
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(20)
       .text('Orientation & Onboarding Packet', ML, y, { width: TW, align: 'center' }); y += 32;
    doc.fillColor(GREY).font('Helvetica').fontSize(11)
       .text('Signed Copy — Confidential', ML, y, { width: TW, align: 'center' }); y += 22;
    doc.moveTo(ML, y).lineTo(W - MR, y).strokeColor(RED).lineWidth(1.5).stroke(); y += 20;

    // Info grid — 4 rows × 2 columns
    const rH   = 22;
    const boxH = 12 + 4 * rH + 16; // 116
    doc.rect(ML, y, TW, boxH).fill('#f9f9f9');
    doc.strokeColor('#e0e0e0').lineWidth(0.5).rect(ML, y, TW, boxH).stroke();

    const iy = y + 12;
    [
      ['Employee Name',   user.name],
      ['Job Title',       details.job_title],
      ['Employment Type', details.employment_type],
      ['Start Date',      startDate],
    ].forEach(([l, v], i) => infoRow(doc, ML + 12,  iy + i * rH, l, v));
    [
      ['Hourly Rate',    money(details.hourly_rate)],
      ['Overtime Rate',  money(details.overtime_rate)],
      ['Department',     details.department],
      ['Direct Manager', details.manager],
    ].forEach(([l, v], i) => infoRow(doc, ML + 262, iy + i * rH, l, v));

    y += boxH + 10;

    if (hrUser) {
      doc.fillColor(GREY).font('Helvetica').fontSize(8.5)
         .text(`HR Representative: ${hrUser.name}   ·   hr@angeltransllc.com`, ML, y,
               { width: TW, align: 'center' }); y += 16;
    }

    doc.fillColor(DARK).font('Helvetica').fontSize(10.5)
       .text(`This packet contains ${sections.length} completed and signed sections.`, ML, y,
             { width: TW, align: 'center' }); y += 18;
    doc.fillColor(GREY).font('Helvetica').fontSize(9)
       .text(`Date Issued: ${dateSent}   ·   Generated: ${fmt(new Date())}`, ML, y,
             { width: TW, align: 'center' });

    // ── SECTIONS ───────────────────────────────────────────────────
    sections.forEach((section) => {
      const isChecklist = section.section_number === 28 ||
                          /completion checklist/i.test(section.title);

      doc.addPage();
      pageHeader(doc, `SECTION ${section.section_number} OF ${sections.length}`, section.title);

      let sy = 62;

      if (isChecklist) {
        // Render dynamic grid table + HR rep box; then employee sig
        sy = renderCompletionChecklist(doc, sy, sections, section, hrUser, details);
        sigBlock(doc, sy, section);
      } else {
        const raw      = preprocessContent(section.content, hrUser);
        const injected = injectFields(
          raw,
          { ...details, name: user.name, email: user.email },
          section.date_signed
        );
        sy = renderContent(doc, injected, sy);

        // Bilateral offer: add employer authorization block before employee sig
        if (section.section_number === 1 && hrUser) {
          sy = hrSigBlock(doc, sy, hrUser);
        }

        sigBlock(doc, sy, section);
      }
    });

    doc.end();
  });

  // Replace old DB record
  await db.query(`DELETE FROM documents WHERE user_id=$1 AND type='Onboarding Packet'`, [userId]);
  await db.query(
    `INSERT INTO documents (user_id, type, storage_path, date_completed) VALUES ($1,'Onboarding Packet',$2,CURRENT_DATE)`,
    [userId, outputPath]
  );
  await db.query(`UPDATE users SET status='Active', updated_at=NOW() WHERE id=$1`, [userId]);

  const empHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;">
      <div style="background:#9e0000;padding:20px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;">Angel Trans LLC</h1>
      </div>
      <div style="padding:24px;">
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Congratulations! You have successfully completed your orientation packet. Your status is now <strong>Active</strong>.</p>
        <p>— Angel Trans LLC HR &nbsp;·&nbsp; hr@angeltransllc.com &nbsp;·&nbsp; (916) 259-3249</p>
      </div>
    </div>`;
  await Promise.all([
    sendEmail({ to: user.email, subject: 'Onboarding Complete — Angel Trans LLC', html: empHtml }),
    sendEmail({ to: process.env.HR_EMAIL || 'hr@angeltransllc.com',
      subject: `Onboarding Complete — ${user.name}`,
      html: `<p><strong>${user.name}</strong> completed all sections. Status → Active.</p>` }),
  ]).catch(e => console.warn('Email failed (non-blocking):', e.message));

  console.log(`✅ Onboarding PDF generated: ${fileName}`);
  return outputPath;
};

// ── Generate Termination PDF ───────────────────────────────────────────────────
const generateTerminationPDF = async (userId, terminationId) => {
  const [userRes, detailRes, sigRes, termRes] = await Promise.all([
    db.query('SELECT * FROM users WHERE id=$1', [userId]),
    db.query(`SELECT ed.*, u.name, u.email FROM employee_details ed
              JOIN users u ON u.id=ed.user_id WHERE ed.user_id=$1`, [userId]),
    db.query(`SELECT ts.section_order, ts.title, ts.content,
                     tsg.signature, tsg.printed_name, tsg.date_signed, tsg.signed_at
              FROM termination_sections ts
              JOIN termination_signing tsg ON tsg.section_id=ts.id AND tsg.termination_id=$1
              ORDER BY ts.section_order`, [terminationId]),
    db.query('SELECT * FROM terminations WHERE id=$1', [terminationId]),
  ]);

  const user     = userRes.rows[0];
  const details  = detailRes.rows[0];
  const sections = sigRes.rows;
  const term     = termRes.rows[0];

  if (!user) throw new Error(`User ${userId} not found`);

  const fileName   = `termination_${userId}_${Date.now()}.pdf`;
  const outputPath = path.join(PDF_DIR, fileName);

  await new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'LETTER', margins: { top: 60, bottom: 60, left: 60, right: 60 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error',  reject);

    const R = '#9e0000', D = '#141d23', G = '#5a5a5a', PML = 60, PTW = 492;

    doc.rect(0, 0, W, 50).fill(R);
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(16).text('Angel Trans LLC', PML, 14);
    doc.font('Helvetica').fontSize(10).text('Employee Termination Packet — Signed Copy', PML, 32);

    let y = 70;
    doc.fillColor(D).font('Helvetica-Bold').fontSize(18).text('Termination Packet', PML, y); y += 30;
    doc.fillColor(G).font('Helvetica').fontSize(11).text('Signed Copy — Confidential', PML, y); y += 30;

    [
      ['Employee',       user.name],
      ['Job Title',      details?.job_title || '—'],
      ['Effective Date', term?.effective_date ? new Date(term.effective_date).toLocaleDateString() : '—'],
      ['Final Pay Date', term?.final_pay_date ? new Date(term.final_pay_date).toLocaleDateString() : '—'],
      ['Reason',         term?.reason || '—'],
      ['Generated',      new Date().toLocaleDateString()],
    ].forEach(([label, value], i) => {
      if (i % 2 === 0) doc.rect(PML, y - 3, PTW, 22).fill('#f5f5f5');
      doc.fillColor(G).font('Helvetica-Bold').fontSize(10).text(label, PML + 6, y + 2);
      doc.fillColor(D).font('Helvetica').fontSize(10).text(value || '—', PML + 160, y + 2, { width: PTW - 165 });
      y += 22;
    });

    sections.forEach(s => {
      doc.addPage();
      doc.rect(0, 0, W, 46).fill(R);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10).text(`SECTION ${s.section_order}`, PML, 8);
      doc.font('Helvetica-Bold').fontSize(12).text(s.title, PML, 24, { width: PTW });

      let sy = 64;
      (s.content || '').split('\n').forEach(line => {
        const t = line.trim();
        if (!t) { sy += 5; return; }
        const h = doc.heightOfString(t, { width: PTW, fontSize: 9.5 });
        if (sy + h > doc.page.height - 90) { doc.addPage(); sy = 44; }
        if (t.startsWith('-') || t.startsWith('•')) {
          doc.fillColor(D).font('Helvetica').fontSize(9.5)
             .text('•', PML + 8, sy, { width: 12 })
             .text(t.replace(/^[-•]\s+/, ''), PML + 22, sy, { width: PTW - 22 });
        } else {
          doc.fillColor(D).font('Helvetica').fontSize(9.5).text(t, PML, sy, { width: PTW });
        }
        sy += h + 5;
      });

      if (sy + 130 > doc.page.height - 60) { doc.addPage(); sy = 44; }
      sy += 12;
      doc.rect(PML, sy, PTW, 120).fill('#f5f5f5')
         .rect(PML, sy, PTW, 120).strokeColor('#ccc').lineWidth(0.5).stroke();
      doc.fillColor(D).font('Helvetica-Bold').fontSize(10).text('Employee Acknowledgement & Signature:', PML + 8, sy + 10);
      if (s.signature) {
        doc.fillColor('#1a1a5c').font(CALI_FONT).fontSize(22)
           .text(s.signature, PML + 8, sy + 26, { width: 280, lineBreak: false });
      }
      doc.moveTo(PML + 8, sy + 56).lineTo(PML + 280, sy + 56).strokeColor('#888').lineWidth(0.75).stroke();
      doc.fillColor(G).font('Helvetica').fontSize(8).text('Employee Signature', PML + 8, sy + 60);
      if (s.date_signed) {
        doc.fillColor(D).font('Helvetica').fontSize(10)
           .text(new Date(s.date_signed).toLocaleDateString(), PML + 300, sy + 36);
      }
      doc.moveTo(PML + 300, sy + 56).lineTo(PTW + PML, sy + 56).strokeColor('#888').lineWidth(0.75).stroke();
      doc.fillColor(G).font('Helvetica').fontSize(8).text('Date', PML + 300, sy + 60);
      if (s.printed_name) {
        doc.fillColor(D).font('Helvetica').fontSize(10).text(s.printed_name, PML + 8, sy + 76);
      }
      doc.moveTo(PML + 8, sy + 96).lineTo(PML + 280, sy + 96).strokeColor('#888').lineWidth(0.75).stroke();
      doc.fillColor(G).font('Helvetica').fontSize(8).text('Printed Name', PML + 8, sy + 100);
    });

    doc.end();
  });

  await db.query(
    `INSERT INTO documents (user_id, type, storage_path, date_completed) VALUES ($1,'Termination Packet',$2,CURRENT_DATE)`,
    [userId, outputPath]
  );
  await Promise.all([
    sendEmail({ to: user.email, subject: 'Angel Trans LLC — Termination Documents',
      html: `<p>Hi ${user.name}, your termination documents have been signed and saved.</p>` }),
    sendEmail({ to: process.env.HR_EMAIL || 'hr@angeltransllc.com',
      subject: `Termination Signed — ${user.name}`,
      html: `<p>${user.name} signed all termination documents.</p>` }),
  ]).catch(e => console.warn('Email failed:', e.message));

  console.log(`✅ Termination PDF: ${fileName}`);
  return outputPath;
};

module.exports = { generateOnboardingPDF, generateTerminationPDF };
