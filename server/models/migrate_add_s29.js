require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('./db');

(async () => {
  try {
    const content = `We are pleased to offer you an independent contractor engagement with Angel Trans LLC (the "Company"). This offer is conditioned upon your satisfactory completion of certain requirements, as more fully explained in this letter.

As an independent contractor, you will not be classified as an employee of the Company. You will not be entitled to employee benefits, including but not limited to paid time off, health insurance, workers' compensation insurance, or any other benefits that the Company may provide to its employees. You will be solely responsible for all applicable taxes on compensation received, including self-employment taxes. The Company will issue a Form 1099-NEC reflecting total payments made to you each calendar year.

This conditional offer of engagement is contingent upon:
• Verification of your right to work in the United States, as shown by your submission of acceptable documentation verifying your identity and work authorization.
• For Driver: verification that you are at least 21 years of age and have a valid driver's license of the type required to operate the applicable motor vehicle.
• Satisfactory completion of a background check.
• Satisfactory completion of a motor vehicle/driving record check.
• Satisfactory completion of a five-panel drug test.

This conditional offer is also contingent upon your execution of the following agreements, which must be signed before commencing services:
• Independent Contractor Agreement
• Confidentiality and Non-Disclosure Agreement
• Drug and Alcohol Policy for Contractors subject to Department of Transportation regulations
• Dash Cam Policy and Consent

As a condition of this engagement, you agree to execute any additional agreements required by the Company at the start of your engagement and during the engagement period. You further agree that at all times during your engagement (and afterwards as applicable), you will be bound by, and will fully comply with, these additional agreements.

This offer will be withdrawn if any of the above conditions are not satisfied.

This letter is merely a summary of the principal terms of our offer of engagement and is not a contract for any definite period of time. You acknowledge that this conditional offer letter, along with the final form of any enclosed documents, represents the scope of the engagement offer. No verbal or written agreements, promises, or representations not specifically stated herein are, or will be, binding upon the Company.

Additional Terms and Conditions of Offer: N/A

This offer of engagement will be held open for five (5) business days. Upon expiration of that period, it will be deemed to be withdrawn.

This engagement agreement, along with the Confidentiality Agreement and Independent Contractor Agreement, sets forth the terms and conditions of your engagement with the Company, and supersedes any prior representations or agreements concerning your engagement with the Company, whether written or oral.

I hereby agree to and accept engagement with the Company as an independent contractor on the terms and conditions set forth in this offer letter.`;

    await db.query(`
      INSERT INTO sections (section_number, title, content, has_initials, employment_classification_filter, is_active)
      VALUES (29, 'Conditional Offer of Engagement (Independent Contractor)', $1, false, '1099', true)
      ON CONFLICT (section_number) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        has_initials = EXCLUDED.has_initials,
        employment_classification_filter = EXCLUDED.employment_classification_filter,
        job_title_filter = NULL
    `, [content]);

    console.log('✅ Section 29 added: Conditional Offer of Engagement (Independent Contractor) — 1099-only');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
