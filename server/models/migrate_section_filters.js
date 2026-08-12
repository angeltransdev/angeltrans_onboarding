require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

const GENERIC_CONTENT = `GENERAL POSITION DESCRIPTION

Angel Trans LLC

POSITION OVERVIEW

Welcome to Angel Trans LLC. This document outlines the general expectations and responsibilities for your role as a member of our support and operations team.

Angel Trans LLC provides professional non-emergency medical transportation (NEMT) services throughout the Sacramento area. Our success depends on the dedication and professionalism of every team member, whether in the field or behind the scenes.

CORE RESPONSIBILITIES

Depending on your specific role, your duties will include one or more of the following:

Dispatcher:
- Coordinate and schedule patient transportation requests with efficiency and accuracy.
- Communicate with drivers, healthcare facilities, and patients to ensure timely pickups and drop-offs.
- Monitor vehicle locations and route progress throughout each shift.
- Handle incoming calls professionally and resolve scheduling issues in a timely manner.
- Maintain accurate transportation logs and dispatch records.
- Report incidents, complaints, or unusual situations to management promptly.
- Coordinate with drivers to manage route changes, delays, or emergencies.

Office / Administrative Staff:
- Support day-to-day administrative operations of Angel Trans LLC.
- Assist with employee onboarding documentation, recordkeeping, and HR coordination.
- Manage communications with patients, healthcare partners, and vendors professionally.
- Maintain organized, accurate records of company documents and transactions.
- Assist management with scheduling, compliance tasks, and reporting.
- Handle billing, invoicing, or patient account management as assigned.
- Support other departments as needed to ensure smooth company operations.

GENERAL EXPECTATIONS FOR ALL EMPLOYEES

Regardless of role, all Angel Trans LLC team members are expected to:

- Maintain the highest standards of professionalism, reliability, and integrity.
- Protect the privacy and confidentiality of all patient information in accordance with HIPAA.
- Comply with all company policies, procedures, and applicable laws and regulations.
- Communicate respectfully and effectively with teammates, management, patients, and external partners.
- Report to work on time and maintain consistent attendance.
- Complete all required training and certifications as directed by management.
- Notify management promptly of any concerns, conflicts, or workplace issues.
- Support a safe, respectful, and inclusive workplace environment.

COMPENSATION & SCHEDULE

Your compensation and schedule details are outlined in your Conditional Offer of Employment. All employees are compensated in accordance with California wage and hour laws.

We are an Equal Opportunity Employer. All qualified applicants and employees will receive consideration for employment without regard to age, national origin, race, color, disability, religious beliefs, sexual orientation, or any other protected class status.

By signing below, I acknowledge that I have received, read, and understood this General Position Description and the expectations outlined herein.`;

(async () => {
  try {
    // Add display_order column (controls sort position shown to the employee)
    await db.query(`
      ALTER TABLE sections
        ADD COLUMN IF NOT EXISTS display_order   INTEGER,
        ADD COLUMN IF NOT EXISTS job_title_filter VARCHAR(50) DEFAULT NULL
    `);
    console.log('✅ Columns added');

    // Back-fill display_order = section_number for all existing rows
    await db.query(`UPDATE sections SET display_order = section_number WHERE display_order IS NULL`);
    console.log('✅ display_order back-filled');

    // Tag section 2 — NEMT Driver only
    await db.query(`UPDATE sections SET job_title_filter='NEMT Driver' WHERE section_number=2`);
    // Tag section 3 — EMT only
    await db.query(`UPDATE sections SET job_title_filter='EMT' WHERE section_number=3`);
    console.log('✅ Sections 2 & 3 tagged');

    // Insert the generic "others" section — display_order=2 so it slots between S1 and S4
    await db.query(`
      INSERT INTO sections (section_number, title, content, has_initials, job_title_filter, display_order)
      VALUES (29, 'General Position Description', $1, FALSE, 'other', 2)
      ON CONFLICT (section_number) DO UPDATE
        SET title             = EXCLUDED.title,
            content           = EXCLUDED.content,
            job_title_filter  = EXCLUDED.job_title_filter,
            display_order     = EXCLUDED.display_order
    `, [GENERIC_CONTENT]);
    console.log('✅ Generic Position Description section inserted (section_number=29, display_order=2)');

    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
