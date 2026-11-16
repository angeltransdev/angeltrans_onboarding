# Invoicing

The Invoice menu is available to owners and HR administrators. Customers and invoice drafts are entered manually. Approving a draft locks it without sending an email, so its PDF can be printed and handed to the customer. Sending a draft also locks it. Customer and company details are saved at approval or first sending and remain unchanged if those details are later edited. An approved invoice can later be emailed or marked paid. Marking an invoice paid records a manual status change; it does not process a payment.

An unpaid invoice in Approved status may be returned to Draft for editing; Sent and Paid invoices cannot. Returning it to draft clears the customer and company snapshots, so it uses current details when next approved or sent. Previously printed copies may no longer match. Drafts can be permanently deleted, including their activity history; invoice numbers are not reused.

## Deployment

Before deploying the new application code, back up the database and run `npm run migrate:invoices` from the server directory against the intended database. This creates invoice-specific tables without changing the existing HR tables. The command uses `DATABASE_URL`; verify the target before running it. The existing company settings migration must already be applied, and company settings must be configured.

Run the invoice migration again when upgrading from the initial invoice version: it adds order, subject, payment terms, terms and conditions, and adjustment columns without rewriting existing invoices. Older line items display as quantity one with the original amount as the rate. New invoices support whole-number quantities, service dates, rates, and signed fixed-dollar adjustments; totals are calculated and validated by the server.

Run the invoice migration before deploying the approval and return-to-draft workflow, even if invoicing was already installed. It extends the existing status and activity constraints to allow Approved and Returned to draft.

Invoice email uses the existing Resend configuration and `CLIENT_URL`. Set `CLIENT_URL` to the public HTTPS address of the deployed client (localhost HTTP is permitted for development). The frontend must route `/invoice/view` to the React app. Invoice PDFs are generated from saved data rather than the temporary PDF directory.

Run `npm run test:invoices` in the server directory for validation and PDF tests. Set `INVOICE_TEST_DATABASE_URL` to a disposable local PostgreSQL database to also run the integration test; it creates and removes its own test schema and uses a stub email sender.

## Tracking and privacy

Sending attaches a PDF and provides a bearer link. Anyone with the link can see the invoice; share it carefully. A view is recorded only when someone follows the link and clicks **View invoice**. Email image opens and local PDF opens cannot be tracked. Resending replaces the previous link, including links in previously sent emails. The link continues to work after the invoice is marked paid.

If delivery cannot be confirmed, check with the customer before retrying: an email could have been delivered even if the request or database transaction failed, and its link may not work. The server logs details for investigation.
