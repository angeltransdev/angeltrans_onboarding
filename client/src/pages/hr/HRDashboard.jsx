import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { UsersRound, UserRoundCheck, UserRoundPlus, UserRoundMinus, Clock3, Search, Plus, ArrowRight } from "lucide-react";
import { HRSidebar } from "../../components/layout/HRSidebar";
import api from "../../services/api";
import "./workspace-ui.css";

const metrics = [
  { key: "total", label: "Total employees", icon: UsersRound, note: "All employee records" },
  { key: "onboarding", label: "Onboarding", icon: UserRoundPlus, note: "In progress" },
  { key: "active", label: "Active", icon: UserRoundCheck, note: "Active employees" },
  { key: "termPending", label: "Pending termination", icon: Clock3, note: "Awaiting completion" },
  { key: "terminated", label: "Terminated", icon: UserRoundMinus, note: "Former employees" },
];

const badgeClass = status => ({
  Active: "admin-status-active", Onboarding: "admin-status-onboarding",
  "Termination Pending": "admin-status-onboarding", Terminated: "admin-status-terminated",
}[status] || "");

export default function HRDashboard() {
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Status");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/hr/stats"), api.get("/hr/employees")])
      .then(([statsRes, empRes]) => { if (active) { setStats(statsRes.data); setEmployees(empRes.data); } })
      .catch(() => { if (active) setError("Could not load employee information. Please refresh the page."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = employees.filter(e => {
    const query = search.trim().toLowerCase();
    return (e.name.toLowerCase().includes(query) || e.email.toLowerCase().includes(query)) &&
      (filter === "All Status" || e.status === filter);
  });

  return <div className="flex min-h-screen"><HRSidebar />
    <main className="admin-workspace lg:ml-64 flex-1 min-w-0 p-4 lg:p-8 mt-14 lg:mt-0"><div className="admin-page">
      <header className="admin-page-head"><div><p className="admin-kicker">OVERVIEW</p><h1>HR Dashboard</h1><p>Your people, onboarding, and employee activity at a glance.</p></div>
        <Link to="/hr/send-onboarding" className="admin-button admin-button-primary"><Plus size={17} /> New employee</Link></header>
      {error && <div role="alert" className="admin-alert">{error}</div>}
      <section className="admin-metrics" aria-label="Employee overview">{metrics.map(({ key, label, icon: Icon, note }) =>
        <div className="admin-metric" key={key}><div className="admin-metric-top"><span>{label}</span><span className="admin-metric-icon"><Icon size={18} strokeWidth={1.8} /></span></div>
          <strong className="admin-metric-value">{loading ? "—" : stats ? stats[key] : "—"}</strong><span className="admin-metric-note">{note}</span></div>)}</section>
      <section className="admin-panel" aria-labelledby="employee-directory-heading">
        <div className="admin-panel-head"><div><h2 id="employee-directory-heading">Employee directory</h2><p>View and manage your employee records.</p></div>
          {!loading && !error && <span className="admin-count">{filtered.length} {filtered.length === 1 ? "employee" : "employees"}</span>}</div>
        <div className="admin-filters"><div className="admin-search"><Search size={17} /><input className="admin-input" aria-label="Search employees" placeholder="Search by name or email" value={search} onChange={e => setSearch(e.target.value)} /></div>
          <select className="admin-input admin-filter-select" aria-label="Filter by status" value={filter} onChange={e => setFilter(e.target.value)}>
            {["All Status", "Onboarding", "Active", "Termination Pending", "Terminated"].map(s => <option key={s}>{s}</option>)}</select></div>
        {loading ? <p className="admin-empty">Loading employees...</p> : error ? <p className="admin-empty">Employee information is unavailable.</p> : filtered.length === 0 ? <p className="admin-empty">No employees found. Try a different search or filter.</p> :
          <><div className="admin-employee-cards">{filtered.map(emp => <Link className="admin-employee-card" to={`/hr/employees/${emp.id}`} key={emp.id}>
            <div className="admin-person"><span className="admin-avatar">{emp.name.charAt(0)}</span><div><strong>{emp.name}</strong><small>{emp.email}</small></div></div>
            <div className="admin-employee-card-meta"><span className={`admin-status ${badgeClass(emp.status)}`}>{emp.status}</span><span>{emp.completedSections}/{emp.totalSections} sections</span><ArrowRight size={16} /></div>
          </Link>)}</div><div className="admin-table-wrap admin-employee-table"><table className="admin-table"><thead><tr><th>EMPLOYEE</th><th>EMAIL</th><th>STATUS</th><th>PROGRESS</th><th>DATE SENT</th><th>LAST ACTIVITY</th><th>ACTION</th></tr></thead>
            <tbody>{filtered.map(emp => <tr key={emp.id}><td><div className="admin-person"><span className="admin-avatar">{emp.name.charAt(0)}</span><strong>{emp.name}</strong></div></td>
              <td>{emp.email}</td><td><span className={`admin-status ${badgeClass(emp.status)}`}>{emp.status}</span></td>
              <td><div className="admin-progress"><div className="admin-progress-track"><span style={{ width: `${emp.progress}%` }} /></div><span>{emp.completedSections}/{emp.totalSections}</span></div></td>
              <td>{emp.dateSent}</td><td>{emp.lastActivity}</td><td><Link className="admin-link" to={`/hr/employees/${emp.id}`} aria-label={`View ${emp.name}`} >View <ArrowRight size={14} /></Link></td>
            </tr>)}</tbody></table></div></>}
      </section>
    </div></main>
  </div>;
}
