import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { HRSidebar } from "../../components/layout/HRSidebar";
import api from "../../services/api";

const StatCard = ({ icon, label, value, color, sub }) => (
  <div className="card flex items-start gap-3">
    <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <span className="material-symbols-outlined text-white text-xl sm:text-2xl">{icon}</span>
    </div>
    <div className="min-w-0">
      <p className="text-secondary text-label-sm sm:text-body-md truncate">{label}</p>
      <p className="font-headline font-bold text-2xl sm:text-3xl text-on-surface mt-0.5">{value}</p>
      {sub && <p className="text-label-sm text-secondary mt-0.5">{sub}</p>}
    </div>
  </div>
);

export default function HRDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total:0, onboarding:0, active:0, termPending:0, terminated:0 });
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Status");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, empRes] = await Promise.all([
          api.get("/hr/stats"),
          api.get("/hr/employees")
        ]);
        setStats(statsRes.data);
        setEmployees(empRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const filtered = employees.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
                        e.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "All Status" || e.status === filter;
    return matchSearch && matchFilter;
  });

  const statusBadge = (status) => {
    const map = {
      Onboarding: "badge-progress",
      Active: "badge-completed",
      "Termination Pending": "bg-warning-container text-warning inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-md",
      Terminated: "badge-terminated",
    };
    return <span className={map[status] || "badge-notstarted"}>{status}</span>;
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <HRSidebar />
      <main className="lg:ml-64 flex-1 p-4 lg:p-8 mt-14 lg:mt-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 lg:mb-8">
          <div>
            <h1 className="font-headline font-bold text-2xl sm:text-display-lg text-on-surface">HR Dashboard</h1>
            <p className="text-secondary text-body-md mt-1">Overview of all employees</p>
          </div>
          <button onClick={() => navigate("/hr/send-onboarding")}
            className="btn-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-xl">person_add</span>
            New Employee
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard icon="group" label="Total Employees" value={stats.total} color="bg-on-surface" />
          <StatCard icon="pending" label="Onboarding" value={stats.onboarding}
            sub={`${stats.total ? Math.round(stats.onboarding/stats.total*100) : 0}%`} color="bg-warning" />
          <StatCard icon="check_circle" label="Active" value={stats.active}
            sub={`${stats.total ? Math.round(stats.active/stats.total*100) : 0}%`} color="bg-success" />
          <StatCard icon="schedule" label="Term. Pending" value={stats.termPending}
            sub={`${stats.total ? Math.round(stats.termPending/stats.total*100) : 0}%`} color="bg-primary" />
          <StatCard icon="person_off" label="Terminated" value={stats.terminated}
            sub={`${stats.total ? Math.round(stats.terminated/stats.total*100) : 0}%`} color="bg-error" />
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-outline-variant flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-xl">search</span>
              <input type="text" placeholder="Search employees..."
                className="input-field pl-10"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input-field w-auto min-w-40" value={filter} onChange={e => setFilter(e.target.value)}>
              {["All Status","Onboarding","Active","Termination Pending","Terminated"].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Mobile card list ── */}
              <div className="sm:hidden divide-y divide-outline-variant">
                {filtered.length === 0 ? (
                  <p className="text-center py-8 text-secondary text-body-md">No employees found</p>
                ) : filtered.map(emp => (
                  <div key={emp.id}
                    className="p-4 flex items-center gap-3 active:bg-surface-container-low cursor-pointer"
                    onClick={() => navigate(`/hr/employees/${emp.id}`)}>
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white text-label-lg font-bold flex-shrink-0">
                      {emp.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-body-md font-semibold text-on-surface">{emp.name}</p>
                        {statusBadge(emp.status)}
                      </div>
                      <p className="text-label-sm text-secondary truncate">{emp.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-20 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${emp.progress}%` }} />
                        </div>
                        <span className="text-label-sm text-secondary">{emp.completedSections}/{emp.totalSections} sections</span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-secondary flex-shrink-0">chevron_right</span>
                  </div>
                ))}
              </div>

              {/* ── Desktop table ── */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-container-low">
                    <tr>
                      {["Employee","Email","Status","Progress","Date Sent","Last Activity",""].map(h => (
                        <th key={h} className="text-left px-6 py-3 text-label-md text-secondary font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-secondary text-body-md">No employees found</td></tr>
                    ) : filtered.map(emp => (
                      <tr key={emp.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-label-md font-bold flex-shrink-0">
                              {emp.name.charAt(0)}
                            </div>
                            <span className="text-body-md font-semibold text-on-surface">{emp.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-body-md text-secondary">{emp.email}</td>
                        <td className="px-6 py-4">{statusBadge(emp.status)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 bg-surface-container rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${emp.progress}%` }} />
                            </div>
                            <span className="text-label-md text-secondary">{emp.completedSections}/{emp.totalSections}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-body-md text-secondary">{emp.dateSent}</td>
                        <td className="px-6 py-4 text-body-md text-secondary">{emp.lastActivity}</td>
                        <td className="px-6 py-4">
                          <button onClick={() => navigate(`/hr/employees/${emp.id}`)}
                            className="text-secondary hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-xl">more_horiz</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
