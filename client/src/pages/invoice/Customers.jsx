import { useEffect, useState } from "react";
import api from "../../services/api";
import { Alert, errorMessage, Field, Layout } from "./shared";

const empty = { name: "", email: "", address: "", phone: "" };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = () => api.get("/invoices/customers").then(r => setCustomers(r.data));
  useEffect(() => { load().catch(e => setError(errorMessage(e, "Could not load customers."))).finally(() => setLoading(false)); }, []);
  const save = async e => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      if (form.id) await api.put(`/invoices/customers/${form.id}`, form);
      else await api.post("/invoices/customers", form);
      setForm(null);
      try { await load(); } catch { setError("Customer saved, but the list could not be refreshed. Reload the page."); }
    } catch (err) { setError(errorMessage(err, "Could not save customer.")); }
    finally { setSaving(false); }
  };
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  return <Layout title="Customers" subtitle="Manage the people and businesses you bill." action={<button className="btn-primary" onClick={() => { setError(""); setForm({ ...empty }); }}>+ Add customer</button>}>
    <Alert error={error} />
    {form && <form className="card space-y-4 mb-6" onSubmit={save}>
      <h2 className="font-semibold text-headline-sm">{form.id ? "Edit customer" : "New customer"}</h2>
      <Field label="Name *"><input className="input-field" required maxLength={255} value={form.name} onChange={e => set("name", e.target.value)} /></Field>
      <Field label="Email *"><input className="input-field" required type="email" maxLength={255} value={form.email} onChange={e => set("email", e.target.value)} /></Field>
      <Field label="Address"><textarea className="input-field" maxLength={2000} value={form.address} onChange={e => set("address", e.target.value)} /></Field>
      <Field label="Phone"><input className="input-field" maxLength={100} value={form.phone} onChange={e => set("phone", e.target.value)} /></Field>
      <div className="flex gap-3"><button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save customer"}</button><button type="button" className="btn-secondary" onClick={() => setForm(null)}>Cancel</button></div>
    </form>}
    <div className="invoice-panel">{loading ? <p className="p-6 text-slate-500">Loading customers...</p> : customers.length === 0 ? <p className="p-6 text-slate-500">No customers yet.</p> :
      <div className="overflow-x-auto"><table className="invoice-table invoice-document-table"><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>PHONE</th><th aria-label="Actions"></th></tr></thead>
        <tbody>{customers.map(c => <tr key={c.id}><td className="font-semibold">{c.name}</td><td>{c.email}</td><td>{c.phone || "—"}</td><td className="text-right"><button className="text-primary font-semibold" onClick={() => { setError(""); setForm({ ...c }); }}>Edit</button></td></tr>)}</tbody></table></div>}</div>
  </Layout>;
}
