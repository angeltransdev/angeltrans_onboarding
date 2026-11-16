import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../services/api";
import { Alert, dateTime, errorMessage, InvoiceContent, Layout } from "./shared";

export default function InvoiceDetails() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = useCallback(async () => { const r = await api.get(`/invoices/${id}`); setInvoice(r.data); }, [id]);
  useEffect(() => { load().catch(e => setError(errorMessage(e, "Could not load invoice."))).finally(() => setLoading(false)); }, [load]);
  const action = async (type) => {
    const question = type === "send" ? `Email this invoice to ${invoice.customer.email}? Sending locks the invoice; resending invalidates the previous viewing link.` : "Mark this invoice as paid?";
    if (!window.confirm(question)) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await api.post(`/invoices/${id}/${type}`);
      setSuccess(type === "send" ? "Invoice sent." : "Invoice marked paid.");
      try { await load(); } catch { setError("Action succeeded, but the invoice could not be refreshed. Reload the page."); }
    } catch (err) { setError(errorMessage(err, "Could not complete the action.")); }
    finally { setBusy(false); }
  };
  const download = async () => {
    setBusy(true); setError("");
    try {
      const response = await api.get(`/invoices/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a"); link.href = url; link.download = `invoice-${invoice.number}.pdf`; link.click();
      URL.revokeObjectURL(url);
    } catch { setError("Could not download the invoice PDF."); }
    finally { setBusy(false); }
  };
  return <Layout title={invoice ? `Invoice #${invoice.number}` : "Invoice"}><Alert error={error} />
    {success && <div role="status" className="p-3 mb-4 bg-success-container text-success rounded-lg">{success}</div>}
    {loading ? <p>Loading invoice...</p> : invoice && <>
      <div className="flex flex-wrap gap-3 mb-4">
        <Link className="btn-secondary" to="/hr/invoice/invoices">Back</Link>
        {invoice.status === "Draft" && <Link className="btn-secondary" to={`/hr/invoice/invoices/${id}/edit`}>Edit draft</Link>}
        <button className="btn-secondary" disabled={busy} onClick={download}>Download PDF</button>
        {invoice.status !== "Paid" && <button className="btn-primary" disabled={busy} onClick={() => action("send")}>{invoice.status === "Sent" ? "Resend email" : "Send email"}</button>}
        {invoice.status === "Sent" && <button className="btn-secondary" disabled={busy} onClick={() => action("paid")}>Mark paid</button>}
      </div>
      {invoice.status === "Draft" && <p className="mb-4 text-secondary">Draft preview. Company details are finalized when sent. Sent invoices cannot be edited.</p>}
      <InvoiceContent invoice={invoice} />
      <section className="card mt-6"><h2 className="font-semibold text-headline-sm">Activity</h2>
        <p className="text-secondary mt-1">Views are recorded when the recipient opens the secure link and selects View invoice. PDF and email opens are not tracked.</p>
        {invoice.activity.length ? <ul className="divide-y divide-outline-variant">{invoice.activity.map((a, n) => <li key={n} className="py-2">{a.event} · {dateTime(a.createdAt)}</li>)}</ul> : <p className="mt-3">No activity yet.</p>}
      </section>
    </>}
  </Layout>;
}
