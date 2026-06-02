import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const languageOptionCount = await page.locator("#language-select option").count();
await page.selectOption("#language-select", "en");
await page.waitForSelector("text=Never miss a return window or warranty again.");
await page.selectOption("#language-select", "ja");
await page.waitForSelector("text=返品期限や保証期限をもう逃さない。");
await page.selectOption("#language-select", "zh");
await page.waitForSelector("text=再也不要错过退货窗口或保修期限。");
await page.selectOption("#language-select", "de");
await page.waitForSelector("text=Verpasse nie wieder eine Rueckgabe- oder Garantiefrist.");
await page.selectOption("#language-select", "fr");
await page.waitForSelector("text=Ne manquez plus jamais une fenetre de retour ou une garantie.");
await page.selectOption("#language-select", "it");
await page.waitForSelector("text=Non perdere piu una finestra di reso o una garanzia.");
await page.selectOption("#language-select", "hi");
await page.waitForSelector("text=रिटर्न विंडो या वारंटी फिर कभी न चूकें।");
await page.selectOption("#language-select", "ko");
await page.waitForSelector("text=반품기한과 보증기간을 다시는 놓치지 마세요.");
stages.push("loaded");
stages.push("language-switch");

const initialRows = await page.locator(".purchase-row").count();
const initialSummary = await page.locator(".summary-card").count();
await page.screenshot({ path: `${root}/outputs/playwright-desktop.png`, fullPage: true });
stages.push("desktop-screenshot");

const attachmentFixturePath = `${root}/outputs/qa-receipt.pdf`;
await mkdir(`${root}/outputs`, { recursive: true });
await writeFile(attachmentFixturePath, "%PDF-1.4\n% Synthetic QA receipt\n");
await page.fill('input[name="productName"]', "QA Attachment Purchase");
await page.fill('input[name="merchant"]', "QA Store");
await page.fill('input[name="price"]', "42.50");
await page.setInputFiles('input[name="attachments"]', attachmentFixturePath);
await page.click("#purchase-form .primary-action");
await page.waitForFunction(() => document.querySelectorAll(".purchase-row").length >= 4);
await page.waitForSelector("text=qa-receipt.pdf");
const rowsAfterManualSave = await page.locator(".purchase-row").count();
const attachmentVisible = await page.locator("text=qa-receipt.pdf").count();
stages.push("attachment-save");

const ocrFixturePath = `${root}/outputs/qa-ocr-receipt.txt`;
await writeFile(
  ocrFixturePath,
  `OCR Demo Store
Receipt 9001
2026-06-02
Desk Lamp 39.99
Cable Clips 6.99
Total 46.98`,
);
await page.setInputFiles("#ocr-file", ocrFixturePath);
await page.click("#extract-local-ocr");
await page.waitForSelector(".parser-preview");
const previewItems = await page.locator(".preview-item").count();
await page.click("#add-parsed-items");
await page.waitForFunction(() => document.querySelectorAll(".purchase-row").length >= 6);
const rowsAfterParse = await page.locator(".purchase-row").count();
const ocrImportedTextVisible = await page.locator("text=Desk Lamp").count();
stages.push("ocr-extract-and-save");

const csvImportPath = `${root}/outputs/qa-import.csv`;
await writeFile(
  csvImportPath,
  `product_name,merchant,purchase_date,price,return_days,refund_days,warranty_months,documents
"CSV Import Toaster","CSV Home","2026-06-01","49.99","30","14","24","toaster-receipt.pdf; toaster-manual.pdf"`,
);
await page.setInputFiles("#import-json", csvImportPath);
await page.waitForSelector("text=CSV Import Toaster");
const rowsAfterCsvImport = await page.locator(".purchase-row").count();
stages.push("csv-import");

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

const claimDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.locator("[data-claim-packet]").first().click();
const claimDownload = await claimDownloadPromise;
const claimPath = `${root}/outputs/${claimDownload.suggestedFilename()}`;
await claimDownload.saveAs(claimPath);
stages.push("claim-packet-download");

const icsDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.click("#export-ics");
const icsDownload = await icsDownloadPromise;
const icsPath = `${root}/outputs/${icsDownload.suggestedFilename()}`;
await icsDownload.saveAs(icsPath);
stages.push("ics-download");

const csvDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.click("#export-csv");
const csvDownload = await csvDownloadPromise;
const csvPath = `${root}/outputs/${csvDownload.suggestedFilename()}`;
await csvDownload.saveAs(csvPath);
stages.push("csv-download");

await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${root}/outputs/playwright-mobile.png`, fullPage: true });
const mobileHasQueue = await page.locator("text=Deadline queue").count();
const mobileHasKoreanQueue = await page.locator("text=마감 큐").count();
stages.push("mobile-screenshot");

await browser.close();
server.close();

const evidenceText = await readFile(evidencePath, "utf8");
const claimText = await readFile(claimPath, "utf8");
const icsText = await readFile(icsPath, "utf8");
const csvText = await readFile(csvPath, "utf8");

const result = {
  url: `http://127.0.0.1:${port}/`,
  defaultLanguage,
  languageOptionCount,
  initialRows,
  initialSummary,
  rowsAfterManualSave,
  attachmentVisible,
  previewItems,
  rowsAfterParse,
  ocrImportedTextVisible,
  rowsAfterCsvImport,
  filteredRows,
  filteredTextContainsCoffeeMaker: filteredText.includes("Coffee Maker"),
  evidencePath,
  evidenceContainsChecklist: evidenceText.includes("Claim Checklist"),
  claimPath,
  claimContainsPrintPdf: claimText.includes("Print or save PDF") && claimText.includes("Claim Packet"),
  icsPath,
  icsContainsCalendar: icsText.includes("BEGIN:VCALENDAR"),
  csvPath,
  csvContainsHomeFields: csvText.includes("support_contact") && csvText.includes("documents"),
  mobileHasQueue: mobileHasKoreanQueue || mobileHasQueue,
  stages,
  consoleErrors,
  screenshots: [`${root}/outputs/playwright-desktop.png`, `${root}/outputs/playwright-mobile.png`],
};

const failures = [
  defaultLanguage !== "ko" && "Expected Korean default language",
  languageOptionCount !== 8 && "Expected eight language options",
  initialRows < 3 && "Expected seeded purchase rows",
  initialSummary !== 4 && "Expected four dashboard summary cards",
  rowsAfterManualSave < 4 && "Expected manual purchase with attachment to be saved",
  attachmentVisible < 1 && "Expected saved local attachment name to be visible",
  previewItems !== 2 && "Expected two parsed receipt items",
  rowsAfterParse < 6 && "Expected parsed items to be saved",
  ocrImportedTextVisible < 1 && "Expected local OCR extracted receipt item to be visible",
  rowsAfterCsvImport < 7 && "Expected CSV import to add a purchase",
  filteredRows !== 1 && "Expected Coffee Maker search to return one row",
  !result.filteredTextContainsCoffeeMaker && "Expected filtered row to include Coffee Maker",
  !result.evidenceContainsChecklist && "Expected evidence pack checklist",
  !result.claimContainsPrintPdf && "Expected printable claim packet HTML",
  !result.icsContainsCalendar && "Expected ICS calendar export",
  !result.csvContainsHomeFields && "Expected CSV export to include home memory fields",
  mobileHasKoreanQueue < 1 && "Expected mobile layout to include Korean deadline queue",
  consoleErrors.length > 0 && `Console errors: ${consoleErrors.join(" | ")}`,
].filter(Boolean);

console.log(JSON.stringify(result, null, 2));

if (failures.length) {
  throw new Error(failures.join("; "));
}
