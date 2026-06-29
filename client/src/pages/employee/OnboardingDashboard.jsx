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

  useEffect(() => {
    api.get("/employee/sections").then(r => setSections(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const completed = sections.filter(s => s.status === "Completed").length;
  const progress = sections.length ? Math.round(completed/sections.length*100) : 0;

  const statusBadge = (status) => ({
    Completed: <span className="badge-completed"><span className="material-symbols-outlined text-base">check_circle</span>Completed</span>,
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
          <p className="text-secondary text-body-md mt-1">Here's your onboarding progress</p>
        </div>

        {/* Progress card */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="font-headline font-semibold text-headline-sm text-on-surface">
              {completed} of {sections.length} sections completed
            </p>
            <span className={`text-label-lg font-semibold ${
              progress === 100 ? "text-success" : "text-warning"
            }`}>
              {progress === 100 ? "✅ Complete" : `${progress}% · In Progress`}
            </span>
          </div>
          <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Section table */}
        <div className="card p-0 overflow-hidden">
          <div className="p-6 border-b border-outline-variant flex items-center justify-between">
            <h2 className="font-headline font-semibold text-headline-sm text-on-surface">Your Orientation Sections</h2>
            <div className="flex items-center gap-4 text-label-md text-secondary">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-success rounded-full inline-block"></span>Completed</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-warning rounded-full inline-block"></span>In Progress</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-secondary rounded-full inline-block"></span>Not Started</span>
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
                  {["#","Section","Status","Action"].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-label-md text-secondary font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {sections.map((s, i) => (
                  <tr key={s.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 text-label-md text-secondary font-semibold w-12">{i+1}</td>
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
