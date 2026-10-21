# Verification results

Verified locally on 6 September 2026.

- Production build: PASS (`npm run build`).
- TypeScript checks: PASS.
- Automated tests: 15 PASS, 0 failed (`npm test`).
- Browser integration: PASS (`npm run test:browser`) using the real Next application and an isolated Supabase-compatible adapter backed by the same SQL migration in embedded PostgreSQL.
- Production dependency audit: 0 vulnerabilities.
- Original template SHA-256 hashes match the supplied files; originals are unchanged.
- Native Microsoft Excel recalculation of the sample export: 245908.224, equal to Decimal.js and PostgreSQL numeric.
- Original and generated invoice/quotation PDFs visually inspected, including native Excel-rendered exports.
- Dynamic exports tested at 1, 5, 12, 13 and 60 items, including merged-cell styles, shifted formulas, preserved original cells, and XLSX reload.
- 60-item PDFs: invoice 2 pages, quotation 3 pages. Last item retained and headers repeat on continued item pages.
- Production unauthenticated checks: login 200, invoice page 307 to login, data API 401, export API 401.

## Browser coverage

Login and protected routes; company settings save; customer create/edit/view; existing customer selection; invoice create/edit/duplicate; page refresh persistence; invoice PDF/Excel downloads and clean print; quotation create/edit/duplicate; multiple line items; quotation PDF/Excel downloads and clean print; quotation-to-invoice conversion; number search and custom date filtering; archive/restore; desktop and mobile screenshots; no uncaught client errors.

## Database coverage

Schema installation; foreign keys and ownership; separate header and item persistence; server-side totals overriding tampered browser totals; unique automatic numbers; historical snapshots; stale-edit rejection; invalid line-item rejection; exact decimal/zero-tax calculations; archive/restore; no direct financial table writes or deletion by authenticated users; no cross-user reads or writes.

## Hosted setup still required

The configured Supabase Auth endpoint responds HTTP 200. The hosted schema check returns PGRST205: public.invoices is not installed. No hosted users or test records were created. Apply `supabase/migrations/202609050001_initial.sql` and create an Auth user using the instructions in README.md before live use. Hosted persistence and login have not been represented as verified.

The local production server is running on http://127.0.0.1:3000. Its process must remain running while the application is used.

## Fidelity limits

Workbook cell styles, widths, row heights, merge ranges, and formulas are retained and extended. ExcelJS rewrites the XLSX package, so native printer metadata and font metrics can cause small spacing differences. Browser/PDF rendering approximates those metrics. Quotation uses A4 because its source does not explicitly specify a paper size. The source declaration's conflicting 60% figures remain editable and unchanged. Excel's native numeric precision limit still applies to spreadsheet exports; database arithmetic remains exact.
