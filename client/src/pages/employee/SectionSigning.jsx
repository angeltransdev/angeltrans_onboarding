import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { EmployeeNav } from "../../components/layout/EmployeeNav";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export default function SectionSigning() {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [section, setSection] = useState(null);
  const [fields, setFields] = useState({});
  const [initials, setInitials] = useState({});
  const [allInitialed, setAllInitialed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const signatureRef = useRef(null);
  const requiresInitials = (section?.acknowledgements?.length || 0) > 0;

  useEffect(() => {
    api.get(`/employee/sections/${sectionId}`)
      .then(r => {
        setSection(r.data);
        // Pre-fill HR-provided and saved fields
        const pre = {};
        r.data.prefilledFields?.forEach(f => { pre[f.key] = f.value; });
        pre.printedName = r.data.savedName || user?.name || "";
        pre.signature = r.data.savedSignature || "";
        pre.date = r.data.savedDate || new Date().toISOString().split('T')[0];
        setFields(prev => ({ ...prev, ...pre }));
        // Init initials only for sections that actually have acknowledgement items
        if ((r.data.acknowledgements?.length || 0) > 0) {
          const initObj = {};
          r.data.acknowledgements.forEach(a => { initObj[a.id] = false; });
          setInitials(initObj);
          setAllInitialed(false);
        } else {
          setInitials({});
          setAllInitialed(true);
        }
      }).catch(()=>{}).finally(()=>setLoading(false));
  }, [sectionId, user?.name]);

  const handleInitialAll = () => {
    const all = {};
    Object.keys(initials).forEach(k => { all[k] = true; });
    setInitials(all);
    setAllInitialed(true);
  };

  const handleInitial = (id) => {
    const updated = { ...initials, [id]: !initials[id] };
    setInitials(updated);
    setAllInitialed(Object.values(updated).every(v => v));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payloadFields = {
        ...fields,
        printedName: fields.printedName || user?.name || "",
      };
      await api.post(`/employee/sections/${sectionId}/save`, { fields: payloadFields, initials });
    }
    catch(e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    if (!fields.signature) { alert("Please provide your signature."); return; }
    if (!fields.date) { alert("Please enter the date."); return; }
    if (requiresInitials && !allInitialed) { alert("Please initial all acknowledgement items."); return; }
    setSubmitting(true);
    try {
      const payloadFields = {
        ...fields,
        printedName: fields.printedName || user?.name || "",
      };
      await api.post(`/employee/sections/${sectionId}/sign`, { fields: payloadFields, initials });
      // Prefer linear flow: send employee to next section when available.
      const [progressRes, sectionsRes] = await Promise.all([
        api.get("/employee/sections/progress"),
        api.get("/employee/sections"),
      ]);

      if (progressRes.data.allComplete) {
        navigate("/onboarding/complete");
        return;
      }

      const ordered = [...sectionsRes.data].sort((a, b) => a.sectionNumber - b.sectionNumber);
      const currentIndex = ordered.findIndex((s) => String(s.id) === String(sectionId));
      const nextSection = currentIndex >= 0 ? ordered[currentIndex + 1] : null;

      if (nextSection?.id) {
        navigate(`/onboarding/section/${nextSection.id}`);
      } else {
        navigate("/onboarding");
      }
    } catch(e) { alert("Failed to save signature. Please try again."); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-surface"><EmployeeNav />
      <div className="flex justify-center py-32"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      <EmployeeNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/onboarding")}
            className="flex items-center gap-1.5 text-secondary hover:text-primary text-body-md transition-colors">
            <span className="material-symbols-outlined text-xl">arrow_back</span> Back to Dashboard
          </button>
          <span className="text-label-md text-secondary bg-surface-container px-3 py-1.5 rounded-lg">
            Section {section?.sectionNumber} of 28
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)] gap-6">
          {/* Policy content */}
          <div className="card">
            <h2 className="font-headline font-bold text-headline-md text-on-surface mb-4">{section?.title}</h2>
            <p className="text-secondary text-body-md mb-4">Please read the policy below and provide your signature.</p>
            <div className="prose prose-sm max-w-none text-on-surface text-body-md leading-relaxed max-h-[60vh] overflow-y-auto pr-2 space-y-3">
              {section?.content?.split('\n').map((para, i) =>
                para.trim() ? <p key={i}>{para}</p> : null
              )}
            </div>

            {/* Acknowledgement items */}
            {requiresInitials && (
              <div className="mt-6 border-t border-outline-variant pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-headline font-semibold text-headline-sm text-on-surface">
                    Document Acknowledgements
                  </h3>
                  <button onClick={handleInitialAll}
                    className="text-primary text-label-lg font-semibold hover:underline">
                    Initial All
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {section.acknowledgements.map((item, i) => (
                    <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                      initials[item.id] ? "bg-success-container" : "bg-surface-container hover:bg-surface-container-high"
                    }`} onClick={() => handleInitial(item.id)}>
                      <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        initials[item.id] ? "bg-success" : "border-2 border-outline"
                      }`}>
                        {initials[item.id] && <span className="material-symbols-outlined text-white text-base">check</span>}
                      </div>
                      <div className="flex-1">
                        <span className="text-body-md text-on-surface">{item.text}</span>
                      </div>
                      <span className="text-label-sm text-secondary flex-shrink-0">{i+1}.</span>
                    </div>
                  ))}
                </div>
                <p className="text-label-sm text-secondary mt-2">
                  ({Object.values(initials).filter(Boolean).length} of {Object.keys(initials).length} initialed)
                </p>
              </div>
            )}
          </div>

          {/* Signature panel */}
          <div className="card">
            <h3 className="font-headline font-semibold text-headline-sm text-on-surface mb-4">
              Your Acknowledgement & Signature
            </h3>

            {/* Pre-filled read-only fields */}
            {section?.prefilledFields?.map(f => (
              <div key={f.key} className="mb-4">
                <label className="block text-label-lg text-on-surface mb-1.5">{f.label}</label>
                <input readOnly value={f.value} className="input-field bg-surface-container-low cursor-not-allowed text-secondary" />
                <p className="text-label-sm text-secondary mt-1">Pre-filled by HR — read only</p>
              </div>
            ))}

            <div className="mb-4">
              <label className="block text-label-lg text-on-surface mb-1.5">Full Name on File</label>
              <input
                readOnly
                value={fields.printedName || user?.name || ""}
                className="input-field bg-surface-container-low cursor-not-allowed text-secondary"
              />
              <p className="text-label-sm text-secondary mt-1">This name is auto-filled from your account.</p>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-label-lg text-on-surface">Signature *</label>
                <button onClick={() => setFields(p => ({...p, signature:""}))}
                  className="text-label-md text-primary hover:underline">Clear</button>
              </div>
              <input placeholder="Type your name as signature"
                className="input-field font-headline italic text-xl text-on-surface"
                style={{fontFamily:"Georgia, serif"}}
                value={fields.signature || ""}
                onChange={e => setFields(p => ({...p, signature: e.target.value}))} />
              <p className="text-label-sm text-secondary mt-1">
                By typing your name, you agree this constitutes your legal electronic signature.
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-label-lg text-on-surface mb-1.5">Date *</label>
              <input type="date" className="input-field"
                value={fields.date || ""}
                onChange={e => setFields(p => ({...p, date: e.target.value}))} />
            </div>

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving}
                className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-xl">save</span>
                {saving ? "Saving..." : "Save Progress"}
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-xl">
                  {submitting ? "hourglass_empty" : "draw"}
                </span>
                {submitting ? "Submitting..." : "Sign & Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
