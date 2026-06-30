import logo from '../../assets/logo.png';
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { to: "/hr/dashboard", icon: "dashboard", label: "Dashboard" },
  { to: "/hr/employees", icon: "group", label: "Employees" },
  { to: "/hr/send-onboarding", icon: "send", label: "Send Onboarding" },
  { to: "/hr/terminations", icon: "person_off", label: "Terminations" },
  { to: "/hr/documents", icon: "folder_open", label: "Documents" },
  { to: "/hr/admins", icon: "admin_panel_settings", label: "Admin Management" },
  { to: "/hr/settings", icon: "business", label: "Company Settings" },
];

export const HRSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <aside className="w-64 min-h-screen bg-on-surface flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Angel Trans LLC" className="h-10 object-contain brightness-0 invert" />
          <div>
            <p className="text-white/50 text-label-sm mt-1">HR Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, icon, label }) => (
          <NavLink key={to} to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body-md transition-colors ${
                isActive
                  ? "bg-primary text-white font-semibold"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }>
            <span className="material-symbols-outlined text-xl">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-white text-label-md font-bold">
              {user?.name?.charAt(0) || "A"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-label-md font-semibold truncate">{user?.name}</p>
            <p className="text-white/50 text-label-sm capitalize">{user?.role}</p>
          </div>
        </div>
        {user?.role === "employee" && (
          <a href="/onboarding"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white text-body-md transition-colors mb-1">
            <span className="material-symbols-outlined text-xl">person</span>
            Employee Portal
          </a>
        )}
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white text-body-md transition-colors">
          <span className="material-symbols-outlined text-xl">logout</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
};
