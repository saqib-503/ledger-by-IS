import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
import { startTestBackend } from "./test-backend";
import { testAccounting } from "./test-accounting-browser";
async function main() {
  const backend = await startTestBackend();
  const log = fs.openSync("artifacts/browser-server.log", "w");
  const app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    {
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
        PDF_BROWSER_CHANNEL: "chrome",
      },
      stdio: ["ignore", log, log],
      windowsHide: true,
    },
  );
  let browser;
  try {
    for (let i = 0; i < 90; i++) {
      try {
        const r = await fetch("http://127.0.0.1:3100/login");
        if (r.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto("http://127.0.0.1:3100/");
    assert.ok(page.url().includes("/login"));
    await page.screenshot({
      path: "artifacts/login.png",
      fullPage: true,
      caret: "initial",
    });
    await page.getByLabel("Email address").fill("test@example.test");
    await page.getByLabel("Password").fill("test-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("heading", { name: "Overview." }).waitFor();
    console.log("PASS login and protected route");
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("button", { name: "Save settings" }).click();
    await page.getByText("Saved successfully.").waitFor();
    console.log("PASS company settings");
    await page.getByRole("link", { name: "Customers", exact: true }).click();
    await page.getByRole("button", { name: "Add customer" }).click();
    await page
      .getByLabel("name", { exact: true })
      .fill("Browser Test Customer");
    await page
      .getByLabel("address", { exact: true })
      .fill("Test address, Lahore");
    await page.getByLabel("ntn", { exact: true }).fill("9988776");
    await page.getByRole("button", { name: "Save customer" }).click();
    await page.getByText("Browser Test Customer", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("phone", { exact: true }).fill("03000000000");
    await page.getByRole("button", { name: "Save customer" }).click();
    await page.getByRole("button", { name: "View", exact: true }).click();
    await page
      .getByRole("heading", { name: "Browser Test Customer" })
      .waitFor();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    console.log("PASS customer create, edit and view");
    if (!process.env.ACCOUNTING_ONLY) {
      await page.getByRole("link", { name: "Invoices", exact: true }).click();
      await page
        .getByRole("link", { name: "New invoice", exact: true })
        .click();
      await page
        .getByLabel("Customer", { exact: true })
        .selectOption({ label: "Browser Test Customer · 9988776" });
      await page
        .getByLabel("Description 1")
        .fill("Browser-tested cotton shirt");
      await page.getByLabel("Quantity 1").fill("256");
      await page.getByLabel("Rate 1", { exact: true }).fill("810");
      await page
        .getByRole("button", { name: "Save invoice", exact: true })
        .click();
      await page.getByRole("link", { name: "Edit", exact: true }).waitFor();
      await page.getByRole("heading", { name: "INV-0001" }).waitFor();
      console.log("PASS invoice save");
      await page.reload();
      await page.getByRole("heading", { name: "INV-0001" }).waitFor();
      console.log("PASS refresh persistence");
      for (const format of ["PDF", "Excel"]) {
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 60000 }),
          page.getByRole("link", { name: format, exact: true }).click(),
        ]);
        console.log("Download", download.url(), download.suggestedFilename());
        await download.saveAs(
          "artifacts/browser-" + download.suggestedFilename(),
        );
        assert.equal(await download.failure(), null);
      }
      const [invoicePrint] = await Promise.all([
        page.waitForEvent("popup"),
        page.getByRole("link", { name: "Print", exact: true }).click(),
      ]);
      await invoicePrint.waitForLoadState();
      assert.ok(
        (await invoicePrint.locator("body").innerText()).includes("INV-0001"),
      );
      assert.equal(await invoicePrint.locator("nav,button,input").count(), 0);
      await invoicePrint.close();
      console.log("PASS invoice PDF, Excel and clean print");
      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await page.getByLabel("Notes", { exact: true }).fill("Edited in browser");
      await page
        .getByRole("button", { name: "Save invoice", exact: true })
        .click();
      await page.getByRole("link", { name: "Edit", exact: true }).waitFor();
      await page.getByRole("heading", { name: "INV-0001" }).waitFor();
      await page
        .getByRole("button", { name: "Duplicate", exact: true })
        .click();
      await page.getByRole("heading", { name: "INV-0002" }).waitFor();
      await page
        .getByRole("button", { name: "Save invoice", exact: true })
        .click();
      await page.getByRole("link", { name: "Edit", exact: true }).waitFor();
      await page.getByRole("heading", { name: "INV-0002" }).waitFor();
      console.log("PASS invoice edit and duplicate");
      await page.getByRole("link", { name: "Quotations", exact: true }).click();
      await page
        .getByRole("link", { name: "New quotation", exact: true })
        .click();
      await page
        .getByLabel("Customer", { exact: true })
        .selectOption({ label: "Browser Test Customer · 9988776" });
      await page.getByLabel("Description 1").fill("Quotation polo shirt");
      await page.getByLabel("Quantity 1").fill("100");
      await page.getByLabel("Rate 1", { exact: true }).fill("900");
      await page.getByRole("button", { name: "Add item", exact: true }).click();
      await page.getByLabel("Description 2").fill("Quotation trouser");
      await page.getByLabel("Quantity 2").fill("50");
      await page.getByLabel("Rate 2", { exact: true }).fill("1990");
      await page
        .getByRole("button", { name: "Save quotation", exact: true })
        .click();
      await page.getByRole("link", { name: "Edit", exact: true }).waitFor();
      await page.getByRole("heading", { name: "Q-0001" }).waitFor();
      for (const format of ["PDF", "Excel"]) {
        const [download] = await Promise.all([
          page.waitForEvent("download", { timeout: 60000 }),
          page.getByRole("link", { name: format, exact: true }).click(),
        ]);
        console.log("Download", download.url(), download.suggestedFilename());
        await download.saveAs(
          "artifacts/browser-" + download.suggestedFilename(),
        );
      }
      const [quotationPrint] = await Promise.all([
        page.waitForEvent("popup"),
        page.getByRole("link", { name: "Print", exact: true }).click(),
      ]);
      await quotationPrint.waitForLoadState();
      assert.ok(
        (await quotationPrint.locator("body").innerText()).includes("Q-0001"),
      );
      await quotationPrint.close();
      await page.getByRole("link", { name: "Edit", exact: true }).click();
      await page
        .getByLabel("Notes", { exact: true })
        .fill("Quotation edited in browser");
      await page
        .getByRole("button", { name: "Save quotation", exact: true })
        .click();
      await page.getByRole("link", { name: "Edit", exact: true }).waitFor();
      await page.getByRole("heading", { name: "Q-0001" }).waitFor();
      await page
        .getByRole("button", { name: "Duplicate", exact: true })
        .click();
      await page.getByRole("heading", { name: "Q-0002" }).waitFor();
      await page
        .getByRole("button", { name: "Save quotation", exact: true })
        .click();
      await page.getByRole("link", { name: "Edit", exact: true }).waitFor();
      await page.getByRole("heading", { name: "Q-0002" }).waitFor();
      console.log(
        "PASS quotation create/edit/duplicate, dynamic items, PDF, Excel and print",
      );
      await page
        .getByRole("button", { name: "Convert to Invoice", exact: true })
        .click();
      await page.getByRole("heading", { name: "INV-0003" }).waitFor();
      assert.equal(
        await page.getByLabel("Description 2").inputValue(),
        "Quotation trouser",
      );
      await page
        .getByRole("button", { name: "Save invoice", exact: true })
        .click();
      await page.getByRole("link", { name: "Edit", exact: true }).waitFor();
      await page.getByRole("heading", { name: "INV-0003" }).waitFor();
      console.log("PASS quotation conversion");
      await page.getByRole("link", { name: "Invoices", exact: true }).click();
      await page.getByLabel("Search documents").fill("INV-0001");
      await page.getByRole("link", { name: "INV-0001", exact: true }).waitFor();
      assert.equal(
        await page.getByRole("link", { name: "INV-0002", exact: true }).count(),
        0,
      );
      await page.getByLabel("Date filter").selectOption("custom");
      await page.getByLabel("From date").fill("2000-01-01");
      await page.getByLabel("To date").fill("2000-01-02");
      await page
        .getByRole("heading", { name: "No matching documents" })
        .waitFor();
      console.log("PASS search and date filtering");
      await page.getByLabel("Date filter").selectOption("all");
      await page.getByRole("link", { name: "INV-0001", exact: true }).waitFor();
      await page.getByRole("button", { name: "Archive", exact: true }).click();
      await page
        .getByRole("heading", { name: "No matching documents" })
        .waitFor();
      await page.getByLabel("Archived", { exact: true }).check();
      await page.getByRole("button", { name: "Restore", exact: true }).click();
      await page.getByLabel("Archived", { exact: true }).uncheck();
      await page.getByRole("link", { name: "INV-0001", exact: true }).waitFor();
      console.log("PASS archive and restore");
      await page.getByRole("link", { name: "Dashboard", exact: true }).click();
      await page.getByRole("heading", { name: "Overview." }).waitFor();
      await page.screenshot({
        path: "artifacts/dashboard.png",
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: "artifacts/dashboard-mobile.png",
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await testAccounting(page);
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log("PASS desktop/mobile rendering and no client errors");
  } catch (e) {
    const active = browser?.contexts()[0]?.pages()[0];
    if (active) {
      console.log((await active.locator("body").innerText()).slice(0, 5000));
      await active.screenshot({
        path: "artifacts/browser-failure.png",
        fullPage: true,
      });
    }
    throw e;
  } finally {
    await browser?.close();
    app.kill();
    await backend.close();
    fs.closeSync(log);
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
