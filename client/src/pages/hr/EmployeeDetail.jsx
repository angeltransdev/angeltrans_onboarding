import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { HRSidebar } from "../../components/layout/HRSidebar";
import api from "../../services/api";

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [sections, setSections] = useState([]);
  const [tab, setTab] = useState("progress");
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [empRes, secRes] = await Promise.all([
          api.get(`/hr/employees/${id}`),
          api.get(`/hr/employees/${id}/sections`)
        ]);
        setEmployee(empRes.data);
        setSections(secRes.data);
      } catch(e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetch();
  }, [id]);

  const handleResend = async () => {
    setResending(true);
    try { await api.post(`/hr/employees/${id}/resend`); alert("Link resent successfully!"); }
    catch(e) { alert("Failed to resend link."); }
    finally { setResending(false); }
  };

  const readBlobError = async (err) => {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        return JSON.parse(text).message;
      } catch {}
    }
    return err.response?.data?.message || null;
  };

  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/hr/employees/${id}/generate-pdf`);
      alert(res.data.message || "PDF generated successfully.");
    } catch (err) {
      const msg = err.response?.data?.message || "PDF generation failed.";
      alert(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/hr/employees/${id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data); // res.data is already a Blob
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${(employee?.name || "employee").replace(/[^a-zA-Z0-9]/g,"_")}_Onboarding_Packet.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      const msg = await readBlobError(err) || "PDF not ready. Click 'Generate PDF' first.";
      alert(msg);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <div className="flex min-h-screen bg-surface"><HRSidebar />
      <main className="ml-64 flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    </div>
  );

  const progress = sections.length ? Math.round(sections.filter(s=>s.signed).length/sections.length*100) : 0;

  return (
    <div className="flex min-h-screen bg-surface">
      <HRSidebar />
      <main className="ml-64 flex-1 p-8">
        {/* Back */}
        <button onClick={() => navigate("/hr/dashboard")}
          className="flex items-center gap-1.5 text-secondary hover:text-primary text-body-md mb-6 transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span> Back to Employees
        </button>

        {/* Employee header */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-headline font-bold text-2xl flex-shrink-0">
              {employee?.name?.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="font-headline font-bold text-headline-md text-on-surface">{employee?.name}</h1>
                <span className={`${employee?.status === "Active" ? "badge-completed" : employee?.status === "Onboarding" ? "badge-progress" : "badge-terminated"}`}>
                  {employee?.status}
                </span>
              </div>
              <p className="text-secondary text-body-md">{employee?.email}</p>
              <p className="text-secondary text-body-md">{employee?.jobTitle} · {employee?.department}</p>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 max-w-48 h-2 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{width:`${progress}%`}} />
                </div>
                <span className="text-label-md text-secondary">{sections.filter(s=>s.signed).length} of {sections.length} sections completed ({progress}%)</span>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={handleResend} disabled={resending}
                className="btn-secondary flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-xl">send</span>
                {resending ? "Sending..." : "Resend Link"}
              </button>
              <button onClick={handleGeneratePDF} disabled={generating}
                className="btn-secondary flex items-center gap-2 text-sm">
                {generating
                  ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-xl">picture_as_pdf</span>}
                {generating ? "Generating..." : "Generate PDF"}
              </button>
              <button onClick={handleDownload} disabled={downloading}
                className="btn-primary flex items-center gap-2 text-sm">
                {downloading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-xl">download</span>}
                {downloading ? "Downloading..." : "Download PDF"}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant mb-6">
          {[["progress","Section Progress"],["info","Employee Info"],["log","Activity Log"]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-6 py-3 text-label-lg font-semibold border-b-2 -mb-px transition-colors ${
                tab===k ? "border-primary text-primary" : "border-transparent text-secondary hover:text-on-surface"
              }`}>{l}</button>
          ))}
        </div>

        {tab === "progress" && (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-container-low">
                <tr>
                  {["#","Section","Status","Signed/Initialed","Date Signed",""].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-label-md text-secondary font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {sections.map((s, i) => (
                  <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 text-label-md text-secondary font-semibold">{i+1}</td>
                    <td className="px-6 py-4 text-body-md text-on-surface">{s.title}</td>
                    <td className="px-6 py-4">
                      {s.signed
                        ? <span className="badge-completed">Completed</span>
                        : <span className="badge-notstarted">Not Started</span>}
                    </td>
                    <td className="px-6 py-4">
                      {s.signed
                        ? <span className="material-symbols-outlined text-success text-xl">check_circle</span>
                        : <span className="text-secondary">—</span>}
                    </td>
                    <td className="px-6 py-4 text-body-md text-secondary">{s.dateSigned || "—"}</td>
                    <td className="px-6 py-4">
                      <span className="material-symbols-outlined text-secondary text-xl cursor-pointer hover:text-primary">visibility</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "info" && (
          <div className="card">
            <div className="grid grid-cols-2 gap-6">
              {[
                ["Full Name", employee?.name],
                ["Email", employee?.email],
                ["Job Title", employee?.jobTitle],
                ["Employment Type", employee?.employmentType],
                ["Start Date", employee?.startDate],
                ["Hourly Rate", `$${employee?.hourlyRate}/hr`],
                ["Overtime Rate", `$${employee?.overtimeRate}/hr`],
                ["Department", employee?.department],
                ["Direct Manager", employee?.manager],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-label-md text-secondary mb-1">{label}</p>
                  <p className="text-body-md font-semibold text-on-surface">{value || "—"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "log" && (
          <div className="card">
            <p className="text-secondary text-body-md text-center py-8">Activity log coming soon.</p>
          </div>
        )}
      </main>
    </div>
  );
}
