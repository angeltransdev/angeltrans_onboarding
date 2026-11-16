import { HRSidebar } from "../../components/layout/HRSidebar";
import "./invoice.css";

export const money = cents => `${Number(cents) < 0 ? "-" : ""}$${(Math.abs(Number(cents)) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const errorMessage = (err, fallback) => err.response?.data?.message || fallback;
export const dateTime = value => value ? new Date(value).toLocaleString() : "—";

export function Layout({ title, children, action, eyebrow = "INVOICING", subtitle }) {
  return <div className="flex min-h-screen bg-surface"><HRSidebar /><main className="invoice-workspace lg:ml-64 flex-1 min-w-0 p-4 lg:p-8 mt-14 lg:mt-0">
    <div className="invoice-container"><header className="invoice-page-header"><div><p className="invoice-eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="invoice-subtitle">{subtitle}</p>}</div>{action}</header>{children}</div>
  </main></div>;
}
export function Alert({ error }) {
  return error ? <div role="alert" className="p-3 mb-4 bg-error-container text-error rounded-lg">{error}</div> : null;
}
export function Field({ label, children }) {
  return <label className="block text-label-lg space-y-1"><span>{label}</span>{children}</label>;
}
export function InvoiceContent({ invoice }) {
  const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.amountCents), 0);
  const adjustment = Number(invoice.adjustmentCents || 0);
  return <div className="invoice-document">
    <div className="invoice-document-header"><div><p className="invoice-eyebrow">BILLING DOCUMENT</p><h2>{invoice.company?.name || "Invoice"}</h2>
      {invoice.company && <p className="whitespace-pre-line text-slate-500">{[invoice.company.address, invoice.company.phone, invoice.company.email].filter(Boolean).join("\n")}</p>}</div>
      <div className="invoice-document-number"><span>INVOICE</span><strong>#{invoice.number}</strong><small>{invoice.status}</small></div></div>
    <div className="invoice-document-meta"><div><span className="invoice-eyebrow">BILL TO</span><p className="whitespace-pre-line"><strong>{invoice.customer.name}</strong><br />{[invoice.customer.address, invoice.customer.email].filter(Boolean).join("\n")}</p></div>
      <div><p><span>Invoice date</span><strong>{invoice.invoiceDate}</strong></p><p><span>Due date</span><strong>{invoice.dueDate}</strong></p>
        {invoice.paymentTerms && <p><span>Payment terms</span><strong>{invoice.paymentTerms}</strong></p>}{invoice.orderNumber && <p><span>Order number</span><strong>{invoice.orderNumber}</strong></p>}</div></div>
    {invoice.subject && <div className="invoice-document-subject"><span className="invoice-eyebrow">SUBJECT</span><p>{invoice.subject}</p></div>}
    <div className="overflow-x-auto"><table className="invoice-table invoice-document-table"><thead><tr><th>DESCRIPTION</th><th>SERVICE DATE</th><th>QTY</th><th>RATE</th><th className="text-right">AMOUNT</th></tr></thead>
      <tbody>{invoice.items.map((item, index) => <tr key={index}><td className="whitespace-pre-wrap">{item.description}</td><td>{item.serviceDate || "—"}</td><td>{item.quantity ?? 1}</td><td>{money(item.rateCents ?? item.amountCents)}</td><td className="text-right font-semibold">{money(item.amountCents)}</td></tr>)}</tbody></table></div>
    <div className="invoice-document-totals"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{adjustment !== 0 && <div><span>Adjustment</span><strong>{money(adjustment)}</strong></div>}
      <div className="invoice-document-total"><span>Total (USD)</span><strong>{money(invoice.totalCents)}</strong></div></div>
    <div className="invoice-document-notes">
      {invoice.paymentInstructions && <div><strong>Payment instructions</strong><p className="whitespace-pre-wrap">{invoice.paymentInstructions}</p></div>}
      {invoice.notes && <div><strong>Customer notes</strong><p className="whitespace-pre-wrap">{invoice.notes}</p></div>}
      {invoice.termsConditions && <div><strong>Terms & conditions</strong><p className="whitespace-pre-wrap">{invoice.termsConditions}</p></div>}
    </div>
  </div>;
}
