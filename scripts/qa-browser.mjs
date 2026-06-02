import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const runtimeNodeModules =
  "/Users/jstudio/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const require = createRequire(`${runtimeNodeModules}/`);
const { chromium } = require("playwright");

const root = path.resolve(".");
const port = 4192;
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const fullPath = path.resolve(root, `.${requestedPath}`);
    if (!fullPath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }
    const body = await readFile(fullPath);
    response.writeHead(200, {
      "Content-Type": mime.get(path.extname(fullPath)) || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));

const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const consoleErrors = [];
const stages = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
await page.waitForSelector("text=반품기한과 보증기간을 다시는 놓치지 마세요.");
const defaultLanguage = await page.locator("#language-select").inputValue();
await page.selectOption("#language-select", "en");
await page.waitForSelector("text=Never miss a return window or warranty again.");
await page.selectOption("#language-select", "zh");
await page.waitForSelector("text=再也不要错过退货窗口或保修期限。");
await page.selectOption("#language-select", "it");
await page.waitForSelector("text=Non perdere piu una finestra di reso o una garanzia.");
await page.selectOption("#language-select", "ko");
await page.waitForSelector("text=반품기한과 보증기간을 다시는 놓치지 마세요.");
stages.push("loaded");
stages.push("language-switch");

const initialRows = await page.locator(".purchase-row").count();
const initialSummary = await page.locator(".summary-card").count();
await page.screenshot({ path: `${root}/outputs/playwright-desktop.png`, fullPage: true });
stages.push("desktop-screenshot");

await page.click("#parse-receipt");
await page.waitForSelector(".parser-preview");
const previewItems = await page.locator(".preview-item").count();
await page.click("#add-parsed-items");
await page.waitForFunction(() => document.querySelectorAll(".purchase-row").length >= 5);
const rowsAfterParse = await page.locator(".purchase-row").count();
stages.push("parse-and-save");

await page.fill("#search-input", "Coffee Maker");
await page.waitForTimeout(150);
const filteredRows = await page.locator(".purchase-row").count();
const filteredText = await page.locator(".purchase-row").first().innerText();
await page.fill("#search-input", "");
await page.waitForTimeout(150);
stages.push("search-filter");

const evidenceDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.locator("[data-evidence]").first().click();
const evidenceDownload = await evidenceDownloadPromise;
const evidencePath = `${root}/outputs/${evidenceDownload.suggestedFilename()}`;
await evidenceDownload.saveAs(evidencePath);
stages.push("evidence-download");

const icsDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.click("#export-ics");
const icsDownload = await icsDownloadPromise;
const icsPath = `${root}/outputs/${icsDownload.suggestedFilename()}`;
await icsDownload.saveAs(icsPath);
stages.push("ics-download");

await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${root}/outputs/playwright-mobile.png`, fullPage: true });
const mobileHasQueue = await page.locator("text=Deadline queue").count();
const mobileHasKoreanQueue = await page.locator("text=마감 큐").count();
stages.push("mobile-screenshot");

await browser.close();
server.close();

const evidenceText = await readFile(evidencePath, "utf8");
const icsText = await readFile(icsPath, "utf8");

const result = {
  url: `http://127.0.0.1:${port}/`,
  defaultLanguage,
  initialRows,
  initialSummary,
  previewItems,
  rowsAfterParse,
  filteredRows,
  filteredTextContainsCoffeeMaker: filteredText.includes("Coffee Maker"),
  evidencePath,
  evidenceContainsChecklist: evidenceText.includes("Claim Checklist"),
  icsPath,
  icsContainsCalendar: icsText.includes("BEGIN:VCALENDAR"),
  mobileHasQueue: mobileHasKoreanQueue || mobileHasQueue,
  stages,
  consoleErrors,
  screenshots: [`${root}/outputs/playwright-desktop.png`, `${root}/outputs/playwright-mobile.png`],
};

const failures = [
  defaultLanguage !== "ko" && "Expected Korean default language",
  initialRows < 3 && "Expected seeded purchase rows",
  initialSummary !== 4 && "Expected four dashboard summary cards",
  previewItems !== 2 && "Expected two parsed receipt items",
  rowsAfterParse < 5 && "Expected parsed items to be saved",
  filteredRows !== 1 && "Expected Coffee Maker search to return one row",
  !result.filteredTextContainsCoffeeMaker && "Expected filtered row to include Coffee Maker",
  !result.evidenceContainsChecklist && "Expected evidence pack checklist",
  !result.icsContainsCalendar && "Expected ICS calendar export",
  mobileHasKoreanQueue < 1 && "Expected mobile layout to include Korean deadline queue",
  consoleErrors.length > 0 && `Console errors: ${consoleErrors.join(" | ")}`,
].filter(Boolean);

console.log(JSON.stringify(result, null, 2));

if (failures.length) {
  throw new Error(failures.join("; "));
}
