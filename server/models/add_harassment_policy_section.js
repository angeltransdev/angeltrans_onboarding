// Adds Section 30 — Sexual Harassment, Discrimination & Retaliation Prevention Policy.
// Applies to ALL employees (no employment_classification_filter / job_title_filter).
// Run once: node server/models/add_harassment_policy_section.js

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

const CONTENT = `SEXUAL HARASSMENT, DISCRIMINATION & RETALIATION PREVENTION POLICY

Angel Trans LLC

POLICY STATEMENT

Angel Trans LLC is committed to providing a work environment free of harassment, discrimination, and retaliation. We do not tolerate harassment or discrimination of any kind — based on race, religious creed, color, national origin, ancestry, physical or mental disability, medical condition, genetic information, marital status, sex, gender, gender identity, gender expression, age, sexual orientation, veteran or military status, or any other characteristic protected by California or federal law. This policy applies to all employees, applicants, interns, volunteers, and contractors, and to conduct by supervisors, coworkers, and third parties (such as vendors, patients, or clients) encountered in the course of work.

WHAT IS PROHIBITED

Prohibited sexual harassment includes unwelcome sexual advances, requests for sexual favors, and other verbal, visual, or physical conduct of a sexual nature when:

1. Submission to the conduct is made either explicitly or implicitly a term or condition of employment;
2. Submission to or rejection of the conduct is used as the basis for an employment decision affecting the individual (quid pro quo harassment); or
3. The conduct has the purpose or effect of unreasonably interfering with an individual's work performance or creating an intimidating, hostile, or offensive working environment (hostile work environment harassment).

Examples of conduct that may violate this policy include, but are not limited to: unwanted physical contact; sexual jokes, comments, or innuendo; displaying sexually suggestive images or objects; repeated unwanted requests for dates; derogatory or demeaning comments based on a protected characteristic; and retaliation against anyone who reports a concern or participates in an investigation.

This policy also prohibits discrimination and harassment based on any other protected characteristic listed above, and prohibits retaliation against any employee for reporting a good-faith concern, opposing a practice prohibited by this policy, or participating in a related investigation or proceeding.

REPORTING PROCEDURE

Any employee who believes they have experienced or witnessed conduct that violates this policy should report it immediately using any of the following channels:

- Your supervisor or manager;
- Human Resources, at hr@angeltrans.com or (916) 259-3249; or
- Angela Silayo, Owner, if the concern involves your supervisor or HR.

Reports may be made verbally or in writing. Employees are not required to report the conduct to their supervisor first if the supervisor is the individual whose conduct is at issue.

COMPANY RESPONSE

Angel Trans LLC will promptly and thoroughly investigate all reports in a fair, timely, and confidential manner, to the extent possible consistent with a full and effective investigation. If an investigation confirms that this policy has been violated, the Company will take appropriate corrective action, up to and including termination of employment.

NO RETALIATION

Angel Trans LLC strictly prohibits retaliation against any employee for reporting harassment or discrimination, providing information in connection with an investigation, or otherwise exercising rights protected under this policy or applicable law. Any employee who engages in retaliation is subject to discipline, up to and including termination.

EXTERNAL RESOURCES

Employees may also file a complaint with the California Civil Rights Department (CRD, formerly DFEH) at calcivilrights.ca.gov or (800) 884-1684, or with the U.S. Equal Employment Opportunity Commission (EEOC) at eeoc.gov or (800) 669-4000. This policy supplements, and does not replace, the California Sexual Harassment Information sheet and other CRD materials provided to you separately during onboarding.

ACKNOWLEDGEMENT

By signing below, I acknowledge that I have received, read, and understood this Sexual Harassment, Discrimination & Retaliation Prevention Policy. I understand how to report a concern and that Angel Trans LLC prohibits retaliation against anyone who reports in good faith.

Employee Acknowledgement & Signature:

|  |  |  |
 --- |
| Employee Signature |  | Date |
| Printed Name: ______________________________ |  |  |`;

(async () => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert the new section — no classification/job-title filter, so it applies to everyone.
    const secRes = await client.query(`
      INSERT INTO sections (section_number, title, content, has_initials)
      VALUES (30, 'Sexual Harassment, Discrimination & Retaliation Prevention Policy', $1, FALSE)
      ON CONFLICT (section_number) DO UPDATE
        SET title = EXCLUDED.title, content = EXCLUDED.content, has_initials = EXCLUDED.has_initials
      RETURNING id
    `, [CONTENT]);
    const sectionId = secRes.rows[0].id;
    console.log('✅ Section 30 (Sexual Harassment Prevention Policy) inserted/updated');

    // 2. Backfill: give every existing employee a 'Not Started' row for this new section
    //    so it appears on their dashboard and is required for packet completion,
    //    even if they were onboarded before this section existed.
    const backfill = await client.query(`
      INSERT INTO employee_sections (user_id, section_id, status)
      SELECT u.id, $1, 'Not Started'
      FROM users u
      WHERE u.role = 'employee'
        AND NOT EXISTS (
          SELECT 1 FROM employee_sections es
          WHERE es.user_id = u.id AND es.section_id = $1
        )
    `, [sectionId]);
    console.log(`✅ Backfilled Section 30 for ${backfill.rowCount} existing employee(s) (status: Not Started)`);

    await client.query('COMMIT');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
})();
