import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EmployeeNav } from "../../components/layout/EmployeeNav";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const EMPTY = {
  employeeAddress: "",
  employeePhone: "",
  hasMedicalRestrictions: false,
  medicalRestrictionsDetail: "",
  primaryName: "",
  primaryRelationship: "",
  primaryAddress: "",
  primaryPhone: "",
  primaryAltPhone: "",
  secondaryName: "",
  secondaryRelationship: "",
  secondaryAddress: "",
  secondaryPhone: "",
  secondaryAltPhone: "",
  doctorName: "",
  doctorAddress: "",
  doctorPhone: "",
  employeeSignature: "",
  signatureDate: new Date().toISOString().split("T")[0],
};

function Section({ icon, title, subtitle, children }) {
  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="font-headline font-semibold text-headline-sm text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
          {title}
        </h2>
        {subtitle && <p className="text-body-sm text-secondary mt-1">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function EmergencyContact() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    api.get("/employee/emergency-contact")
      .then(r => {
        if (r.data) {
          setForm({
            employeeAddress:           r.data.employee_address || "",
            employeePhone:             r.data.employee_phone || "",
            hasMedicalRestrictions:    r.data.has_medical_restrictions || false,
            medicalRestrictionsDetail: r.data.medical_restrictions_detail || "",
            primaryName:               r.data.primary_name || "",
            primaryRelationship:       r.data.primary_relationship || "",
            primaryAddress:            r.data.primary_address || "",
            primaryPhone:              r.data.primary_phone || "",
            primaryAltPhone:           r.data.primary_alt_phone || "",
            secondaryName:             r.data.secondary_name || "",
            secondaryRelationship:     r.data.secondary_relationship || "",
            secondaryAddress:          r.data.secondary_address || "",
            secondaryPhone:            r.data.secondary_phone || "",
            secondaryAltPhone:         r.data.secondary_alt_phone || "",
            doctorName:                r.data.doctor_name || "",
            doctorAddress:             r.data.doctor_address || "",
            doctorPhone:               r.data.doctor_phone || "",
            employeeSignature:         r.data.employee_signature || "",
            signatureDate:             r.data.signature_date
              ? r.data.signature_date.split("T")[0]
              : new Date().toISOString().split("T")[0],
          });
          setSubmitted(r.data.submitted || false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setError(""); setSaveSuccess(false);
    try {
      await api.post("/employee/emergency-contact/save", form);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Save failed. Please try again.");
    } finally { setSaving(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.primaryName || !form.primaryRelationship || !form.primaryPhone) {
      setError("Primary contact name, relationship, and phone number are required."); return;
    }
    if (!form.employeeSignature || !form.signatureDate) {
      setError("Please provide your signature and date."); return;
    }
    setSubmitting(true);
    try {
      await api.post("/employee/emergency-contact/submit", form);
      setSubmitted(true);
      setTimeout(() => navigate("/onboarding"), 1800);
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed. Please try again.");
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-surface">
      <EmployeeNav />
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <EmployeeNav />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Back + header */}
        <button onClick={() => navigate("/onboarding")}
          className="flex items-center gap-1.5 text-secondary hover:text-primary text-body-md transition-colors mb-6">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          Back to Dashboard
        </button>

        <div className="card mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-primary text-2xl">emergency</span>
            <h1 className="font-headline font-bold text-headline-lg text-on-surface">Emergency Contact Form</h1>
          </div>
          <p className="text-body-md text-secondary">
            Please complete all emergency contact information. This will be kept on file and used only in the event of an emergency.
          </p>
        </div>

        {submitted && (
          <div className="mb-6 p-4 bg-success-container rounded-xl flex items-center gap-3">
            <span className="material-symbols-outlined text-success text-2xl">check_circle</span>
            <div>
              <p className="text-body-md font-semibold text-on-surface">Form submitted successfully.</p>
              <p className="text-body-sm text-secondary">You can update this information at any time by resubmitting.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-error-container rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-xl">error</span>
            <p className="text-error text-body-md">{error}</p>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 p-3 bg-success-container rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-success text-xl">check_circle</span>
            <p className="text-success text-body-md">Progress saved.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Employee Information */}
          <Section icon="person" title="Employee Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Employee Name</label>
                <input readOnly value={user?.name || ""}
                  className="input-field bg-surface-container-low cursor-not-allowed text-secondary" />
                <p className="text-label-sm text-secondary mt-1">Auto-filled from your account</p>
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Phone Number</label>
                <input type="tel" placeholder="(555) 000-0000" className="input-field"
                  value={form.employeePhone} onChange={e => set("employeePhone", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-label-lg text-on-surface mb-1.5">Address</label>
                <input placeholder="Street address, city, state, ZIP" className="input-field"
                  value={form.employeeAddress} onChange={e => set("employeeAddress", e.target.value)} />
              </div>
            </div>
          </Section>

          {/* Special Instructions */}
          <Section
            icon="medical_information"
            title="Special Instructions"
            subtitle="In the event of a medical emergency, are there any emergency procedures or restrictions on medications of which emergency personnel should be aware?"
          >
            <div className="flex items-center gap-8 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="medRestrictions" className="accent-primary w-4 h-4"
                  checked={!form.hasMedicalRestrictions}
                  onChange={() => set("hasMedicalRestrictions", false)} />
                <span className="text-body-md text-on-surface">No</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="medRestrictions" className="accent-primary w-4 h-4"
                  checked={form.hasMedicalRestrictions === true}
                  onChange={() => set("hasMedicalRestrictions", true)} />
                <span className="text-body-md text-on-surface">Yes — please explain below</span>
              </label>
            </div>
            {form.hasMedicalRestrictions && (
              <textarea rows={3} placeholder="Please describe any emergency procedures or medication restrictions..."
                className="input-field resize-none"
                value={form.medicalRestrictionsDetail}
                onChange={e => set("medicalRestrictionsDetail", e.target.value)} />
            )}
          </Section>

          {/* Primary Contact */}
          <Section
            icon="contacts"
            title={<>Primary Emergency Contact <span className="text-error text-headline-sm">*</span></>}
            subtitle="Primary contact in case of emergency"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Full Name *</label>
                <input placeholder="Contact's full name" className="input-field"
                  value={form.primaryName} onChange={e => set("primaryName", e.target.value)} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Relationship *</label>
                <input placeholder="e.g. Spouse, Parent, Sibling" className="input-field"
                  value={form.primaryRelationship} onChange={e => set("primaryRelationship", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-label-lg text-on-surface mb-1.5">Address</label>
                <input placeholder="Street address, city, state, ZIP" className="input-field"
                  value={form.primaryAddress} onChange={e => set("primaryAddress", e.target.value)} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Phone Number *</label>
                <input type="tel" placeholder="(555) 000-0000" className="input-field"
                  value={form.primaryPhone} onChange={e => set("primaryPhone", e.target.value)} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Alternate Phone</label>
                <input type="tel" placeholder="(555) 000-0000" className="input-field"
                  value={form.primaryAltPhone} onChange={e => set("primaryAltPhone", e.target.value)} />
              </div>
            </div>
          </Section>

          {/* Secondary Contact */}
          <Section
            icon="person_add"
            title="Secondary Emergency Contact"
            subtitle="Secondary contact in case of emergency (optional)"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Full Name</label>
                <input placeholder="Contact's full name" className="input-field"
                  value={form.secondaryName} onChange={e => set("secondaryName", e.target.value)} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Relationship</label>
                <input placeholder="e.g. Spouse, Parent, Sibling" className="input-field"
                  value={form.secondaryRelationship} onChange={e => set("secondaryRelationship", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-label-lg text-on-surface mb-1.5">Address</label>
                <input placeholder="Street address, city, state, ZIP" className="input-field"
                  value={form.secondaryAddress} onChange={e => set("secondaryAddress", e.target.value)} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Phone Number</label>
                <input type="tel" placeholder="(555) 000-0000" className="input-field"
                  value={form.secondaryPhone} onChange={e => set("secondaryPhone", e.target.value)} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Alternate Phone</label>
                <input type="tel" placeholder="(555) 000-0000" className="input-field"
                  value={form.secondaryAltPhone} onChange={e => set("secondaryAltPhone", e.target.value)} />
              </div>
            </div>
          </Section>

          {/* Physician */}
          <Section icon="local_hospital" title="Physician Contact">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Doctor's Name</label>
                <input placeholder="Dr. Full Name" className="input-field"
                  value={form.doctorName} onChange={e => set("doctorName", e.target.value)} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Phone Number</label>
                <input type="tel" placeholder="(555) 000-0000" className="input-field"
                  value={form.doctorPhone} onChange={e => set("doctorPhone", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-label-lg text-on-surface mb-1.5">Address</label>
                <input placeholder="Practice address" className="input-field"
                  value={form.doctorAddress} onChange={e => set("doctorAddress", e.target.value)} />
              </div>
            </div>
          </Section>

          {/* Authorization */}
          <Section icon="draw" title="Employee Authorization">
            <p className="text-body-sm text-secondary mb-4">
              I have voluntarily provided the above contact information and authorize Angel Trans LLC and its
              representatives to contact any of the above individuals on my behalf in the event of an emergency.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-label-lg text-on-surface">Signature *</label>
                  <button type="button" onClick={() => set("employeeSignature", "")}
                    className="text-label-md text-primary hover:underline">Clear</button>
                </div>
                <input
                  placeholder="Type your name as signature"
                  className="input-field text-xl text-on-surface"
                  style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }}
                  value={form.employeeSignature}
                  onChange={e => set("employeeSignature", e.target.value)} />
                <p className="text-label-sm text-secondary mt-1">
                  By typing your name, you agree this constitutes your legal electronic signature.
                </p>
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Date *</label>
                <input type="date" className="input-field"
                  value={form.signatureDate}
                  onChange={e => set("signatureDate", e.target.value)} />
              </div>
            </div>
          </Section>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pb-8">
            <button type="button" onClick={handleSave} disabled={saving}
              className="btn-secondary flex items-center justify-center gap-2">
              {saving
                ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-xl">save</span>}
              {saving ? "Saving..." : "Save Progress"}
            </button>
            <button type="submit" disabled={submitting}
              className="btn-primary flex items-center justify-center gap-2">
              {submitting
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-xl">check_circle</span>}
              {submitting ? "Submitting..." : submitted ? "Update & Submit" : "Submit Form"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
