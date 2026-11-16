import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock3, FileText, Plus, Search, WalletCards } from "lucide-react";
import api from "../../services/api";
import { confirmInvoiceAction, downloadInvoice, invoiceActionMessage } from "./actions";
import { Alert, errorMessage, Layout, money } from "./shared";

function InvoiceActions({ invoice, disabled, busy, onAction }) {
  return <div className="invoice-list-actions">
    <Link className="invoice-list-view" to={`/hr/invoice/invoices/${invoice.id}`} aria-label={`View invoice ${invoice.number}`}>View <ArrowRight size={14} /></Link>
    <select className="invoice-action-select" aria-label={`Actions for invoice ${invoice.number}`} value="" disabled={disabled}
      onChange={event => onAction(invoice, event.target.value)}>
      <option value="" disabled>{busy ? "Working..." : "Actions"}</option>
      {invoice.status === "Draft" && <option value="edit">Edit draft</option>}
      {invoice.status === "Draft" && <option value="approve">Approve invoice</option>}
      {invoice.status === "Approved" && <option value="return-to-draft">Return to draft</option>}
      <option value="download">Download PDF</option>
      {invoice.status !== "Paid" && <option value="send">{invoice.status === "Sent" ? "Resend email" : "Send email"}</option>}
      {["Approved", "Sent"].includes(invoice.status) && <option value="paid">Mark paid</option>}
      {invoice.status === "Draft" && <option value="delete">Delete draft</option>}
    </select>
  </div>;
}

function Status({ invoice }) {
  return <div className="invoice-list-statuses"><span className={`invoice-list-status invoice-list-status-${invoice.status.toLowerCase()}`}>{invoice.status}</span>
    {invoice.viewedAt && <span className="invoice-list-viewed">Viewed</span>}</div>;
}

export default function InvoiceList() {
  const location = useLocation();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(location.state?.notice || "");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const load = useCallback(async () => { const response = await api.get("/invoices"); setInvoices(response.data); }, []);
  useEffect(() => { load().catch(e => { setLoadFailed(true); setError(errorMessage(e, "Could not load invoices.")); }).finally(() => setLoading(false)); }, [load]);

  const handleAction = async (invoice, type) => {
    if (type === "edit") { navigate(`/hr/invoice/invoices/${invoice.id}/edit`); return; }
    if (type !== "download" && !confirmInvoiceAction(invoice, type)) return;
    setBusyId(invoice.id); setError(""); setSuccess("");
    try {
      if (type === "download") {
        await downloadInvoice(invoice);
      } else {
        if (type === "delete") await api.delete(`/invoices/${invoice.id}`);
        else await api.post(`/invoices/${invoice.id}/${type}`);
        setSuccess(`${invoiceActionMessage(type)} (#${invoice.number})`);
        try { await load(); } catch { setError("Action succeeded, but the invoices could not be refreshed. Reload the page."); }
      }
    } catch (e) { setError(errorMessage(e, type === "download" ? "Could not download the invoice PDF." : "Could not complete the action.")); }
    finally { setBusyId(null); }
  };

  const filtered = invoices.filter(i => (!status || (status === "Viewed" ? !!i.viewedAt : i.status === status)) &&
    `${i.number} ${i.customer.name}`.toLowerCase().includes(search.toLowerCase().trim()));
  const metrics = [
    { label: "All invoices", value: invoices.length, note: "Your billing documents", icon: FileText },
    { label: "Drafts", value: invoices.filter(i => i.status === "Draft").length, note: "Still in progress", icon: Clock3 },
    { label: "Awaiting payment", value: invoices.filter(i => ["Approved", "Sent"].includes(i.status)).length, note: "Approved or sent", icon: WalletCards },
    { label: "Paid", value: invoices.filter(i => i.status === "Paid").length, note: "Completed invoices", icon: CheckCircle2 },
  ];

  return <Layout title="Invoices" subtitle="Your billing, organized. Manage invoices and follow their progress in one place."
    action={<Link className="invoice-create-button" to="/hr/invoice/invoices/new"><Plus size={17} /> Create invoice</Link>}>
    <Alert error={error} />
    {success && <div role="status" className="invoice-list-success">{success}</div>}
    <section className="invoice-list-overview" aria-label="Invoice overview">{metrics.map(({ label, value, note, icon: Icon }) =>
      <div className="invoice-list-metric" key={label}><div className="invoice-list-metric-head"><span>{label}</span><span className="invoice-list-metric-icon"><Icon size={18} /></span></div>
        <strong>{loading || loadFailed ? "—" : value}</strong><small>{note}</small></div>)}</section>
    <section className="invoice-list-panel" aria-labelledby="invoice-list-heading">
      <div className="invoice-list-heading"><div><p className="invoice-list-kicker">BILLING WORKSPACE</p><h2 id="invoice-list-heading">Invoice register</h2>
        <p>Find an invoice, check its status, or take the next step.</p></div>
        {!loading && !loadFailed && <span className="invoice-list-count">{filtered.length} {filtered.length === 1 ? "invoice" : "invoices"}</span>}</div>
      <div className="invoice-list-filters"><div className="invoice-list-search"><Search size={17} /><input className="invoice-input" aria-label="Search invoices" placeholder="Search invoice number or customer" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="invoice-input invoice-list-filter" aria-label="Filter invoices by status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{["Draft", "Approved", "Sent", "Viewed", "Paid"].map(s => <option key={s}>{s}</option>)}</select></div>
      {loading ? <p className="invoice-list-empty">Loading invoices...</p> : loadFailed ? <p className="invoice-list-empty">Invoices are unavailable. Please try again.</p> : filtered.length === 0 ?
        <div className="invoice-list-empty"><FileText size={25} /><strong>No invoices found</strong><span>{invoices.length ? "Try a different search or status filter." : "Create your first invoice to get started."}</span></div> :
        <><div className="invoice-list-table-wrap"><table className="invoice-list-table">
          <thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>DUE DATE</th><th>STATUS</th><th className="invoice-list-amount">TOTAL</th><th>ACTIONS</th></tr></thead>
          <tbody>{filtered.map(i => <tr key={i.id}><td><Link className="invoice-list-number" to={`/hr/invoice/invoices/${i.id}`}>#{i.number}</Link><small>Issued {i.invoiceDate}</small></td>
            <td><strong className="invoice-list-customer">{i.customer.name}</strong></td><td>{i.dueDate}</td><td><Status invoice={i} /></td>
            <td className="invoice-list-amount"><strong>{money(i.totalCents)}</strong></td><td><InvoiceActions invoice={i} disabled={busyId !== null} busy={busyId === i.id} onAction={handleAction} /></td></tr>)}</tbody></table></div>
          <div className="invoice-list-cards">{filtered.map(i => <article className="invoice-list-card" key={i.id}>
            <div className="invoice-list-card-top"><div><Link className="invoice-list-number" to={`/hr/invoice/invoices/${i.id}`}>#{i.number}</Link><p>{i.customer.name}</p></div><Status invoice={i} /></div>
            <div className="invoice-list-card-meta"><span>Due {i.dueDate}</span><strong>{money(i.totalCents)}</strong></div>
            <InvoiceActions invoice={i} disabled={busyId !== null} busy={busyId === i.id} onAction={handleAction} />
          </article>)}</div></>}
      <p className="invoice-list-footnote">Viewed means a customer selected “View invoice” on the secure link. PDF and email opens are not tracked.</p>
    </section>
  </Layout>;
}
