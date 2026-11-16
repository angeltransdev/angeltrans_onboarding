import { useState } from "react";
import api from "../../services/api";
import { Alert, InvoiceContent } from "./shared";

export default function PublicInvoice() {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const view = async () => {
    setLoading(true); setError("");
    try { const r = await api.post("/invoices/view", { token: window.location.hash.slice(1) }); setInvoice(r.data); }
    catch (err) { setError(err.response?.status === 404 ? "This invoice link is invalid or no longer available. Please contact the sender." : "Could not load the invoice. Please try again or contact the sender."); }
    finally { setLoading(false); }
  };
  return <main className="min-h-screen bg-surface p-4 md:p-8"><div className="max-w-3xl mx-auto">
    <h1 className="font-headline font-bold text-display-lg mb-6">Angel Trans Invoice</h1>
    <Alert error={error} />
    {invoice ? <InvoiceContent invoice={invoice} /> : <div className="card"><p className="mb-4">Select below to view your invoice. Your visit will be recorded.</p>
      <button className="btn-primary" disabled={loading} onClick={view}>{loading ? "Loading..." : "View invoice"}</button></div>}
  </div></main>;
}
