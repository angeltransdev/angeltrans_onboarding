import { useEffect, useRef, useState } from "react";
import { Mail, Pencil, Plus, Search, Trash2, UsersRound, X } from "lucide-react";
import api from "../../services/api";
import { Alert, errorMessage, Layout } from "./shared";
import "./customers.css";

const empty = { name: "", email: "", address: "", phone: "" };

function CustomerEditor({ customer, saving, error, onSave, onCancel }) {
  const dialog = useRef(null);
  const [form, setForm] = useState(customer);
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close(); }, []);
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }));

  return <dialog ref={dialog} className="customer-dialog" aria-labelledby="customer-dialog-title"
    onCancel={event => { event.preventDefault(); if (!saving) onCancel(); }}>
    <form onSubmit={event => { event.preventDefault(); onSave(form); }}>
      <header className="customer-dialog-header">
        <div><p className="invoice-list-kicker">CUSTOMER DETAILS</p><h2 id="customer-dialog-title">{customer.id ? "Edit customer" : "Add customer"}</h2>
          <p>These details are used when you create invoices.</p></div>
        <button type="button" className="customer-close" aria-label="Close customer form" disabled={saving} onClick={onCancel}><X size={19} /></button>
      </header>
      <div className="customer-dialog-body">
        <Alert error={error} />
        <label className="invoice-field">Customer name <span className="customer-required">Required</span>
          <input className="invoice-input" required maxLength={255} autoFocus value={form.name} onChange={e => set("name", e.target.value)} placeholder="Business or customer name" /></label>
        <label className="invoice-field">Email address <span className="customer-required">Required</span>
          <input className="invoice-input" required type="email" maxLength={255} value={form.email} onChange={e => set("email", e.target.value)} placeholder="name@example.com" /></label>
        <label className="invoice-field">Phone <span className="customer-optional">Optional</span>
          <input className="invoice-input" type="tel" maxLength={100} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Phone number" /></label>
        <label className="invoice-field">Billing address <span className="customer-optional">Optional</span>
          <textarea className="invoice-input" rows={3} maxLength={2000} value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street address, city, state and ZIP" /></label>
      </div>
      <footer className="customer-dialog-footer"><button type="button" className="customer-button-secondary" disabled={saving} onClick={onCancel}>Cancel</button>
        <button className="invoice-create-button" disabled={saving}>{saving ? "Saving..." : customer.id ? "Save changes" : "Add customer"}</button></footer>
    </form>
  </dialog>;
}

function CustomerActions({ customer, busy, onEdit, onDelete }) {
  return <div className="customer-actions">
    <button className="customer-action" disabled={busy} onClick={() => onEdit(customer)} aria-label={`Edit ${customer.name}`}><Pencil size={15} /> Edit</button>
    {customer.invoiceCount === 0 ? <button className="customer-action customer-action-delete" disabled={busy} onClick={() => onDelete(customer)} aria-label={`Delete ${customer.name}`}><Trash2 size={15} /> Delete</button>
      : <span className="customer-protected">{Number.isInteger(customer.invoiceCount) ? "Linked to invoices" : "Invoice count unavailable"}</span>}
  </div>;
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const load = async () => { const response = await api.get("/invoices/customers"); setCustomers(response.data); };
  useEffect(() => { load().catch(e => { setLoadFailed(true); setError(errorMessage(e, "Could not load customers.")); }).finally(() => setLoading(false)); }, []);

  const edit = customer => { setError(""); setSuccess(""); setFormError(""); setForm(customer ? { ...customer } : { ...empty }); };
  const save = async customer => {
    setBusy(true); setFormError("");
    try {
      if (customer.id) await api.put(`/invoices/customers/${customer.id}`, customer);
      else await api.post("/invoices/customers", customer);
      setForm(null); setSuccess(customer.id ? "Customer updated." : "Customer added.");
      try { await load(); } catch { setError("Customer saved, but the list could not be refreshed. Reload the page."); }
    } catch (err) { setFormError(errorMessage(err, "Could not save customer.")); }
    finally { setBusy(false); }
  };
  const remove = async customer => {
    if (!window.confirm(`Permanently delete ${customer.name}? This cannot be undone.`)) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await api.delete(`/invoices/customers/${customer.id}`);
      setSuccess("Customer deleted.");
      try { await load(); } catch { setError("Customer deleted, but the list could not be refreshed. Reload the page."); }
    } catch (err) {
      setError(errorMessage(err, "Could not delete customer."));
      if (err.response?.status === 409) {
        try { await load(); } catch { setError("This customer may have invoices, and the list could not be refreshed. Reload the page."); }
      }
    } finally { setBusy(false); }
  };
  const query = search.trim().toLowerCase();
  const filtered = customers.filter(c => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(query));

  return <Layout title="Customers" subtitle="Keep your billing contacts organized and ready for invoicing."
    action={<button className="invoice-create-button" disabled={busy} onClick={() => edit(null)}><Plus size={17} /> Add customer</button>}>
    <Alert error={error} />
    {success && <div role="status" className="invoice-list-success">{success}</div>}
    <section className="invoice-list-panel" aria-labelledby="customer-directory-title">
      <div className="invoice-list-heading"><div><p className="invoice-list-kicker">BILLING WORKSPACE</p><h2 id="customer-directory-title">Customer directory</h2>
        <p>Manage the people and businesses you bill.</p></div>
        {!loading && !loadFailed && <span className="invoice-list-count">{filtered.length} {filtered.length === 1 ? "customer" : "customers"}</span>}</div>
      <div className="invoice-list-filters"><div className="invoice-list-search"><Search size={17} /><input className="invoice-input" aria-label="Search customers" placeholder="Search name, email or phone" value={search} onChange={e => setSearch(e.target.value)} /></div></div>
      {loading ? <p className="invoice-list-empty">Loading customers...</p> : loadFailed ? <p className="invoice-list-empty">Customers are unavailable. Please try again.</p> : !filtered.length ?
        <div className="invoice-list-empty"><UsersRound size={25} /><strong>No customers found</strong><span>{customers.length ? "Try a different search." : "Add a customer to get started."}</span></div> :
        <><div className="customer-table-wrap"><table className="invoice-list-table customer-table"><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>PHONE</th><th>INVOICES</th><th>ACTIONS</th></tr></thead>
          <tbody>{filtered.map(c => <tr key={c.id}><td><div className="customer-identity"><span className="customer-avatar" aria-hidden="true">{c.name.charAt(0).toUpperCase()}</span><strong>{c.name}</strong></div></td>
            <td>{c.email}</td><td>{c.phone || "—"}</td><td><span className="customer-count">{Number.isInteger(c.invoiceCount) ? `${c.invoiceCount} ${c.invoiceCount === 1 ? "invoice" : "invoices"}` : "Unavailable"}</span></td>
            <td><CustomerActions customer={c} busy={busy} onEdit={edit} onDelete={remove} /></td></tr>)}</tbody></table></div>
          <div className="customer-cards">{filtered.map(c => <article className="customer-card" key={c.id}>
            <div className="customer-identity"><span className="customer-avatar" aria-hidden="true">{c.name.charAt(0).toUpperCase()}</span><div><strong>{c.name}</strong><span className="customer-count">{Number.isInteger(c.invoiceCount) ? `${c.invoiceCount} ${c.invoiceCount === 1 ? "invoice" : "invoices"}` : "Invoice count unavailable"}</span></div></div>
            <div className="customer-card-contact"><Mail size={15} /><span>{c.email}</span></div>{c.phone && <p className="customer-card-phone">{c.phone}</p>}
            <CustomerActions customer={c} busy={busy} onEdit={edit} onDelete={remove} />
          </article>)}</div></>}
      <p className="invoice-list-footnote">Only customers with no invoices can be deleted. Invoices include drafts and finalized invoices.</p>
    </section>
    {form && <CustomerEditor customer={form} saving={busy} error={formError} onSave={save} onCancel={() => setForm(null)} />}
  </Layout>;
}
