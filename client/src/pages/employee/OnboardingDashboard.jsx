import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EmployeeNav } from "../../components/layout/EmployeeNav";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export default function OnboardingDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [handbookDownloading, setHandbookDownloading] = useState(false);
  const [showHandbookConfirm, setShowHandbookConfirm] = useState(false);
  const [docError, setDocError] = useState("");

  useEffect(() => {
    api.get("/employee/sections")
      .then(r => setSections(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const completed = sections.filter(s => s.status === "Completed").length;
  const progress  = sections.length ? Math.round(completed / sections.length * 100) : 0;
  const allDone   = sections.length > 0 && completed === sections.length;

  useEffect(() => {
    if (allDone) {
      api.get("/employee/documents").then(r => setDocs(r.data)).catch(() => {});
    }
  }, [allDone]);

  const handleRegeneratePacket = async () => {
    setRegenerating(true); setDocError("");
    setDocs(d => d ? { ...d, packet: { ...d.packet, ready: false } } : d);
    try {
      await api.post("/employee/generate-pdf", { force: true }, { timeout: 15000 });
      let attempts = 0;
      const poll = async () => {
        try {
          const res = await api.post("/employee/generate-pdf", {}, { timeout: 15000 });
          if (res.data?.ready) {
            setDocs(d => d ? { ...d, packet: { ...d.packet, ready: true } } : d);
            setRegenerating(false);
          } else if (attempts++ < 20) setTimeout(poll, 3000);
          else { setRegenerating(false); setDocError("PDF is taking longer than expected. Try downloading again shortly."); }
        } catch { if (attempts++ < 20) setTimeout(poll, 3000); else setRegenerating(false); }
      };
      poll();
    } catch (err) {
      setDocError(err.response?.data?.message || "Regeneration failed. Please try again.");
      setRegenerating(false);
    }
  };

  const handleDownloadPacket = async () => {
    setDownloading(true); setDocError("");
    try {
      const res = await api.get("/employee/download-packet", { responseType: "blob", timeout: 30000 });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(user?.name || "employee").replace(/[^a-zA-Z0-9]/g, "_")}_Onboarding_Packet.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      let msg = "Download failed.";
      if (err.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text()).message || msg; } catch {}
      }
      if (msg.toLowerCase().includes("expired")) {
        setDownloading(false);
        handleRegeneratePacket();
        return;
      }
      setDocError(msg);
    } finally { setDownloading(false); }
  };

  const handleDownloadHandbook = async () => {
    setHandbookDownloading(true); setDocError(""); setShowHandbookConfirm(false);
    try {
      const res = await api.post("/employee/acknowledge-handbook", {}, { responseType: "blob", timeout: 30000 });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(user?.name || "employee").replace(/[^a-zA-Z0-9]/g, "_")}_Employee_Handbook.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDocs(d => d ? { ...d, handbook: { ...d.handbook, acknowledged: true, acknowledgedAt: new Date().toISOString() } } : d);
    } catch (err) {
      let msg = "Download failed. Please contact HR.";
      if (err.response?.data instanceof Blob) {
        try { msg = JSON.parse(await err.response.data.text()).message || msg; } catch {}
      }
      setDocError(msg);
    } finally { setHandbookDownloading(false); }
  };

  const statusBadge = (status) => ({
    Completed:    <span className="badge-completed"><span className="material-symbols-outlined text-base">check_circle</span>Completed</span>,
    "In Progress": <span className="badge-progress"><span className="material-symbols-outlined text-base">pending</span>In Progress</span>,
    "Not Started": <span className="badge-notstarted">Not Started</span>,
  }[status] || null);

  const actionBtn = (s) => {
    if (s.status === "Completed") return (
      <button onClick={() => navigate(`/onboarding/section/${s.id}`)}
        className="text-secondary hover:text-primary text-label-lg font-semibold transition-colors">Review</button>
    );
    return (
      <button onClick={() => navigate(`/onboarding/section/${s.id}`)}
        className="btn-primary py-1.5 px-4 text-sm">
        {s.status === "In Progress" ? "Continue" : "Start"}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-surface">
      <EmployeeNav />
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Welcome */}
        <div className="mb-6">
          <h1 className="font-headline font-bold text-display-lg text-on-surface">
            Welcome, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-secondary text-body-md mt-1">
            {allDone ? "Your onboarding is complete." : "Here's your onboarding progress"}
          </p>
        </div>

        {/* Progress card */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-headline font-semibold text-headline-sm text-on-surface">
              {completed} of {sections.length} sections completed
            </p>
            <span className={`text-label-lg font-semibold ${progress === 100 ? "text-success" : "text-warning"}`}>
              {progress === 100 ? "✅ Complete" : `${progress}% · In Progress`}
            </span>
          </div>
          <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* My Documents — visible once onboarding is complete */}
        {allDone && (
          <div className="card mb-6">
            <h2 className="font-headline font-semibold text-headline-sm text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">folder_open</span>
              My Documents
            </h2>

            {docError && (
              <div className="mb-4 p-3 bg-error-container rounded-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-xl">error</span>
                <p className="text-error text-body-md">{docError}</p>
              </div>
            )}

            <div className="space-y-3">
              {/* Orientation Packet */}
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl">description</span>
                  <div>
                    <p className="text-label-lg font-semibold text-on-surface">Signed Orientation Packet</p>
                    <p className="text-label-sm text-secondary">
                      {regenerating
                        ? "Regenerating your PDF..."
                        : docs?.packet?.ready
                          ? `Completed · ${docs.packet.dateCompleted ? new Date(docs.packet.dateCompleted).toLocaleDateString() : "Ready"}`
                          : "Generating — check back shortly"}
                    </p>
                  </div>
                </div>
                <button onClick={handleDownloadPacket} disabled={downloading || regenerating || !docs?.packet?.ready}
                  className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
                  {downloading || regenerating
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <span className="material-symbols-outlined text-xl">download</span>}
                  {downloading ? "Downloading..." : regenerating ? "Regenerating..." : "Download PDF"}
                </button>
              </div>

              {/* Employee Handbook */}
              <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl">menu_book</span>
                  <div>
                    <p className="text-label-lg font-semibold text-on-surface">Employee Handbook</p>
                    {docs?.handbook?.acknowledged ? (
                      <p className="text-label-sm text-success flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        Received {docs.handbook.acknowledgedAt ? `· ${new Date(docs.handbook.acknowledgedAt).toLocaleDateString()}` : ""}
                      </p>
                    ) : (
                      <p className="text-label-sm text-secondary">Download and acknowledge receipt</p>
                    )}
                  </div>
                </div>
                {docs?.handbook?.available ? (
                  <button
                    onClick={() => docs?.handbook?.acknowledged ? handleDownloadHandbook() : setShowHandbookConfirm(true)}
                    disabled={handbookDownloading}
                    className="btn-secondary flex items-center gap-2 text-sm">
                    {handbookDownloading
                      ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : <span className="material-symbols-outlined text-xl">download</span>}
                    {handbookDownloading ? "Downloading..." : docs?.handbook?.acknowledged ? "Download Again" : "Download"}
                  </button>
                ) : (
                  <span className="text-label-sm text-secondary italic">Not yet available</span>
                )}
              </div>
            </div>

            {/* Handbook confirmation modal */}
            {showHandbookConfirm && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="material-symbols-outlined text-primary text-2xl">menu_book</span>
                    <h3 className="font-headline font-semibold text-headline-sm text-on-surface">
                      Acknowledge Receipt
                    </h3>
                  </div>
                  <p className="text-body-md text-on-surface mb-6">
                    By downloading this handbook, you confirm receipt and acknowledgement of the{" "}
                    <strong>Angel Trans LLC Employee Handbook</strong>. This will be recorded with your name and the date.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowHandbookConfirm(false)} className="btn-secondary flex-1">
                      Cancel
                    </button>
                    <button onClick={handleDownloadHandbook} className="btn-primary flex-1 flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-xl">download</span>
                      Confirm & Download
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section table */}
        <div className="card p-0 overflow-hidden">
          <div className="p-6 border-b border-outline-variant flex items-center justify-between">
            <h2 className="font-headline font-semibold text-headline-sm text-on-surface">Your Orientation Sections</h2>
            <div className="flex items-center gap-4 text-label-md text-secondary">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-success rounded-full inline-block" />Completed</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-warning rounded-full inline-block" />In Progress</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-secondary rounded-full inline-block" />Not Started</span>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-surface-container-low">
                <tr>
                  {["#", "Section", "Status", "Action"].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-label-md text-secondary font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {sections.map((s, i) => (
                  <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 text-label-md text-secondary font-semibold w-12">{i + 1}</td>
                    <td className="px-6 py-4 text-body-md text-on-surface font-medium">{s.title}</td>
                    <td className="px-6 py-4">{statusBadge(s.status)}</td>
                    <td className="px-6 py-4">{actionBtn(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
