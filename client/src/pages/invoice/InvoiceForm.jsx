import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, FileText, Plus, Trash2 } from "lucide-react";
import api from "../../services/api";
import { Alert, errorMessage, Layout, money } from "./shared";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const addDays = (value, days) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const termDays = { "Due on receipt": 0, "Net 15": 15, "Net 30": 30, "Net 60": 60 };
const newItem = () => ({ description: "", serviceDate: "", quantity: "1", rate: "" });
const empty = () => ({ customerId: "", invoiceDate: today(), dueDate: today(), paymentTerms: "Due on receipt",
  orderNumber: "", subject: "", items: [newItem()], adjustment: "0.00", notes: "", paymentInstructions: "", termsConditions: "" });
const cents = (value, signed = false) => {
  if (!(signed ? /^-?\d{1,10}(\.\d{1,2})?$/ : /^\d{1,9}(\.\d{1,2})?$/).test(value)) return null;
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  return (negative ? -1 : 1) * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
};
const input = "invoice-input";

function FormField({ label, children, hint }) {
  return <label className="invoice-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export default function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api.get("/invoices/customers"), id ? api.get(`/invoices/${id}`) : Promise.resolve(null)])
      .then(([c, result]) => {
        setCustomers(c.data);
        if (result) {
          const i = result.data;
          if (i.status !== "Draft") { setError("Only draft invoices can be edited."); return; }
          setForm({ ...i, paymentTerms: i.paymentTerms || "Custom", adjustment: (Number(i.adjustmentCents || 0) / 100).toFixed(2),
            items: i.items.map(item => ({ description: item.description, serviceDate: item.serviceDate || "",
              quantity: String(item.quantity ?? 1), rate: (Number(item.rateCents ?? item.amountCents) / 100).toFixed(2) })) });
        }
      }).catch(e => { setLoadFailed(true); setError(errorMessage(e, "Could not load invoice form.")); }).finally(() => setLoading(false));
  }, [id]);
  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const changeItem = (index, key, value) => setForm(f => ({ ...f, items: f.items.map((item, n) => n === index ? { ...item, [key]: value } : item) }));
  const changeTerms = value => setForm(f => ({ ...f, paymentTerms: value, dueDate: value === "Custom" ? f.dueDate : addDays(f.invoiceDate, termDays[value]) }));
  const changeInvoiceDate = value => setForm(f => ({ ...f, invoiceDate: value, dueDate: f.paymentTerms === "Custom" ? f.dueDate : addDays(value, termDays[f.paymentTerms]) }));
  const customer = customers.find(c => c.id === form.customerId);
  const subtotal = form.items.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const rate = cents(item.rate);
    return sum + (Number.isSafeInteger(quantity) && quantity > 0 && rate !== null ? quantity * rate : 0);
  }, 0);
  const adjustment = cents(form.adjustment || "0", true);
  const total = subtotal + (adjustment ?? 0);
  const save = async e => {
    e.preventDefault(); setError("");
    const items = form.items.map(item => ({ description: item.description, serviceDate: item.serviceDate,
      quantity: Number(item.quantity), rateCents: cents(item.rate) }));
    if (items.some((item, index) => !/^\d+$/.test(form.items[index].quantity) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000000)) {
      setError("Quantity must be a whole number between 1 and 1,000,000."); return;
    }
    if (items.some(item => item.rateCents === null || item.rateCents > 10000000000 || item.quantity * item.rateCents > 1000000000000)) {
      setError("Enter a valid rate with up to two decimal places. Each charge cannot exceed $10,000,000,000."); return;
    }
    if (adjustment === null || Math.abs(adjustment) > 1000000000000 || subtotal > 1000000000000 || total < 0 || total > 1000000000000) {
      setError("Enter a valid adjustment. Subtotal and total must be between $0 and $10,000,000,000."); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, items, adjustmentCents: adjustment };
      const result = id ? await api.put(`/invoices/${id}`, payload) : await api.post("/invoices", payload);
      navigate(`/hr/invoice/invoices/${result.data.id}`);
    } catch (err) { setError(errorMessage(err, "Could not save invoice.")); }
    finally { setSaving(false); }
  };
  return <Layout title={id ? "Edit invoice" : "Create invoice"} eyebrow="INVOICING / INVOICES"
    subtitle="Prepare a clear, professional invoice for your customer.">
    <Link to="/hr/invoice/invoices" className="invoice-back"><ArrowLeft size={16} /> Back to invoices</Link>
    <Alert error={error} />
    {loading ? <div className="invoice-panel p-8 text-slate-500">Loading invoice...</div> : loadFailed || (id && form.status !== "Draft") ? null :
      <form onSubmit={save} className="space-y-5">
        <section className="invoice-panel">
          <div className="invoice-section-heading"><div className="invoice-section-icon"><FileText size={18} /></div><div><h2>Invoice details</h2><p>Who you are billing and when payment is due.</p></div><span className="invoice-draft-badge">DRAFT</span></div>
          <div className="invoice-section-body">
            <div className="grid gap-5 lg:grid-cols-2">
              <FormField label="Customer *" hint={!customer ? "Select the customer receiving this invoice." : null}>
                <select className={input} required value={form.customerId} onChange={e => set("customerId", e.target.value)}><option value="">Select a customer</option>{customers.map(c => <option value={c.id} key={c.id}>{c.name} ({c.email})</option>)}</select>
              </FormField>
              <FormField label="Invoice number" hint="Assigned automatically when the draft is saved."><input className={input} value={id ? `#${form.number}` : "Automatically generated"} readOnly /></FormField>
            </div>
            {customer && <div className="invoice-billing"><span className="invoice-billing-label">BILL TO</span><strong>{customer.name}</strong><span className="whitespace-pre-line">{customer.address || "No billing address on file"}</span><span>{customer.email}</span></div>}
            {!customers.length && <p className="invoice-help">No customers yet. <Link className="text-primary font-semibold" to="/hr/invoice/customers">Add a customer</Link> before creating an invoice.</p>}
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <FormField label="Order number"><input className={input} maxLength={255} placeholder="Optional reference" value={form.orderNumber} onChange={e => set("orderNumber", e.target.value)} /></FormField>
              <FormField label="Invoice date *"><input type="date" className={input} required value={form.invoiceDate} onChange={e => changeInvoiceDate(e.target.value)} /></FormField>
              <FormField label="Payment terms"><select className={input} value={form.paymentTerms} onChange={e => changeTerms(e.target.value)}>{["Due on receipt", "Net 15", "Net 30", "Net 60", "Custom"].map(t => <option key={t}>{t}</option>)}</select></FormField>
              <FormField label="Due date *"><input type="date" className={input} required min={form.invoiceDate} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value, paymentTerms: "Custom" }))} /></FormField>
            </div>
            <FormField label="Subject"><input className={input} maxLength={500} placeholder="What is this invoice for?" value={form.subject} onChange={e => set("subject", e.target.value)} /></FormField>
          </div>
        </section>
        <section className="invoice-panel">
          <div className="invoice-section-heading"><div className="invoice-section-icon"><CalendarDays size={18} /></div><div><h2>Services & charges</h2><p>Add the services provided. Amounts are calculated automatically.</p></div></div>
          <p className="invoice-scroll-hint">Scroll the table to see all columns.</p>
          <div className="overflow-x-auto">
            <table className="invoice-table invoice-edit-table"><thead><tr><th>DESCRIPTION</th><th>SERVICE DATE</th><th>QTY</th><th>RATE</th><th className="text-right">AMOUNT</th><th aria-label="Remove item"></th></tr></thead>
              <tbody>{form.items.map((item, index) => {
                const lineAmount = (Number(item.quantity) || 0) * (cents(item.rate) || 0);
                return <tr key={index}>
                  <td><input aria-label={`Description ${index + 1}`} className={input} required maxLength={500} placeholder="Describe the service" value={item.description} onChange={e => changeItem(index, "description", e.target.value)} /></td>
                  <td><input aria-label={`Service date ${index + 1}`} className={input} type="date" value={item.serviceDate} onChange={e => changeItem(index, "serviceDate", e.target.value)} /></td>
                  <td><input aria-label={`Quantity ${index + 1}`} className={input} type="number" min="1" max="1000000" step="1" required value={item.quantity} onChange={e => changeItem(index, "quantity", e.target.value)} /></td>
                  <td><input aria-label={`Rate ${index + 1}`} className={input} inputMode="decimal" required placeholder="0.00" value={item.rate} onChange={e => changeItem(index, "rate", e.target.value)} /></td>
                  <td className="text-right font-semibold whitespace-nowrap">{money(lineAmount)}</td>
                  <td><button type="button" className="invoice-remove" aria-label={`Remove line ${index + 1}`} disabled={form.items.length === 1} onClick={() => set("items", form.items.filter((_, n) => n !== index))}><Trash2 size={16} /></button></td>
                </tr>;
              })}</tbody></table>
          </div>
          <div className="invoice-section-body"><button type="button" className="invoice-add" disabled={form.items.length >= 100} onClick={() => set("items", [...form.items, newItem()])}><Plus size={16} /> Add line item</button></div>
        </section>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
          <section className="invoice-panel"><div className="invoice-section-heading"><div><h2>Additional information</h2><p>These details will appear on the invoice.</p></div></div>
            <div className="invoice-section-body">
              <FormField label="Customer notes"><textarea className={input} rows={3} maxLength={4000} placeholder="Add a note for your customer" value={form.notes} onChange={e => set("notes", e.target.value)} /></FormField>
              <FormField label="Payment instructions"><textarea className={input} rows={3} maxLength={4000} placeholder="How should the customer pay?" value={form.paymentInstructions} onChange={e => set("paymentInstructions", e.target.value)} /></FormField>
              <FormField label="Terms & conditions"><textarea className={input} rows={3} maxLength={4000} placeholder="Add your terms and conditions" value={form.termsConditions} onChange={e => set("termsConditions", e.target.value)} /></FormField>
            </div>
          </section>
          <section className="invoice-panel invoice-summary"><h2>Invoice summary</h2><div className="invoice-summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
            <FormField label="Adjustment ($)" hint="Use a minus sign to subtract from the total."><input className={input} inputMode="decimal" value={form.adjustment} onChange={e => set("adjustment", e.target.value)} /></FormField>
            <div className="invoice-total"><span>Total (USD)</span><strong>{money(total)}</strong></div>
          </section>
        </div>
        <div className="flex flex-wrap justify-end gap-3 pb-6"><Link className="btn-secondary" to="/hr/invoice/invoices">Cancel</Link><button className="btn-primary" disabled={saving || !customers.length}>{saving ? "Saving..." : "Save draft"}</button></div>
      </form>}
  </Layout>;
}
