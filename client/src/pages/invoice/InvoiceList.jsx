import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { Alert, errorMessage, Layout, money } from "./shared";

export default function InvoiceList() {
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => { api.get("/invoices").then(r => setInvoices(r.data)).catch(e => setError(errorMessage(e, "Could not load invoices."))).finally(() => setLoading(false)); }, []);
  const filtered = invoices.filter(i => (!status || (status === "Viewed" ? !!i.viewedAt : i.status === status)) &&
    `${i.number} ${i.customer.name}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <Layout title="Invoices" subtitle="Manage your invoices and keep track of payments." action={<Link className="btn-primary" to="/hr/invoice/invoices/new">+ Create invoice</Link>}>
    <Alert error={error} />
    <div className="invoice-panel">
      <div className="invoice-section-body"><div className="grid md:grid-cols-[1fr_220px] gap-3"><input className="invoice-input" aria-label="Search invoices" placeholder="Search invoice number or customer" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="invoice-input" aria-label="Filter invoices" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{["Draft", "Sent", "Viewed", "Paid"].map(s => <option key={s}>{s}</option>)}</select></div></div>
      {loading ? <p className="p-6 text-slate-500">Loading invoices...</p> : filtered.length === 0 ? <p className="p-6 text-slate-500">No invoices found.</p> : <div className="overflow-x-auto"><table className="invoice-table invoice-document-table">
        <thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>DUE DATE</th><th>STATUS</th><th className="text-right">TOTAL</th></tr></thead>
        <tbody>{filtered.map(i => <tr key={i.id}><td><Link className="text-primary font-semibold" to={`/hr/invoice/invoices/${i.id}`}>#{i.number}</Link></td><td>{i.customer.name}</td><td>{i.dueDate}</td>
          <td><span className="invoice-status">{i.status}</span>{i.viewedAt && <span className="invoice-viewed">Viewed</span>}</td><td className="text-right font-semibold">{money(i.totalCents)}</td></tr>)}</tbody></table></div>}
    </div>
  </Layout>;
}
