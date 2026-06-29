import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EmployeeNav } from "../../components/layout/EmployeeNav";
import api from "../../services/api";

export default function TerminationSigning() {
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fields, setFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/employee/termination-packet")
      .then(r => setSections(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const current = sections[currentIdx];
  const isLast = currentIdx === sections.length - 1;

  const handleSign = async () => {
    if (!fields.signature || !fields.date) { alert("Please sign and enter the date."); return; }
    setSubmitting(true);
    try {
      await api.post(`/employee/termination-packet/${current.id}/sign`, fields);
      if (isLast) navigate("/termination/complete");
      else { setCurrentIdx(i => i+1); setFields({}); }
    } catch { alert("Failed to save signature. Please try again."); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-surface"><EmployeeNav />
      <div className="flex justify-center py-32"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface"><EmployeeNav />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-headline font-bold text-headline-md text-on-surface">Termination Packet</h1>
          <span className="text-label-md text-secondary bg-surface-container px-3 py-1.5 rounded-lg">
            Section {currentIdx+1} of {sections.length}
          </span>
        </div>
        <div className="w-full h-2 bg-surface-container rounded-full mb-8 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all"
            style={{width:`${((currentIdx+1)/sections.length)*100}%`}} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="font-headline font-bold text-headline-sm text-on-surface mb-4">{current?.title}</h2>
            <div className="text-body-md text-on-surface leading-relaxed max-h-[60vh] overflow-y-auto space-y-3">
              {current?.content?.split('\n').map((p, i) => p.trim() ? <p key={i}>{p}</p> : null)}
            </div>
          </div>
          <div className="card">
            <h3 className="font-headline font-semibold text-headline-sm text-on-surface mb-4">Your Acknowledgement</h3>
            <div className="mb-4">
              <label className="block text-label-lg text-on-surface mb-1.5">Full Name *</label>
              <input placeholder="Type your full name" className="input-field"
                value={fields.printedName || ""} onChange={e => setFields(p=>({...p,printedName:e.target.value}))} />
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-label-lg text-on-surface">Signature *</label>
                <button onClick={() => setFields(p=>({...p,signature:""}))} className="text-label-md text-primary hover:underline">Clear</button>
              </div>
              <input placeholder="Type your name as signature"
                className="input-field font-headline italic text-xl" style={{fontFamily:"Georgia, serif"}}
                value={fields.signature || ""} onChange={e => setFields(p=>({...p,signature:e.target.value}))} />
            </div>
            <div className="mb-6">
              <label className="block text-label-lg text-on-surface mb-1.5">Date *</label>
              <input type="date" className="input-field"
                value={fields.date || new Date().toISOString().split('T')[0]}
                onChange={e => setFields(p=>({...p,date:e.target.value}))} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setFields({})} className="btn-secondary flex-1">Save Progress</button>
              <button onClick={handleSign} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-xl">draw</span>
                {submitting ? "Submitting..." : isLast ? "Sign & Complete" : "Sign & Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
