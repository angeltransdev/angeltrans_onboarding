// Seeds the database with:
// 1. Owner account (Angela Silayo)
// 2. All 28 orientation sections with full content
// 3. 3 termination packet sections
// Run once: node server/models/seed.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db      = require('./db');
const bcrypt  = require('bcryptjs');

const seed = async () => {
  console.log('🌱 Seeding Angel Trans HR Portal...');

  // ── 1. Owner account ─────────────────────────────────────────────────────
  const hash = await bcrypt.hash(process.env.OWNER_PASSWORD || 'AngTrans2024!', 12);
  await db.query(`
    INSERT INTO users (name, email, password_hash, role, status)
    VALUES ('Angela Silayo', 'angeltrans07@gmail.com', $1, 'owner', 'Active')
    ON CONFLICT (email) DO NOTHING
  `, [hash]);
  console.log('✅ Owner account created');

  // ── 2. Termination sections ────────────────────────────────────────────────
  const terminationSections = [
    {
      order: 1,
      title: 'Termination Notice',
      content: `This letter serves as official notice that your employment with Angel Trans LLC has been terminated, effective on the date indicated in this packet.

Reason for Termination: As noted in your termination paperwork.

You are entitled to receive your final paycheck, which will include all wages earned through your last day of employment, as well as any accrued but unused Paid Time Off in accordance with California law.

Please return all Company property, including but not limited to: keys, access cards, uniforms, mobile devices, vehicle equipment, and any other Company-issued materials. Failure to return Company property may result in deductions from your final paycheck to the extent permitted by law.

Your health insurance coverage, if applicable, will continue through the end of the month in which your employment terminates. You will receive information regarding your right to continue coverage under COBRA separately.

Any confidentiality, non-disclosure, or other agreements you signed during your employment remain in full force and effect after your separation from the Company.

If you have questions about your final paycheck, benefits continuation, or return of Company property, please contact HR at hr@angeltrans.com or (916) 259-3249.`
    },
    {
      order: 2,
      title: 'Termination Certification (Exhibit C)',
      content: `TERMINATION CERTIFICATION

This is to certify that I do not have in my possession, nor have I failed to return, any devices, records, data, notes, reports, proposals, lists, correspondence, specifications, drawings, blueprints, sketches, laboratory notebooks, flow charts, materials, equipment, other documents or property, or copies or reproductions of any aforementioned items belonging to Angel Trans LLC, its subsidiaries, affiliates, successors or assigns (collectively, the "Company").

I further certify that I have complied with all the terms of the Company's Confidential Information and Invention Assignment Agreement signed by me, including the reporting of any Inventions (as defined therein), conceived or made by me (solely or jointly with others) covered by that agreement, and I acknowledge my continuing obligations under that agreement.

I further agree that, in compliance with the Confidential Information and Invention Assignment Agreement, I will preserve as confidential all trade secrets, confidential knowledge, data or other proprietary information relating to products, processes, know-how, designs, formulas, developmental or experimental work, computer programs, databases, other original works of authorship, customer lists, business plans, financial information or other subject matter pertaining to any business of the Company or any of its employees, clients, consultants or licensees.

I further agree that for twelve (12) months from the date of this Certification, I shall not either directly or indirectly solicit, induce, recruit or encourage any of the Company's employees or consultants to terminate their relationship with the Company, or attempt to solicit, induce, recruit, encourage or take away employees or consultants of the Company, either for myself or for any other person or entity.

Further, I agree that I shall not use any Confidential Information of the Company to negatively influence any of the Company's clients or customers from purchasing company products or services or to solicit or influence or attempt to influence any client, customer or other person either directly or indirectly, to direct any purchase of products and/or services to any person, firm, corporation, institution or other entity in competition with the business of the Company.`
    },
    {
      order: 3,
      title: 'Final Wage Acknowledgement',
      content: `FINAL WAGE ACKNOWLEDGEMENT

By signing below, I acknowledge and confirm the following:

1. FINAL PAYCHECK: I have received, or will receive on my last day of employment (or within 72 hours if I resigned without 72 hours' notice), my final paycheck from Angel Trans LLC. This final paycheck includes:
   - All wages earned through my last day of employment
   - Any accrued but unused Paid Time Off (PTO) owed under California law

2. EXPENSE REIMBURSEMENTS: I have submitted all outstanding expense reports and have received, or will receive, reimbursement for all approved business expenses incurred during my employment.

3. COMPANY PROPERTY RETURNED: I have returned all Company property including, but not limited to, keys, access cards, uniforms, mobile devices, company vehicles (if applicable), equipment, tools, documents, and any other Company-issued materials.

4. NO OTHER AMOUNTS OWED: Other than the amounts stated above, I am not owed any additional wages, commissions, bonuses, overtime, or other compensation from Angel Trans LLC, except as required by law.

5. CONTINUING OBLIGATIONS: I understand that my obligations under any confidentiality, non-disclosure, invention assignment, or non-solicitation agreements I signed during my employment remain in full force and effect after my separation.

6. COBRA RIGHTS: I understand I will receive information separately regarding my right to continue health insurance coverage under COBRA, if applicable.

I have read and understand this Final Wage Acknowledgement and sign it voluntarily.`
    }
  ];

  for (const sec of terminationSections) {
    await db.query(`
      INSERT INTO termination_sections (section_order, title, content)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [sec.order, sec.title, sec.content]);
  }
  console.log('✅ Termination sections seeded');

  // ── 3. Orientation sections (28) ──────────────────────────────────────────
  // Section titles only — content loaded from orientation packet
  const sectionTitles = [
    'Conditional Offer of Employment',
    'NEMT Driver Position Description',
    'EMT Position Description',
    'Employee Documents Acknowledgement',
    'Notice to Employee — Wage Information / Workers\' Compensation / Paid Sick Leave',
    'E-Signature Disclosure and Consent',
    'Reference Checking Consent and Authorization',
    'Workplace Violence Prevention Plan Notice',
    'Consent to Automated Calls and Text Messages',
    'Dash Cam Policy and Consent Form',
    'Acknowledgement of Biometric Policy and Consent Form',
    'Vehicle Technology and Biometric Consent',
    'Policy Against Personal Device Usage',
    'HIPAA Employee Confidentiality Agreement',
    'California Indoor Heat Illness Prevention Plan',
    'Wildfire Smoke Plan',
    'Federal and California Earned Income Tax Credit Notification',
    'Indoor and Outdoor Heat Illness Prevention Plan Information',
    'California Workplace Violence Prevention Plan',
    'Employee Privacy Notice Acknowledgement',
    'Drug and Alcohol-Free Workplace Acknowledgement and Consent',
    'DOT Drug and Alcohol Policy (FMCSA)',
    'Emergency Action Plan',
    'Employee Annual Agreement',
    'Safety, Injury and Illness, and Accident Prevention Plan and Program',
    'Confidential Information and Invention Assignment Agreement',
    'Confidentiality and Non-Disclosure Agreement',
    'Orientation Packet Completion Checklist',
  ];

  for (let i = 0; i < sectionTitles.length; i++) {
    const hasInitials = i === 3; // Section 4 (index 3) has 33 acknowledgement items
    await db.query(`
      INSERT INTO sections (section_number, title, content, has_initials)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (section_number) DO UPDATE SET title=$2, has_initials=$4
    `, [i + 1, sectionTitles[i], `[Content for Section ${i+1}: ${sectionTitles[i]}]`, hasInitials]);
  }

  // Seed the 33 acknowledgement items for Section 4
  const secRes = await db.query('SELECT id FROM sections WHERE section_number=4');
  const sec4Id = secRes.rows[0]?.id;
  if (sec4Id) {
    const ackItems = [
      'Non-Exempt Employee Notice — California Labor Code Section 2810.5',
      'California Paid Family Leave Information (DE 2511)',
      'California State Disability Information (DE 2515)',
      'California Paid Sick Leave Information',
      'California Paid Sick Leave: Frequently Asked Questions',
      'California Time of Hire Pamphlet',
      'California Victims of Domestic Violence Leave Notice',
      'California Pregnancy Disability Leave Fact Sheet',
      'California Pregnancy Leave Brochure',
      'California Employment Discrimination Information',
      'California Family Care and Medical Leave (CFRA) and Pregnancy Disability Leave Information',
      'California Family Care and Medical Leave Fact Sheet',
      'California Sexual Harassment Information',
      'California Sexual Harassment Fact Sheet',
      'California Transgender Rights in the Workplace Information',
      'California Your Rights and Obligations as a Pregnant Employee',
      'Health Insurance Exchange Notice',
      'Federal/California Earned Income Tax Credit Notification',
      'California Workplace — Know Your Rights',
      'California Minimum Wage — MW-2026',
      'Payday Notice',
      'Prevent Heat Illness at Work',
      'Safety and Health Protection on the Job',
      'Emergency Phone Number Flyer',
      'Notice to Employees — Injuries Caused By Work',
      'Whistleblowers Notice',
      'Survivors of Violence and Family Members of Victims — Right to Leave and Accommodations',
      'Notice to Employees Poster (DE 1857A)',
      'Notice to Employees — Unemployment Insurance Benefits (DE 1857D)',
      'Know Your Rights: Workplace Discrimination is Illegal',
      'Employee Rights — Employee Polygraph Protection Act',
      'Your Employee Rights Under the Family and Medical Leave Act',
      'Non-Exempt Employee Notice — Labor Code Section 2810.5',
    ];
    for (let i = 0; i < ackItems.length; i++) {
      await db.query(`
        INSERT INTO section_acknowledgements (section_id, item_order, item_text)
        VALUES ($1,$2,$3) ON CONFLICT DO NOTHING
      `, [sec4Id, i+1, ackItems[i]]);
    }
    console.log('✅ 33 acknowledgement items seeded for Section 4');
  }

  console.log('✅ All 28 sections seeded');
  console.log('\n🎉 Database seeded successfully!');
  console.log('Owner login: angeltrans07@gmail.com');
  console.log(`Password: ${process.env.OWNER_PASSWORD || 'AngTrans2024!'}`);
  process.exit(0);
};

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
