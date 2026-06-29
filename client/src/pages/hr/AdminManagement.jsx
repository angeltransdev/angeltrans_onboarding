import { useState, useEffect } from "react";
import { HRSidebar } from "../../components/layout/HRSidebar";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export default function AdminManagement() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState({ name:"", email:"", role:"hr_admin" });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const fetchAdmins = () => {
    api.get("/hr/admins").then(r => setAdmins(r.data)).catch(()=>{}).finally(()=>setLoading(false));
  };
  useEffect(fetchAdmins, []);

  const handleAdd = async (e) => {
    e.preventDefault(); setError(""); setAdding(true);
    try {
      await api.post("/hr/admins", form);
      setForm({ name:"", email:"", role:"hr_admin" });
      setShowForm(false); fetchAdmins();
    } catch(err) { setError(err.response?.data?.message || "Failed to add admin."); }
    finally { setAdding(false); }
  };

  const handleRemove = async (id) => {
    if(!confirm("Remove this admin?")) return;
    try { await api.delete(`/hr/admins/${id}`); fetchAdmins(); }
    catch { alert("Failed to remove admin."); }
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <HRSidebar />
      <main className="ml-64 flex-1 p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-headline font-bold text-display-lg text-on-surface">Admin Management</h1>
            <p className="text-secondary text-body-md mt-1">Manage who has HR admin access to this portal.</p>
          </div>
          {user?.role === "owner" && (
            <button onClick={() => setShowForm(p=>!p)} className="btn-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-xl">person_add</span>
              Add Admin
            </button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <div className="card mb-6">
            <h2 className="font-headline font-semibold text-headline-sm text-on-surface mb-4">Add New Admin</h2>
            {error && <div className="mb-4 p-3 bg-error-container rounded-lg"><p className="text-error text-body-md">{error}</p></div>}
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Full Name *</label>
                <input required placeholder="Full name" className="input-field"
                  value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Email Address *</label>
                <input required type="email" placeholder="email@angeltrans.com" className="input-field"
                  value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} />
              </div>
              <div>
                <label className="block text-label-lg text-on-surface mb-1.5">Role *</label>
                <select className="input-field" value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                  <option value="hr_admin">HR Admin</option>
                  {user?.role === "owner" && <option value="owner">Owner</option>}
                </select>
              </div>
              <div className="sm:col-span-3 flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={adding} className="btn-primary flex items-center gap-2">
                  {adding ? "Adding..." : <><span className="material-symbols-outlined text-xl">send</span> Send Invitation</>}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card p-0 overflow-hidden">
          <div className="p-6 border-b border-outline-variant">
            <h2 className="font-headline font-semibold text-headline-sm text-on-surface">Current Admins</h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-surface-container-low">
                <tr>
                  {["Name","Email","Role","Status",""].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-label-md text-secondary font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {admins.map(admin => (
                  <tr key={admin.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-label-md font-bold">
                          {admin.name.charAt(0)}
                        </div>
                        <span className="text-body-md font-semibold text-on-surface">{admin.name}
                          {admin.id === user?.id && <span className="ml-2 text-label-sm text-secondary">(You)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-body-md text-secondary">{admin.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-label-md font-semibold ${
                        admin.role === "owner" ? "bg-primary-light text-primary" : "bg-surface-container text-secondary"
                      }`}>{admin.role === "owner" ? "Owner" : "HR Admin"}</span>
                    </td>
                    <td className="px-6 py-4"><span className="badge-completed">Active</span></td>
                    <td className="px-6 py-4">
                      {user?.role === "owner" && admin.id !== user?.id && (
                        <button onClick={() => handleRemove(admin.id)}
                          className="text-error hover:text-red-800 transition-colors">
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
