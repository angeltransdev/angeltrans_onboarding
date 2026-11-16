# Invoicing

The Invoice menu is available to owners and HR administrators. Customers and invoice drafts are entered manually. A sent invoice is locked, with customer and company details saved as they were at sending. Marking an invoice paid records a manual status change; it does not process a payment.

## Deployment

Before deploying the new application code, back up the database and run `npm run migrate:invoices` from the server directory against the intended database. This creates invoice-specific tables without changing the existing HR tables. The command uses `DATABASE_URL`; verify the target before running it. The existing company settings migration must already be applied, and company settings must be configured.

Run the invoice migration again when upgrading from the initial invoice version: it adds order, subject, payment terms, terms and conditions, and adjustment columns without rewriting existing invoices. Older line items display as quantity one with the original amount as the rate. New invoices support whole-number quantities, service dates, rates, and signed fixed-dollar adjustments; totals are calculated and validated by the server.

Invoice email uses the existing Resend configuration and `CLIENT_URL`. Set `CLIENT_URL` to the public HTTPS address of the deployed client (localhost HTTP is permitted for development). The frontend must route `/invoice/view` to the React app. Invoice PDFs are generated from saved data rather than the temporary PDF directory.

Run `npm run test:invoices` in the server directory for validation and PDF tests. Set `INVOICE_TEST_DATABASE_URL` to a disposable local PostgreSQL database to also run the integration test; it creates and removes its own test schema and uses a stub email sender.

## Tracking and privacy

Sending attaches a PDF and provides a bearer link. Anyone with the link can see the invoice; share it carefully. A view is recorded only when someone follows the link and clicks **View invoice**. Email image opens and local PDF opens cannot be tracked. Resending replaces the previous link, including links in previously sent emails. The link continues to work after the invoice is marked paid.

If delivery cannot be confirmed, check with the customer before retrying: an email could have been delivered even if the request or database transaction failed, and its link may not work. The server logs details for investigation.
