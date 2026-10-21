# Ledger — Invoice & Quotation Management

A Next.js, TypeScript and Supabase application using the supplied Invoice.xlsx and Quotation.xlsx as its export templates. Includes invoices, quotations, sales/purchase orders and accrual accounting in PKR. Inventory and automatic stock costing are outside this version.

## Start on this computer

The Supabase URL and publishable key are already in `.env.local`. The original workbooks are in `templates/`.

1. Open your Supabase project: https://supabase.com/dashboard/project/xecemclmyirrxsqdbcmm/sql/new
2. For a new database, run `supabase/migrations/202609050001_initial.sql` once, then `supabase/migrations/202609160001_orders_accounting.sql` once. **For an existing installation, run only the new orders/accounting migration; do not rerun the initial migration.** Both have been tested locally. This agent has not applied the new migration to hosted Supabase; the publishable key cannot run schema migrations.
3. In **Authentication → Users → Add user**, create your administrator's email/password account. Disable public signups if only invited administrators should use the application.
4. Run `npm ci` if dependencies are not installed, then `npm run dev`.
5. Open http://127.0.0.1:3000 and sign in. Review and save **Settings** before creating the first document. Open **Accounting ? Initialize accounting**, then review accounts and enter balanced opening entries. See [the accounting workflow](docs/accounting-workflow.md).

No service-role key is required by the application. Never put one in a `NEXT_PUBLIC_` variable.

## Production

Use Node.js 22 or later with a Node server capable of running Chromium. Run:

```sh
npm ci
npx playwright install --with-deps chromium
npm run build
npm run start
```

Set the environment variables from `.env.example`. Leave `PDF_BROWSER_CHANNEL` empty for Playwright's installed Chromium, or set it to `chrome`/`msedge` when that browser is installed. This computer uses installed Chrome. Place the Node server behind an HTTPS reverse proxy that preserves the Host header. Bind the server to the appropriate interface for your hosting environment; the provided start script binds to loopback.

The Excel files and extracted defaults under `templates/` must be included in deployments. Next's output tracing includes the templates for export routes. A static export cannot run authentication, database writes, Excel exports, or server-rendered PDF. For a new hosted Supabase project, apply both SQL migrations in filename order and create the Auth user first. Configure backups and retention in your Supabase project before business use.

## Features

- Cookie-based Supabase authentication, protected pages and APIs, per-user RLS.
- Dashboard with counts and recent documents; searchable customers and document lists.
- Customer create, view and edit; inline customer creation from document forms.
- Company settings initialized from the original files; separate addresses for each template.
- Invoice and quotation create/view/edit with dynamic line items, draft/issued status.
- Atomic document saves with database-generated numbering and collision prevention.
- Duplicate creates a separate saved draft with a new number.
- Convert quotation to invoice creates a separate invoice draft and preserves the quotation.
- Separate View, Edit, PDF, Excel, Print, Duplicate and Archive/Restore actions.
- Number, customer, NTN and date search; Today, This Month, This Year, Custom Range filters.
- Financial records are archived instead of permanently deleted.
- Customer and company snapshots keep historical documents stable after profile changes.
- Excel exports load the original template, populate values and formulas, and extend merges/styles.
- PDF and print use HTML tables generated from the populated workbook's styles and merged cells. No screenshots are used to produce PDF.

## Orders and accounting

- Sales orders: draft ? confirmed ? invoice draft; quotation-to-order conversion.
- Purchase orders: draft ? confirmed ? supplier bill draft. Orders can be cancelled before conversion.
- Suppliers, editable custom accounts and seeded control accounts.
- Explicit invoice/bill posting, partial customer receipts and supplier payments.
- Balanced manual/opening journals with draft editing, immutable posted entries and dated reversals.
- Ledger with customer/supplier filtering, Trial Balance, P&L and Balance Sheet; CSV and print.
- Period locks, ownership checks, exact decimal calculations and atomic financial commands.
- Existing documents are preserved and are not posted automatically. Archiving an invoice does not reverse its accounting entry.

See [workflow, posting rules and limitations](docs/accounting-workflow.md) before entering opening balances or posting historical invoices.

## Template details and calculations

See `docs/template-mapping.md` for fields, cells, formulas, merge strategy and original formatting.

Invoice arithmetic is quantity × rate, then subtotal × sales-tax percentage, then advance tax on the amount **including sales tax**. The original defaults are 18% sales tax and 0.5% advance tax. Rates are editable and stored per invoice. PostgreSQL numeric and Decimal.js preserve decimal precision; the server and database recalculate totals, ignoring browser totals. Input quantity/rate support four decimal places, positive quantity and nonnegative rate, up to 1 billion each. Tax percentages allow four decimal places, from 0 to 100.

The source template displays whole rupees in totals and two decimals in item amounts. Stored calculations retain full precision; total summaries use the source's whole-rupee display convention. Excel itself uses IEEE-754 numbers, so extremely large values remain subject to Excel's native approximately 15-significant-digit precision. PostgreSQL values remain exact.

Quotation has Description, Quantity and Rate columns only. Its original declaration says 60% advance and remaining balance (60%). This is deliberately preserved as an editable default with a reminder in Settings. A quotation number is added to an originally blank header area because the brief requires numbering. Customer address/tax IDs use the blank row above the item header. Additional invoice notes/IBAN/email/STRN use blank space below bank details. No sample customers or products are inserted into live tables. `logo_url` is reserved in settings; the source templates contain no logo image, and remote logos are not fetched during exports.

## Architecture

- `src/app`: app pages, authenticated API routes, login action.
- `src/components`: shell, workspace, forms, reusable document actions.
- `src/lib`: Supabase, validation, precise calculations, data access, workbook and print generation.
- `templates`: original unmodified Excel files and company defaults extracted from them.
- `supabase/migrations`: normalized schema, policies, transactional save/read/archive functions.
- `tests`: export/calculation/validation and PostgreSQL security/integration tests.
- `scripts/browser-test.ts`: isolated full-browser workflow test with a test-only Supabase protocol adapter backed by the same SQL migrations in embedded PostgreSQL. It never writes test data to hosted Supabase.

Document tables are company_settings, customers, invoices, invoice_items, quotations, quotation_items and document_counters. The extension adds accounts, suppliers, accounting_config, trade_orders/order_items, supplier_bills/bill_items, journals/journal_lines and settlements. Each financial header has a customer foreign key. Line items are separate relational rows. Only historical party profiles use JSON snapshots. Financial table writes are denied to browser roles; narrowly scoped, authenticated SQL functions validate ownership and save headers/items in one transaction. Edits require the last-read timestamp to prevent overwriting another edit. Lists are fetched in batches to avoid Supabase's default 1,000-row truncation.

## Verification

```sh
npm run typecheck
npm test
npm run test:browser
npm run build
```

Browser tests require installed Chrome and free local ports 3100 and 54329. They run a separate Next development process with an isolated database adapter. The production application contains no test login or authentication bypass. Browser test logs, screenshots, and sample exports go into ignored `artifacts/`.

`node scripts/check-connection.mjs` verifies hosted Auth reachability and checks whether invoice and orders/accounting tables exist without printing credentials. If it reports `ENOTFOUND`, verify the project URL in Supabase and local DNS/network connectivity; authenticated live behavior cannot be tested until the hostname resolves.

To run Excel's native visual comparison on Windows with Microsoft Excel installed, use `powershell -NoProfile -File scripts/render-originals.ps1`. This opens the originals read-only and exports comparison PDFs; it does not change the templates.

Live-hosted login, persistence, and deployment still require your Supabase migration/user setup. Local test success does not imply that the hosted schema has been installed.
#   M u s a - T r a d e r s  
 