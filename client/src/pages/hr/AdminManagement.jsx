import { useState, useEffect, useCallback } from "react";
import { UserPlus, Trash2, Send } from "lucide-react";
import { HRSidebar } from "../../components/layout/HRSidebar";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import "./workspace-ui.css";

const emptyForm = () => ({ name: "", email: "", role: "hr_admin" });

export default function AdminManagement() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [grantCandidate, setGrantCandidate] = useState(null);
  const [granting, setGranting] = useState(false);
  const isOwner = user?.role === "owner";

  const fetchAdmins = useCallback(async () => {
    const response = await api.get("/hr/admins");
    setAdmins(response.data);
  }, []);
  useEffect(() => {
    let active = true;
    api.get("/hr/admins").then(r => { if (active) setAdmins(r.data); })
      .catch(() => { if (active) setError("Could not load administrators. Please refresh the page."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const refreshAfterAction = async () => {
    try { await fetchAdmins(); }
    catch { setError("The action succeeded, but the list could not be refreshed. Please reload the page."); }
  };
  const handleAdd = async e => {
    e.preventDefault(); setError(""); setSuccess(""); setGrantCandidate(null); setAdding(true);
    try {
      await api.post("/hr/admins", form);
      setForm(emptyForm()); setShowForm(false); setSuccess("Invitation sent.");
      await refreshAfterAction();
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 409 && data?.canGrant) setGrantCandidate({ userId: data.userId, userName: data.userName });
      setError(data?.message || "Failed to add admin.");
    } finally { setAdding(false); }
  };
  const handleGrant = async () => {
    if (!grantCandidate) return;
    setGranting(true); setError(""); setSuccess("");
    try {
      const res = await api.post(`/hr/admins/grant/${grantCandidate.userId}`);
      setGrantCandidate(null); setForm(emptyForm()); setShowForm(false); setSuccess(res.data.message);
      await refreshAfterAction();
    } catch (err) { setError(err.response?.data?.message || "Failed to grant access."); }
    finally { setGranting(false); }
  };
  const handleRemove = async admin => {
    if (!window.confirm(`Remove admin access for ${admin.name}?`)) return;
    setRemovingId(admin.id); setError(""); setSuccess("");
    try {
      await api.delete(`/hr/admins/${admin.id}`);
      setSuccess(`Admin access removed for ${admin.name}.`);
      await refreshAfterAction();
    } catch (err) { setError(err.response?.data?.message || "Failed to remove admin."); }
    finally { setRemovingId(null); }
  };
  const closeForm = () => { setShowForm(false); setGrantCandidate(null); setError(""); };
  return <div className="flex min-h-screen"><HRSidebar />
    <main className="admin-workspace lg:ml-64 flex-1 min-w-0 p-4 lg:p-8 mt-14 lg:mt-0"><div className="admin-page">
      <header className="admin-page-head"><div><p className="admin-kicker">SETTINGS / ACCESS</p><h1>Admin Management</h1><p>Manage the people who have administrative access to your workspace.</p></div>
        {isOwner && <button className="admin-button admin-button-primary" onClick={() => { if (showForm) closeForm(); else { setError(""); setSuccess(""); setShowForm(true); } }}><UserPlus size={17} /> {showForm ? "Close form" : "Add admin"}</button>}</header>
      {error && <div role="alert" className="admin-alert">{error}</div>}
      {success && <div role="status" className="admin-alert admin-success">{success}</div>}
      {showForm && <section className="admin-panel admin-form" aria-labelledby="add-admin-heading"><h2 id="add-admin-heading">Invite an administrator</h2>
        <p className="admin-form-subtitle">Enter their details and send an invitation to join the workspace.</p>
        {grantCandidate && <div className="admin-grant"><strong>Grant HR access to an existing employee?</strong>
          <p><strong>{grantCandidate.userName}</strong> already has an employee account. They can use both portals and keep their current password.</p>
          <div className="admin-grant-actions"><button type="button" className="admin-button admin-button-secondary" onClick={() => { setGrantCandidate(null); setError(""); }}>Cancel</button>
            <button type="button" className="admin-button admin-button-primary" onClick={handleGrant} disabled={granting}>{granting ? "Granting..." : "Grant HR access"}</button></div></div>}
        <form onSubmit={handleAdd}><div className="admin-form-grid">
          <label>Full name *<input required placeholder="Full name" className="admin-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></label>
          <label>Email address *<input required type="email" placeholder="name@example.com" className="admin-input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></label>
          <label>Role *<select className="admin-input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}><option value="hr_admin">HR Admin</option><option value="owner">Owner</option></select></label>
        </div><div className="admin-form-actions"><button type="submit" disabled={adding} className="admin-button admin-button-primary"><Send size={15} /> {adding ? "Sending..." : "Send invitation"}</button>
          <button type="button" onClick={closeForm} className="admin-button admin-button-secondary">Cancel</button></div></form>
      </section>}
      <section className="admin-panel" aria-labelledby="admins-heading">
        <div className="admin-panel-head"><div><h2 id="admins-heading">Administrators</h2><p>People with access to the HR workspace.</p></div>
          {!loading && <span className="admin-count">{admins.length} {admins.length === 1 ? "admin" : "admins"}</span>}</div>
        {loading ? <p className="admin-empty">Loading administrators...</p> : admins.length === 0 ? <p className="admin-empty">{error ? "Administrator information is unavailable." : "No administrators found."}</p> :
          <><p className="admin-scroll-hint">Scroll the table to see actions.</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>ACTION</th></tr></thead>
            <tbody>{admins.map(admin => <tr key={admin.id}><td><div className="admin-person"><span className="admin-avatar">{admin.name.charAt(0)}</span>
              <div><strong>{admin.name}</strong>{admin.id === user?.id && <small>Your account</small>}</div></div></td>
              <td>{admin.email}</td><td><span className="admin-status">{admin.role === "owner" ? "Owner" : admin.role === "employee" ? "Employee + HR" : "HR Admin"}</span></td>
              <td><span className="admin-status admin-status-active">Active</span></td><td>
                {isOwner && admin.id !== user?.id ? <button className="admin-button admin-button-danger" aria-label={`Remove admin access for ${admin.name}`} disabled={!!removingId} onClick={() => handleRemove(admin)}>
                  <Trash2 size={14} /> {removingId === admin.id ? "Removing..." : "Remove"}</button> : <span className="text-slate-400">—</span>}
              </td></tr>)}</tbody></table></div></>}
      </section>
    </div></main>
  </div>;
}
