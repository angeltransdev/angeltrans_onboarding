import logo from '../../assets/logo.png';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export const EmployeeNav = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <header className="bg-white border-b border-outline-variant sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">

        {/* Left: logo + label */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img
            src={logo}
            alt="Angel Trans LLC"
            className="h-8 sm:h-10 object-contain flex-shrink-0"
            style={{ maxWidth: "120px" }}
          />
          <p className="text-secondary text-label-sm hidden sm:block whitespace-nowrap">Employee Portal</p>
        </div>

        {/* Right: HR portal + logout */}
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {user?.isHrAdmin && (
            <a
              href="/hr/dashboard"
              className="flex items-center gap-1 sm:gap-1.5 bg-primary text-white hover:bg-primary/90 transition-colors rounded-lg px-2.5 sm:px-3 py-1.5 text-label-sm sm:text-label-md font-semibold whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base">admin_panel_settings</span>
              HR<span className="hidden sm:inline"> Portal</span>
            </a>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-label-md font-semibold text-on-surface">{user?.name}</p>
            <p className="text-label-sm text-secondary">Employee</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-secondary hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            <span className="hidden sm:inline text-body-md">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
