const injectFields = (content, details, signedDate = null, company = {}) => {
  if (!content || !details) return content;

  // ── Date helpers ─────────────────────────────────────────────────────────
  const startDate   = details.start_date ? new Date(details.start_date) : new Date();
  const signingDate = signedDate ? new Date(signedDate) : new Date();

  const dayOrdinal = (d) => {
    if (d >= 11 && d <= 13) return `${d}th`;
    const s = ['th','st','nd','rd'];
    return `${d}${s[d % 10] || s[0]}`;
  };

  const agreementDay   = dayOrdinal(startDate.getDate());
  const agreementMonth = startDate.toLocaleString('en-US', { month: 'long' });
  const agreementYear  = startDate.getFullYear().toString();
  const yearSigned     = signingDate.getFullYear().toString();
  const startDateStr   = startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dateSentStr    = details.date_sent
    ? new Date(details.date_sent).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ── Sick leave checkboxes (Section 5) ────────────────────────────────────
  const opt = details.sick_leave_option || '1';
  const exempt = details.sick_leave_exempt || '__________';
  const sickLeaveBoxes = [
    `[${opt==='1'?'✓':' '}] 1. Accrues paid sick leave only pursuant to the minimum requirements stated in Labor Code §245 et seq. with no other employer policy providing additional or different terms for accrual and use of paid sick leave.`,
    `[${opt==='2'?'✓':' '}] 2. Accrues paid sick leave pursuant to the employer's policy that satisfies or exceeds the accrual, carryover, and use requirements of Labor Code §246.`,
    `[${opt==='3'?'✓':' '}] 3. Employer provides no less than 40 hours (or 5 days) of paid sick leave at the beginning of each 12-month period.`,
    `[${opt==='4'?'✓':' '}] 4. The employee is exempt or partially exempt from paid sick leave by Labor Code §245.5 (State exemption and subsection for exemption: ${opt==='4'?exempt:'__________'} ).`,
  ].join('\n');

  // ── Emergency declaration (Section 5) ────────────────────────────────────
  const hasEmergency = details.emergency_decl;
  const emergencyBox = hasEmergency
    ? `[✓] There is a state or federal emergency or disaster declaration applicable to the county or counties where the employee will work issued within 30 days before the employee's first day of employment and that may affect their health and safety during employment. (${details.emergency_details || '__________'})`
    : `[ ] There is a state or federal emergency or disaster declaration applicable to the county or counties where the employee will work issued within 30 days before the employee's first day of employment and that may affect their health and safety during employment. (State emergency or disaster declaration and how it may affect health or safety: __________ )`;

  return content
    // ── Employee fields ───────────────────────────────────────────────────
    .replace(/\{\{employee_name\}\}/g,      details.name             || '______________________________')
    .replace(/\{\{job_title\}\}/g,          details.job_title        || '______________________________')
    .replace(/\{\{employment_type\}\}/g,    details.employment_type  || '[ ] Full-Time   [ ] Part-Time')
    .replace(/\{\{start_date\}\}/g,         startDateStr)
    .replace(/\{\{effective_date\}\}/g,     startDateStr)
    .replace(/\{\{date_sent\}\}/g,          dateSentStr)
    .replace(/\{\{hourly_rate\}\}/g,        details.hourly_rate   ? `$${Number(details.hourly_rate).toFixed(2)}` : '$__________')
    .replace(/\{\{overtime_rate\}\}/g,      details.overtime_rate ? `$${Number(details.overtime_rate).toFixed(2)}` : '$__________')
    .replace(/\{\{department\}\}/g,         details.department       || '______________________________')
    .replace(/\{\{manager\}\}/g,            details.manager          || '______________________________')
    // ── Section 5 — Sick leave + emergency ───────────────────────────────
    .replace(/\{\{sick_leave_boxes\}\}/g,   sickLeaveBoxes)
    .replace(/\{\{emergency_box\}\}/g,      emergencyBox)
    // ── Section 14 — HIPAA date ───────────────────────────────────────────
    .replace(/\{\{agreement_day\}\}/g,      agreementDay)
    .replace(/\{\{agreement_month\}\}/g,    agreementMonth)
    .replace(/\{\{agreement_year\}\}/g,     agreementYear)
    // ── Section 24 — Annual agreement year ───────────────────────────────
    .replace(/\{\{year_signed\}\}/g,        yearSigned)
    // ── Company fields ────────────────────────────────────────────────────
    .replace(/\{\{company_name\}\}/g,    company.name    || 'Angel Trans LLC')
    .replace(/\{\{company_address\}\}/g, company.address || '1333 Howe Ave # 201, Sacramento, CA 95825')
    .replace(/\{\{company_phone\}\}/g,   company.phone   || '(916) 259-3249')
    .replace(/\{\{company_email\}\}/g,   company.email   || 'hr@angeltransllc.com')
    // ── Employee phone ────────────────────────────────────────────────────
    .replace(/\{\{employee_phone\}\}/g,  details.phone   || '______________________________')
    // ── Inline blanks not covered by template tags ────────────────────────
    .replace(/\bEffective Date:\s*_{5,}/g,  `Effective Date: ${startDateStr}`)
    // Fix stale hardcoded company contact info
    .replace(/1333 Howe Ave # 201,?\s*Sacramento,?\s*CA\s*95825/g, company.address || '1333 Howe Ave # 201, Sacramento, CA 95825')
    .replace(/\(916\)\s*259-3249/g,  company.phone || '(916) 259-3249')
    .replace(/hr@angeltrans\.com(?!llc)/g, company.email || 'hr@angeltransllc.com');
};

module.exports = { injectFields };
