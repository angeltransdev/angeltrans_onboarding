import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HRSidebar } from "../../components/layout/HRSidebar";
import api from "../../services/api";

export default function SendOnboarding() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    // Employee info
    fullName: "", email: "", jobTitle: "", employmentType: "Full-Time",
    startDate: "", hourlyRate: "", overtimeRate: "", manager: "", department: "",
    // Section 5 — Wage Notice specific fields
    sickLeaveOption: "1",
    sickLeaveExemptReason: "",
    hasEmergencyDeclaration: "no",
    emergencyDeclarationDetails: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmed) { setError("Please confirm the information is correct before sending."); return; }
    setError(""); setLoading(true);
    try {
      await api.post("/hr/send-onboarding", form);
      navigate("/hr/dashboard", { state: { success: `Onboarding packet sent to ${form.fullName}` } });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send onboarding packet.");
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <HRSidebar />
      <main className="ml-64 flex-1 p-8 max-w-4xl">
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-secondary hover:text-primary text-body-md mb-4 transition-colors">
            <span className="material-symbols-outlined text-xl">arrow_back</span> Back
          </button>
          <h1 className="font-headline font-bold text-display-lg text-on-surface">Send Onboarding Packet</h1>
          <p className="text-secondary text-body-md mt-1">Enter employee details to send onboarding invitation.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Employee Information ─────────────────────────────────────── */}
          <div className="card">
            <h2 className="font-headline font-semibold text-headline-sm text-on-surface mb-6 pb-3 border-b border-outline-variant">
              Employee Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Full Name *</label>
                <input required placeholder="Enter full name" className="input-field"
                  value={form.fullName} onChange={e => set("fullName", e.target.value)} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Email Address *</label>
                <input required type="email" placeholder="Enter email address" className="input-field"
                  value={form.email} onChange={e => set("email", e.target.value)} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Job Title / Position *</label>
                <select required className="input-field" value={form.jobTitle} onChange={e => set("jobTitle", e.target.value)}>
                  <option value="">Select position</option>
                  <option>NEMT Driver</option>
                  <option>EMT</option>
                  <option>Dispatcher</option>
                  <option>Office Staff</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Employment Type *</label>
                <select required className="input-field" value={form.employmentType} onChange={e => set("employmentType", e.target.value)}>
                  <option>Full-Time</option>
                  <option>Part-Time</option>
                </select>
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Department</label>
                <select className="input-field" value={form.department} onChange={e => set("department", e.target.value)}>
                  <option value="">Select department</option>
                  <option>Operations</option>
                  <option>Dispatch</option>
                  <option>Administration</option>
                  <option>EMT</option>
                </select>
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Direct Manager</label>
                <input placeholder="Manager name" className="input-field"
                  value={form.manager} onChange={e => set("manager", e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Compensation ─────────────────────────────────────────────── */}
          <div className="card">
            <h2 className="font-headline font-semibold text-headline-sm text-on-surface mb-6 pb-3 border-b border-outline-variant">
              Compensation Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Start Date *</label>
                <input required type="date" className="input-field"
                  value={form.startDate} onChange={e => set("startDate", e.target.value)} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Hourly Rate ($/hr) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">$</span>
                  <input required type="number" step="0.01" min="0" placeholder="0.00"
                    className="input-field pl-7"
                    value={form.hourlyRate} onChange={e => set("hourlyRate", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Overtime Rate ($/hr) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary">$</span>
                  <input required type="number" step="0.01" min="0" placeholder="0.00"
                    className="input-field pl-7"
                    value={form.overtimeRate} onChange={e => set("overtimeRate", e.target.value)} />
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-surface-container-low rounded-lg">
              <p className="text-label-md text-secondary">
                <span className="material-symbols-outlined text-base align-middle mr-1">info</span>
                These details are pre-filled into the employee's packet and are read-only for the employee.
              </p>
            </div>
          </div>

          {/* ── Section 5 — Wage Notice Fields ───────────────────────────── */}
          <div className="card border-l-4 border-primary">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-xl">description</span>
              <h2 className="font-headline font-semibold text-headline-sm text-on-surface">
                Section 5 — Wage Notice (Labor Code 2810.5)
              </h2>
            </div>
            <p className="text-secondary text-body-md mb-6">
              California law requires these selections to be made by HR before the employee receives the packet.
            </p>

            {/* Paid Sick Leave Option */}
            <div className="mb-6">
              <label className="block text-label-lg text-on-surface mb-3 font-semibold">
                Paid Sick Leave Type * <span className="text-label-sm text-secondary font-normal">(select one)</span>
              </label>
              <div className="space-y-3">
                {[
                  { val: "1", label: "Option 1", desc: "Accrues paid sick leave only pursuant to the minimum requirements stated in Labor Code §245 et seq. with no other employer policy providing additional or different terms." },
                  { val: "2", label: "Option 2", desc: "Accrues paid sick leave pursuant to the employer's policy that satisfies or exceeds the accrual, carryover, and use requirements of Labor Code §246." },
                  { val: "3", label: "Option 3", desc: "Employer provides no less than 40 hours (or 5 days) of paid sick leave at the beginning of each 12-month period." },
                  { val: "4", label: "Option 4", desc: "The employee is exempt or partially exempt from paid sick leave by Labor Code §245.5." },
                ].map(opt => (
                  <label key={opt.val}
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      form.sickLeaveOption === opt.val
                        ? "border-primary bg-primary/5"
                        : "border-outline-variant hover:border-primary/40"
                    }`}>
                    <input type="radio" name="sickLeaveOption" value={opt.val}
                      checked={form.sickLeaveOption === opt.val}
                      onChange={e => set("sickLeaveOption", e.target.value)}
                      className="mt-0.5 accent-primary flex-shrink-0" />
                    <div>
                      <p className="text-label-lg font-semibold text-on-surface">{opt.label}</p>
                      <p className="text-body-md text-secondary mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Option 4 exempt reason */}
              {form.sickLeaveOption === "4" && (
                <div className="mt-3">
                  <label className="block text-label-lg text-on-surface mb-1.5">
                    State exemption and subsection *
                  </label>
                  <input required placeholder="e.g. §245.5(a)(1) — construction industry employee"
                    className="input-field"
                    value={form.sickLeaveExemptReason}
                    onChange={e => set("sickLeaveExemptReason", e.target.value)} />
                </div>
              )}
            </div>

            {/* Emergency Declaration */}
            <div>
              <label className="block text-label-lg text-on-surface mb-3 font-semibold">
                Emergency or Disaster Declaration *
              </label>
              <div className="space-y-3">
                <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  form.hasEmergencyDeclaration === "no"
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant hover:border-primary/40"
                }`}>
                  <input type="radio" name="emergencyDecl" value="no"
                    checked={form.hasEmergencyDeclaration === "no"}
                    onChange={e => set("hasEmergencyDeclaration", e.target.value)}
                    className="mt-0.5 accent-primary flex-shrink-0" />
                  <div>
                    <p className="text-label-lg font-semibold text-on-surface">No declaration</p>
                    <p className="text-body-md text-secondary mt-0.5">
                      There is no applicable state or federal emergency or disaster declaration.
                    </p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  form.hasEmergencyDeclaration === "yes"
                    ? "border-primary bg-primary/5"
                    : "border-outline-variant hover:border-primary/40"
                }`}>
                  <input type="radio" name="emergencyDecl" value="yes"
                    checked={form.hasEmergencyDeclaration === "yes"}
                    onChange={e => set("hasEmergencyDeclaration", e.target.value)}
                    className="mt-0.5 accent-primary flex-shrink-0" />
                  <div>
                    <p className="text-label-lg font-semibold text-on-surface">Yes — declaration applies</p>
                    <p className="text-body-md text-secondary mt-0.5">
                      There is an applicable emergency or disaster declaration that may affect the employee's health and safety.
                    </p>
                  </div>
                </label>
              </div>

              {/* Emergency details */}
              {form.hasEmergencyDeclaration === "yes" && (
                <div className="mt-3">
                  <label className="block text-label-lg text-on-surface mb-1.5">
                    Describe the declaration and how it may affect health or safety *
                  </label>
                  <textarea required rows={3} placeholder="e.g. Sacramento County Wildfire Emergency Declaration — employees may be exposed to smoke and reduced air quality..."
                    className="input-field resize-none"
                    value={form.emergencyDeclarationDetails}
                    onChange={e => set("emergencyDeclarationDetails", e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* ── Error ────────────────────────────────────────────────────── */}
          {error && (
            <div className="p-3 bg-error-container rounded-lg">
              <p className="text-error text-body-md">{error}</p>
            </div>
          )}

          {/* ── Confirm + Submit ─────────────────────────────────────────── */}
          <div className="card">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-primary"
                checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
              <span className="text-body-md text-on-surface">
                I confirm the information above is correct and I want to send the onboarding packet to{" "}
                <strong>{form.email || "this employee"}</strong>.
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading || !confirmed} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
              ) : (
                <><span className="material-symbols-outlined text-xl">send</span> Send Invitation</>
              )}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}
