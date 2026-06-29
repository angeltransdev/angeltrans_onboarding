import { useNavigate } from "react-router-dom";
import { EmployeeNav } from "../../components/layout/EmployeeNav";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export default function TerminationComplete() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleDownload = async () => {
    try {
      const res = await api.get("/employee/termination-packet/download", { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${(user?.name || "employee").replace(/[^a-zA-Z0-9]/g,"_")}_Termination_Packet.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = err.response?.data?.message || "PDF not ready yet. Please try again in a moment.";
      alert(msg);
    }
  };

  return (
    <div className="min-h-screen bg-surface"><EmployeeNav />
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-secondary" style={{fontSize:48}}>task_alt</span>
        </div>
        <h1 className="font-headline font-bold text-headline-md text-on-surface mb-3">Termination Packet Complete</h1>
        <p className="text-secondary text-body-lg mb-6">Your separation documents have been completed successfully.</p>
        <div className="card bg-surface-container-low border-0 mb-8">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-2xl">mark_email_read</span>
            <p className="text-on-surface text-body-md">Your signed termination packet has been submitted. A copy has been emailed to you and HR.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={handleDownload} className="btn-primary flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-xl">download</span>
            Download My Copy (PDF)
          </button>
          <button onClick={() => { logout(); navigate("/login"); }} className="btn-secondary flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-xl">logout</span>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
