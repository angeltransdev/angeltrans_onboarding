import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, UsersRound, UserPlus, UserRoundMinus, FolderOpen, Boxes, ShieldCheck, Building2, ReceiptText, ChevronDown, Menu, X, LogOut, ArrowRightLeft } from "lucide-react";
import logo from "../../assets/logo.png";
import { useAuth } from "../../context/AuthContext";
import "./workspace.css";

const groups = [
  { title: "OVERVIEW", items: [{ to: "/hr/dashboard", icon: LayoutDashboard, label: "Dashboard" }] },
  { title: "PEOPLE", items: [
    { to: "/hr/employees", icon: UsersRound, label: "Employees" },
    { to: "/hr/send-onboarding", icon: UserPlus, label: "Send Onboarding" },
    { to: "/hr/terminations", icon: UserRoundMinus, label: "Terminations" },
    { to: "/hr/documents", icon: FolderOpen, label: "Documents" },
  ] },
  { title: "OPERATIONS", items: [{ to: "/hr/assets", icon: Boxes, label: "Assets" }] },
  { title: "SETTINGS", items: [
    { to: "/hr/admins", icon: ShieldCheck, label: "Admin Management" },
    { to: "/hr/settings", icon: Building2, label: "Company Settings" },
  ] },
];

export const HRSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(location.pathname.startsWith("/hr/invoice"));
  const close = () => setMobileOpen(false);
  const signOut = () => { logout(); navigate("/login"); };
  const navGroup = group => <div className="workspace-nav-group" key={group.title}>
    <p className="workspace-nav-label">{group.title}</p>
    {group.items.map(({ to, icon: Icon, label }) => <NavLink key={to} to={to} onClick={close}
      className={({ isActive }) => `workspace-nav-link${isActive ? " is-active" : ""}`}>
      <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
    </NavLink>)}
  </div>;

  return <>
    <header className="workspace-mobile-bar lg:hidden">
      <button type="button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={21} /></button>
      <img src={logo} alt="Angel Trans LLC" /><span>Admin workspace</span>
    </header>
    {mobileOpen && <button className="workspace-overlay lg:hidden" aria-label="Close navigation" onClick={close} />}
    <aside className={`workspace-sidebar ${mobileOpen ? "workspace-sidebar-open" : ""}`}>
      <div className="workspace-brand">
        <img src={logo} alt="Angel Trans LLC" />
        <div><strong>ANGEL TRANS</strong><span>ADMIN WORKSPACE</span></div>
        <button className="workspace-close lg:hidden" aria-label="Close navigation" onClick={close}><X size={20} /></button>
      </div>
      <nav className="workspace-navigation" aria-label="Main navigation">
        {groups.slice(0, 3).map(navGroup)}
        <div className="workspace-nav-group">
          <p className="workspace-nav-label">BILLING</p>
          <button type="button" className={`workspace-nav-link workspace-nav-toggle${location.pathname.startsWith("/hr/invoice") ? " is-parent-active" : ""}`}
            aria-expanded={invoiceOpen} onClick={() => setInvoiceOpen(!invoiceOpen)}>
            <ReceiptText size={18} strokeWidth={1.8} /><span>Invoice</span><ChevronDown size={16} className={invoiceOpen ? "workspace-chevron-open" : ""} />
          </button>
          {invoiceOpen && <div className="workspace-subnav">
            {[{ to: "/hr/invoice/customers", label: "Customers" }, { to: "/hr/invoice/invoices", label: "Invoices" }].map(item =>
              <NavLink key={item.to} to={item.to} onClick={close} className={({ isActive }) => `workspace-subnav-link${isActive ? " is-active" : ""}`}>{item.label}</NavLink>)}
          </div>}
        </div>
        {groups.slice(3).map(navGroup)}
      </nav>
      <div className="workspace-sidebar-footer">
        <div className="workspace-user"><span className="workspace-user-avatar">{user?.name?.charAt(0) || "A"}</span><div><strong>{user?.name}</strong><span>{user?.role === "hr_admin" ? "HR admin" : user?.role}</span></div></div>
        {user?.role === "employee" && <a className="workspace-footer-action" href="/onboarding"><ArrowRightLeft size={16} /> Employee Portal</a>}
        <button className="workspace-footer-action" onClick={signOut}><LogOut size={16} /> Sign out</button>
      </div>
    </aside>
  </>;
};
