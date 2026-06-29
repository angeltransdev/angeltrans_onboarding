import { useState, useEffect } from "react";
import { HRSidebar } from "../../components/layout/HRSidebar";
import api from "../../services/api";

export default function DocumentLibrary() {
  const [tab, setTab] = useState("all");
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/hr/documents?type=${tab}`)
      .then(r => setDocs(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, [tab]);

  const filtered = docs.filter(d =>
    d.employeeName.toLowerCase().includes(search.toLowerCase())
  );

  const handleDownload = async (doc) => {
    try {
      const res = await api.get(`/hr/documents/${doc.id}/download`, { responseType:"blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url;
      a.download = `${doc.employeeName}_${doc.type}.pdf`; a.click();
    } catch { alert("Failed to download document."); }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <HRSidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="mb-8">
          <h1 className="font-headline font-bold text-display-lg text-on-surface">Document Library</h1>
          <p className="text-secondary text-body-md mt-1">Access all signed onboarding and termination packets.</p>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="p-6 border-b border-outline-variant">
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              {[["all","All Documents"],["onboarding","Onboarding Packets"],["termination","Termination Packets"]].map(([k,l]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`px-4 py-2 rounded-lg text-label-lg font-semibold transition-colors ${
                    tab===k ? "bg-primary text-white" : "bg-surface-container text-secondary hover:bg-surface-container-high"
                  }`}>{l}</button>
              ))}
            </div>
            {/* Search */}
            <div className="flex gap-4">
              <div className="relative flex-1 max-w-sm">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-xl">search</span>
                <input type="text" placeholder="Search documents..."
                  className="input-field pl-10" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-container-low">
                  <tr>
                    {["Employee","Document Type","Date Completed","Actions"].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-label-md text-secondary font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-12 text-secondary text-body-md">No documents found</td></tr>
                  ) : filtered.map(doc => (
                    <tr key={doc.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-label-md font-bold">
                            {doc.employeeName.charAt(0)}
                          </div>
                          <span className="text-body-md font-semibold text-on-surface">{doc.employeeName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={doc.type === "Termination Packet" ? "badge-terminated" : "badge-completed"}>
                          {doc.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-body-md text-secondary">{doc.dateCompleted}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button className="text-secondary hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-xl">visibility</span>
                          </button>
                          <button onClick={() => handleDownload(doc)} className="text-secondary hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-xl">download</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
