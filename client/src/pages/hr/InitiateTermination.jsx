import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HRSidebar } from "../../components/layout/HRSidebar";
import api from "../../services/api";

export default function InitiateTermination() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employeeId:"", reason:"", effectiveDate:"", finalPayDate:"", comments:"" });
  const [confirmed, setConfirmed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k,v) => setForm(p => ({...p, [k]:v}));

  useEffect(() => {
    api.get("/hr/employees?status=Active,Onboarding").then(r => setEmployees(r.data)).catch(()=>{});
  }, []);

  const handleSubmit = async () => {
    setError(""); setLoading(true);
    try {
      await api.post("/hr/initiate-termination", form);
      navigate("/hr/terminations", { state: { success: "Termination packet sent successfully." } });
    } catch(err) {
      setError(err.response?.data?.message || "Failed to send termination packet.");
    } finally { setLoading(false); setShowModal(false); }
  };

  const selected = employees.find(e => e.id === form.employeeId);

  return (
    <div className="flex min-h-screen bg-surface">
      <HRSidebar />
      <main className="ml-64 flex-1 p-8 max-w-3xl">
        <div className="mb-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-secondary hover:text-primary text-body-md mb-4 transition-colors">
            <span className="material-symbols-outlined text-xl">arrow_back</span> Back
          </button>
          <h1 className="font-headline font-bold text-display-lg text-on-surface">Initiate Termination</h1>
          <p className="text-secondary text-body-md mt-1">Select an employee and send termination packet.</p>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-headline font-semibold text-headline-sm text-on-surface mb-6 pb-3 border-b border-outline-variant">
              Termination Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Employee *</label>
                <select required className="input-field" value={form.employeeId} onChange={e => set("employeeId", e.target.value)}>
                  <option value="">Select employee</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.jobTitle}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Reason for Termination *</label>
                <select required className="input-field" value={form.reason} onChange={e => set("reason", e.target.value)}>
                  <option value="">Select reason</option>
                  <option>Resignation</option>
                  <option>Layoff</option>
                  <option>Performance</option>
                  <option>Misconduct</option>
                  <option>End of Contract</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-lg text-on-surface mb-1.5">Effective Date *</label>
                  <input required type="date" className="input-field" value={form.effectiveDate} onChange={e => set("effectiveDate", e.target.value)} />
                </div>
                <div>
                  <label className="block text-label-lg text-on-surface mb-1.5">Final Pay Date *</label>
                  <input required type="date" className="input-field" value={form.finalPayDate} onChange={e => set("finalPayDate", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Comments (Optional)</label>
                <textarea rows={4} placeholder="Enter comments..."
                  className="input-field resize-none" value={form.comments} onChange={e => set("comments", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Termination packet contents */}
          <div className="card bg-surface-container-low border-outline-variant">
            <h3 className="font-headline font-semibold text-headline-sm text-on-surface mb-3">
              <span className="material-symbols-outlined align-middle mr-2 text-primary">description</span>
              Termination Packet Contains
            </h3>
            {["Termination Notice","Termination Certification (Exhibit C — CIIA)","Final Wage Acknowledgement"].map((d,i) => (
              <div key={i} className="flex items-center gap-2 mt-2">
                <span className="material-symbols-outlined text-success text-base">check_circle</span>
                <span className="text-body-md text-on-surface">{d}</span>
              </div>
            ))}
          </div>

          {error && <div className="p-3 bg-error-container rounded-lg"><p className="text-error text-body-md">{error}</p></div>}

          <div className="card">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-primary"
                checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
              <span className="text-body-md text-on-surface">
                I confirm this information is correct and I want to send the termination packet to <strong>{selected?.name || "this employee"}</strong>.
              </span>
            </label>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => { if(!form.employeeId||!form.reason||!form.effectiveDate||!form.finalPayDate){setError("Please fill all required fields.");return;} if(!confirmed){setError("Please confirm before sending.");return;} setShowModal(true); }}
              className="btn-danger flex-1 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-xl">person_off</span>
              Send Termination Packet
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-card-lg max-w-md w-full p-8 text-center">
              <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-error" style={{fontSize:32}}>warning</span>
              </div>
              <h3 className="font-headline font-bold text-headline-sm text-on-surface mb-2">Confirm Termination</h3>
              <p className="text-secondary text-body-md mb-6">
                You are about to send a termination packet to <strong>{selected?.name}</strong>.
                They will be locked out of the onboarding portal immediately. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Go Back</button>
                <button onClick={handleSubmit} disabled={loading} className="btn-danger flex-1">
                  {loading ? "Sending..." : "Yes, Send Packet"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
