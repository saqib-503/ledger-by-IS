import { chromium } from "playwright";
export function launchPdfBrowser() {
  const channel = process.env.PDF_BROWSER_CHANNEL;
  return chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
}
