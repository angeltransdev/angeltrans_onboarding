import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HRSidebar } from "../../components/layout/HRSidebar";
import api from "../../services/api";

export default function TerminatedEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/hr/employees?status=Terminated,Termination Pending")
      .then(r => setEmployees(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-surface">
      <HRSidebar />
      <main className="ml-64 flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-headline font-bold text-display-lg text-on-surface">Terminated Employees</h1>
            <p className="text-secondary text-body-md mt-1">View all terminated employees</p>
          </div>
          <button onClick={() => navigate("/hr/initiate-termination")} className="btn-danger flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">person_off</span>
            Initiate Termination
          </button>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="p-6 border-b border-outline-variant">
            <div className="relative max-w-sm">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-xl">search</span>
              <input type="text" placeholder="Search terminated employees..."
                className="input-field pl-10" value={search} onChange={e => setSearch(e.target.value)} />
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
                    {["Employee","Email","Termination Date","Reason","Status","Actions"].map(h => (
                      <th key={h} className="text-left px-6 py-3 text-label-md text-secondary font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-secondary text-body-md">No terminated employees</td></tr>
                  ) : filtered.map(emp => (
                    <tr key={emp.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-error rounded-full flex items-center justify-center text-white text-label-md font-bold">
                            {emp.name.charAt(0)}
                          </div>
                          <span className="text-body-md font-semibold text-on-surface">{emp.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-body-md text-secondary">{emp.email}</td>
                      <td className="px-6 py-4 text-body-md text-secondary">{emp.terminationDate || "—"}</td>
                      <td className="px-6 py-4 text-body-md text-secondary">{emp.terminationReason || "—"}</td>
                      <td className="px-6 py-4">
                        <span className={emp.status === "Terminated" ? "badge-terminated" : "badge-progress"}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => navigate(`/hr/employees/${emp.id}`)}
                            className="text-secondary hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-xl">visibility</span>
                          </button>
                          <button className="text-secondary hover:text-primary transition-colors">
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
