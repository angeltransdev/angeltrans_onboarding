import logo from '../../assets/logo.png';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export const EmployeeNav = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <header className="bg-white border-b border-outline-variant sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Angel Trans LLC" className="h-10 object-contain" />
          <div>
            <p className="text-secondary text-label-sm">Employee Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {user?.isHrAdmin && (
            <a href="/hr/dashboard"
              className="flex items-center gap-1.5 bg-primary text-white hover:bg-primary/90 transition-colors rounded-lg px-3 py-1.5 text-label-md font-semibold">
              <span className="material-symbols-outlined text-base">admin_panel_settings</span>
              HR Portal
            </a>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-label-md font-semibold text-on-surface">{user?.name}</p>
            <p className="text-label-sm text-secondary">Employee</p>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-secondary hover:text-primary text-body-md transition-colors">
            <span className="material-symbols-outlined text-xl">logout</span>
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
