import type { Page } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

export async function testAccounting(page: Page) {
  const go = async (section: string) => {
    await page.goto(`http://127.0.0.1:3100/accounting/${section}`);
    await page
      .getByRole("button", { name: /New |Download CSV|Initialize accounting/ })
      .first()
      .waitFor();
  };
  const click = (name: string) =>
    page.getByRole("button", { name, exact: true }).click();
  const saved = () =>
    page
      .getByRole("status")
      .filter({ hasText: "Saved successfully." })
      .waitFor();
  await go("accounts");
  await click("Initialize accounting");
  await page.getByRole("cell", { name: "1000", exact: true }).waitFor();
  await click("New account");
  await page.getByLabel("code", { exact: true }).fill("6010");
  await page.getByLabel("name", { exact: true }).fill("Freight expense");
  await click("Save account");
  await page
    .getByRole("cell", { name: "Freight expense", exact: true })
    .waitFor();
  await go("opening-balances");
  await click("New journal");
  await page.getByLabel("Memo", { exact: true }).fill("Opening cash capital");
  await page
    .getByLabel("Account 1", { exact: true })
    .selectOption({ label: "1000 · Cash" });
  await page.getByLabel("Debit 1", { exact: true }).fill("10000");
  await page
    .getByLabel("Account 2", { exact: true })
    .selectOption({ label: "3000 · Owner capital" });
  await page.getByLabel("Credit 2", { exact: true }).fill("10000");
  await click("Save journal draft");
  await saved();
  await click("Edit");
  await page
    .getByLabel("Memo", { exact: true })
    .fill("Opening cash capital reviewed");
  await click("Save journal draft");
  await page
    .getByRole("cell", { name: /Opening cash capital reviewed/ })
    .waitFor();
  await click("Post");
  await page.getByRole("cell", { name: "posted", exact: true }).waitFor();
  console.log("PASS chart of accounts, opening draft edit and posting");
  await go("suppliers");
  await click("New supplier");
  await page.getByLabel("name", { exact: true }).fill("Browser Supplier");
  await click("Save supplier");
  await page
    .getByRole("cell", { name: "Browser Supplier", exact: true })
    .waitFor();
  await go("purchase-orders");
  await click("New order");
  await page
    .getByLabel("Supplier", { exact: true })
    .selectOption({ label: "Browser Supplier" });
  await page
    .getByLabel("Description 1", { exact: true })
    .fill("Purchase for resale");
  await page.getByLabel("Rate 1", { exact: true }).fill("60");
  await click("Save draft");
  await page.getByRole("cell", { name: "PO-0001", exact: true }).waitFor();
  await click("Confirm");
  await click("Convert to Bill");
  await page.getByRole("heading", { name: "Edit BILL-0001" }).waitFor();
  await page.getByLabel("Recoverable purchase tax (amount)").fill("6");
  await click("Save draft");
  await click("Post bill");
  await page.getByRole("cell", { name: "Posted", exact: true }).waitFor();
  console.log("PASS supplier, purchase order, conversion and bill posting");
  await go("sales-orders");
  await click("New order");
  await page
    .getByLabel("Customer", { exact: true })
    .selectOption({ label: "Browser Test Customer" });
  await page
    .getByLabel("Description 1", { exact: true })
    .fill("Accounting sale");
  await page.getByLabel("Rate 1", { exact: true }).fill("100");
  await click("Save draft");
  await page.getByRole("cell", { name: "SO-0001", exact: true }).waitFor();
  await click("Confirm");
  await click("Convert to Invoice");
  await page.getByLabel("Status", { exact: true }).selectOption("issued");
  await click("Save invoice");
  await page.getByRole("link", { name: "Edit", exact: true }).waitFor();
  await click("Post to accounts");
  await page.getByRole("link", { name: "View journal", exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Edit", exact: true }).count(),
    0,
  );
  console.log(
    "PASS sales order conversion, invoice posting and edit protection",
  );
  for (const [section, kind, party, amount] of [
    ["receipts", "receipt", "Browser Test Customer", "50"],
    ["payments", "payment", "Browser Supplier", "30"],
  ]) {
    await go(section);
    await click(`New ${kind}`);
    await page
      .getByLabel("Party", { exact: true })
      .selectOption({ label: party });
    await page
      .getByLabel("Allocate to", { exact: true })
      .selectOption({ index: 1 });
    await page
      .getByLabel("Cash / bank", { exact: true })
      .selectOption({ label: "Cash" });
    await page.getByLabel("Amount", { exact: true }).fill(amount);
    await click(`Post ${kind}`);
    await saved();
    await page
      .getByRole("button", { name: "View journal", exact: true })
      .waitFor();
  }
  await go("journals");
  await click("New journal");
  await page
    .getByLabel("Memo", { exact: true })
    .fill("Recognize cost of sales");
  await page
    .getByLabel("Account 1", { exact: true })
    .selectOption({ label: "5000 · Cost of goods sold" });
  await page.getByLabel("Debit 1", { exact: true }).fill("40");
  await page
    .getByLabel("Account 2", { exact: true })
    .selectOption({ label: "1200 · Purchases awaiting cost allocation" });
  await page.getByLabel("Credit 2", { exact: true }).fill("40");
  await page.getByLabel("Post immediately").check();
  await click("Post journal");
  await saved();
  console.log(
    "PASS partial customer receipt, supplier payment and cost journal",
  );
  await go("profit-loss");
  await page.getByRole("button", { name: "Download CSV" }).waitFor();
  await page
    .locator(".report-line")
    .filter({ hasText: "Net profit / loss" })
    .filter({ hasText: "60.00" })
    .waitFor();
  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    click("Download CSV"),
  ]);
  await csv.saveAs("artifacts/accounting-profit-loss.csv");
  assert.ok(
    (await fs.readFile("artifacts/accounting-profit-loss.csv", "utf8")).match(
      /"Net profit","60(?:\.0+)?"/,
    ),
  );
  await page.screenshot({
    path: "artifacts/accounting-profit-loss.png",
    fullPage: true,
  });
  await go("balance-sheet");
  await page.getByText("Balance sheet balances.", { exact: true }).waitFor();
  await page.screenshot({
    path: "artifacts/accounting-balance-sheet.png",
    fullPage: true,
  });
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator(".accounting-tabs").isVisible(), false);
  await page.pdf({
    path: "artifacts/accounting-balance-sheet.pdf",
    format: "A4",
  });
  await page.emulateMedia({ media: "screen" });
  await go("trial-balance");
  await page.getByText("Trial balance agrees.", { exact: true }).waitFor();
  await go("ledger");
  await page
    .getByLabel("Ledger account")
    .selectOption({ label: "1100 · Accounts receivable" });
  await page
    .getByLabel("Ledger party")
    .selectOption({ label: "Browser Test Customer" });
  await page.getByRole("cell", { name: "68.59", exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/accounting-ledger-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  console.log(
    "PASS P&L, balance sheet, trial balance, customer ledger, CSV, print and mobile",
  );
}
