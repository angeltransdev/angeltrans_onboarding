import api from "../../services/api";

export function confirmInvoiceAction(invoice, type) {
  const question = type === "return-to-draft" ? "Return this invoice to draft? It can be edited or deleted. Previously printed copies may no longer match, and current customer and company details will be used when it is approved again."
    : type === "approve" ? "Approve this invoice? It will be locked against editing and can be printed, emailed, or marked paid."
    : type === "send" ? `Email this invoice to ${invoice.customer.email}? Sending locks the invoice; resending invalidates the previous viewing link.`
    : type === "delete" ? `Permanently delete draft invoice #${invoice.number} and its activity history? This cannot be undone.`
    : "Mark this invoice as paid?";
  return window.confirm(question);
}

export const invoiceActionMessage = type => type === "return-to-draft" ? "Invoice returned to draft."
  : type === "approve" ? "Invoice approved. You can now download it for printing."
  : type === "send" ? "Invoice sent."
  : type === "delete" ? "Draft invoice deleted."
  : "Invoice marked paid.";

export async function downloadInvoice(invoice) {
  const response = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${invoice.number}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
