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
await context.grantPermissions(["notifications"], { origin: `http://127.0.0.1:${port}` });
const page = await context.newPage();
await page.addInitScript(() => {
  class MockNotification {
    static permission = "granted";
    static requestPermission() {
      return Promise.resolve("granted");
    }

    constructor(title, options) {
      window.__rwgNotifications = [...(window.__rwgNotifications || []), { title, options }];
    }
  }
  Object.defineProperty(window, "Notification", { configurable: true, value: MockNotification });
});
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

let serviceWorkerState = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return { supported: false, active: false, controlled: false };
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error("service worker ready timeout")), 7000)),
  ]);
  return { supported: true, active: Boolean(registration.active), controlled: Boolean(navigator.serviceWorker.controller) };
});
if (serviceWorkerState.supported && !serviceWorkerState.controlled) {
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=반품기한과 보증기간을 다시는 놓치지 마세요.");
  serviceWorkerState = await page.evaluate(() => ({
    supported: "serviceWorker" in navigator,
    active: Boolean(navigator.serviceWorker?.controller || navigator.serviceWorker?.ready),
    controlled: Boolean(navigator.serviceWorker?.controller),
  }));
}
await context.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("text=반품기한과 보증기간을 다시는 놓치지 마세요.");
await page.waitForSelector("text=마감 큐");
await page.waitForSelector("text=증빙 데스크");
const offlineAppShellVisible = await page.locator("text=반품기한과 보증기간을 다시는 놓치지 마세요.").count();
const offlineDeadlineQueueVisible = await page.locator("text=마감 큐").count();
const offlineEvidenceDeskVisible = await page.locator("text=증빙 데스크").count();
await context.setOffline(false);
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("text=반품기한과 보증기간을 다시는 놓치지 마세요.");
stages.push("pwa-offline-reload");

const initialRows = await page.locator(".purchase-row").count();
const initialSummary = await page.locator(".summary-card").count();
const calendarGuideVisible = await page.locator("text=캘린더 알림").count();
const reminderQueueVisible = await page.locator("text=앱이 열려 있을 때의 알림 큐").count();
const snoozeButtonVisible = await page.locator('[data-snooze-reminder]').count();
await page.screenshot({ path: `${root}/outputs/playwright-desktop.png`, fullPage: true });
stages.push("desktop-screenshot");

await page.locator('[data-snooze-reminder]').first().click();
await page.waitForSelector("text=3시간 동안 알림을 미뤘습니다.");
const snoozeStatusVisible = await page.locator("text=3시간 동안 알림을 미뤘습니다.").count();
await page.click("#clear-snoozes");
await page.waitForSelector("text=스누즈를 모두 해제했습니다.");
const clearSnoozeVisible = await page.locator("text=스누즈를 모두 해제했습니다.").count();
stages.push("reminder-snooze");

const attachmentFixturePath = `${root}/outputs/qa-receipt.pdf`;
const oversizedAttachmentPath = `${root}/outputs/qa-too-large.pdf`;
await mkdir(`${root}/outputs`, { recursive: true });
await writeFile(attachmentFixturePath, "%PDF-1.4\n% Synthetic QA receipt\n");
await writeFile(oversizedAttachmentPath, Buffer.alloc(5 * 1024 * 1024 + 1, "x"));
await page.fill('input[name="productName"]', "QA Attachment Purchase");
await page.fill('input[name="merchant"]', "QA Store");
await page.fill('input[name="price"]', "42.50");
await page.setInputFiles('input[name="attachments"]', [attachmentFixturePath, oversizedAttachmentPath]);
await page.click("#purchase-form .primary-action");
await page.waitForFunction(() => document.querySelectorAll(".purchase-row").length >= 4);
await page.waitForSelector("text=qa-receipt.pdf");
await page.waitForSelector("text=첨부 1개 저장됨, 5 MB 초과 1개 제외됨.");
const rowsAfterManualSave = await page.locator(".purchase-row").count();
const attachmentVisible = await page.locator("text=qa-receipt.pdf").count();
const attachmentStatusVisible = await page.locator("text=첨부 1개 저장됨, 5 MB 초과 1개 제외됨.").count();
const opfsSupported = await page.evaluate(() => Boolean(navigator.storage?.getDirectory));
const attachmentStorageRecord = await page.evaluate(async () => {
  const purchases = await new Promise((resolve, reject) => {
    const request = indexedDB.open("return-warranty-guardian", 1);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("settings", "readonly");
      const getRequest = transaction.objectStore("settings").get("purchases");
      getRequest.onsuccess = () => resolve(getRequest.result || []);
      getRequest.onerror = () => reject(getRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
  const purchase = purchases.find((item) => item.productName === "QA Attachment Purchase");
  return purchase?.attachments?.[0]?.storage || "";
});
const attachmentDownload = await Promise.all([
  page.waitForEvent("download"),
  page.locator('[data-attachment-purchase]').first().click(),
]).then(([download]) => download);
const attachmentDownloadName = attachmentDownload.suggestedFilename();
stages.push("attachment-save");

await page.selectOption("#policy-template", "extended-60-day-return");
const policyReturnDays = await page.locator('input[name="returnWindowDays"]').inputValue();
const policyNotes = await page.locator('textarea[name="notes"]').inputValue();
stages.push("policy-template");

const ocrFixturePath = `${root}/outputs/qa-ocr-receipt.html`;
await writeFile(
  ocrFixturePath,
  `<!doctype html><html><body>
    <h1>OCR Demo Store</h1>
    <p>Receipt 9001</p>
    <p>2026-06-02</p>
    <p>Desk Lamp 39.99</p>
    <p>Cable Clips 6.99</p>
    <p>Total 46.98</p>
  </body></html>`,
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

const svgOcrFixturePath = `${root}/tests/fixtures/ocr/scanned-receipt.local-ocr.svg`;
await page.setInputFiles("#ocr-file", svgOcrFixturePath);
await page.click("#extract-local-ocr");
await page.waitForSelector("text=Travel Mug");
const svgOcrVisible = await page.locator("text=Travel Mug").count();
stages.push("svg-bundled-ocr-extract");

const pdfOcrFixturePath = `${root}/outputs/qa-ocr-receipt.pdf`;
await writeFile(
  pdfOcrFixturePath,
  `%PDF-1.4
1 0 obj
<<>>
stream
BT
(PDF Demo Store) Tj
[(Monitor) -20 ( Stand 29.99)] TJ
(2026-06-02) Tj
(Total 29.99) Tj
ET
endstream
endobj`,
);
await page.setInputFiles("#ocr-file", pdfOcrFixturePath);
await page.click("#extract-local-ocr");
await page.waitForSelector("text=Monitor Stand");
const pdfOcrVisible = await page.locator("text=Monitor Stand").count();
stages.push("pdf-ocr-extract");

const scannedPdfFixturePath = `${root}/outputs/qa-scanned-receipt.pdf`;
await writeFile(scannedPdfFixturePath, "%PDF-1.4\n/Filter /DCTDecode\n/Subtype /Image\nstream\n...");
await page.setInputFiles("#ocr-file", scannedPdfFixturePath);
await page.click("#extract-local-ocr");
await page.waitForSelector("text=PDF local extraction note");
const scannedPdfFallbackVisible = await page.locator("text=PDF local extraction note").count();
stages.push("scanned-pdf-fallback");

const scannedSidecarText = await readFile(`${root}/tests/fixtures/ocr/scanned-receipt.local-ocr.txt`, "utf8");
await page.fill("#ocr-sidecar-text", scannedSidecarText);
await page.setInputFiles("#ocr-file", scannedPdfFixturePath);
await page.click("#extract-local-ocr");
await page.waitForSelector("text=Fixture OCR Market");
await page.waitForSelector("text=Countertop Filter");
const scannedPdfSidecarVisible = await page.locator("text=Countertop Filter").count();
stages.push("scanned-pdf-sidecar-ocr");

const scannedSidecarFilePath = `${root}/outputs/qa-scanned-receipt.ocr.txt`;
await writeFile(scannedSidecarFilePath, scannedSidecarText.replace("Fixture OCR Market", "Fixture OCR File Market"));
await page.fill("#receipt-text", "");
await page.fill("#ocr-sidecar-text", "");
await page.setInputFiles("#ocr-sidecar-file", scannedSidecarFilePath);
await page.setInputFiles("#ocr-file", scannedPdfFixturePath);
await page.click("#extract-local-ocr");
await page.waitForSelector("text=Fixture OCR File Market");
const scannedPdfSidecarFileVisible = await page.locator("text=Countertop Filter").count();
stages.push("scanned-pdf-sidecar-file-ocr");

const autoPairPdfPath = `${root}/outputs/qa-auto-pair-receipt.pdf`;
const autoPairSidecarPath = `${root}/outputs/qa-auto-pair-receipt.ocr.txt`;
await writeFile(autoPairPdfPath, "%PDF-1.4\n/Filter /DCTDecode\n/Subtype /Image\nstream\n...");
await writeFile(
  autoPairSidecarPath,
  scannedSidecarText
    .replace("Fixture OCR Market", "Fixture OCR Auto Pair Market")
    .replace("Countertop Filter 58.25", "Auto Pair Filter 58.25"),
);
await page.fill("#receipt-text", "");
await page.fill("#ocr-sidecar-text", "");
await page.setInputFiles("#ocr-sidecar-file", []);
await page.setInputFiles("#ocr-file", [autoPairPdfPath, autoPairSidecarPath]);
await page.click("#extract-local-ocr");
await page.waitForSelector("text=Fixture OCR Auto Pair Market");
await page.waitForSelector("text=Auto Pair Filter");
const scannedPdfAutoPairVisible = await page.locator("text=Auto Pair Filter").count();
stages.push("scanned-pdf-auto-pair-ocr");

const koreanCsvPresetPath = `${root}/outputs/qa-korean-card.csv`;
await writeFile(
  koreanCsvPresetPath,
  `승인일,가맹점명,이용금액
"2026-06-01","서울전자","39900"`,
);
await page.setInputFiles("#import-json", koreanCsvPresetPath);
await page.waitForSelector("text=가져오기 미리보기");
await page.selectOption("#csv-preset", "korean-card-statement");
await page.waitForSelector("text=서울전자");
const koreanPresetPreviewVisible = await page.locator("text=서울전자").count();
await page.click("#cancel-import");
stages.push("korean-csv-preset");

const csvImportPath = `${root}/outputs/qa-import.csv`;
await writeFile(
  csvImportPath,
  `thing,shop_name,bought_on,cost,return_days,refund_days,warranty_months,docs
"CSV Import Toaster","CSV Home","2026-06-01","49.99","30","14","24","toaster-receipt.pdf; toaster-manual.pdf"
"Coffee Maker","Kitchen Corner","2026-05-14","84.50","60","30","24","duplicate.pdf"
"Broken Row","","2026-06-01","12.00","30","14","12","missing-merchant.pdf"`,
);
await page.setInputFiles("#import-json", csvImportPath);
await page.waitForSelector("text=가져오기 미리보기");
await page.waitForSelector("text=CSV 프리셋");
await page.locator('[data-import-map="productName"]').selectOption("thing");
await page.locator('[data-import-map="merchant"]').selectOption("shop_name");
await page.locator('[data-import-map="purchaseDate"]').selectOption("bought_on");
await page.locator('[data-import-map="price"]').selectOption("cost");
await page.locator('[data-import-map="documents"]').selectOption("docs");
await page.waitForSelector("text=1개 준비됨");
await page.waitForSelector("text=1개 선택됨");
await page.waitForSelector("text=중복 1개");
await page.waitForSelector("text=오류 1개");
const importPreviewVisible = await page.locator("text=가져오기 미리보기").count();
const importMappingVisible = await page.locator("text=CSV 프리셋").count();
const importDuplicateVisible = await page.locator("text=중복 1개").count();
const importInvalidVisible = await page.locator("text=오류 1개").count();
await page.locator("[data-import-row]").first().uncheck();
await page.waitForSelector("text=0개 선택됨");
const importConfirmDisabledWhenDeselected = await page.locator("#confirm-import").isDisabled();
await page.locator("[data-import-row]").first().check();
await page.waitForSelector("text=1개 선택됨");
const importRowSelectionVisible = await page.locator("text=이 행 포함").count();
page.once("dialog", (dialog) => dialog.accept("QA Statement Preset"));
await page.evaluate(() => document.querySelector("#save-csv-preset")?.click());
await page.waitForFunction(() => [...document.querySelectorAll("#csv-preset option")].some((option) => option.textContent.includes("QA Statement Preset")));
const savedPresetVisible = await page.locator('#csv-preset option:has-text("QA Statement Preset")').count();
const presetBundleDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.click("#export-csv-presets");
const presetBundleDownload = await presetBundleDownloadPromise;
const presetBundlePath = `${root}/outputs/${presetBundleDownload.suggestedFilename()}`;
await presetBundleDownload.saveAs(presetBundlePath);
await page.setInputFiles("#import-json", presetBundlePath);
await page.waitForSelector("text=CSV 프리셋 1개를 가져왔습니다.");
const presetImportStatusVisible = await page.locator("text=CSV 프리셋 1개를 가져왔습니다.").count();
stages.push("csv-preset-bundle");
const importReportDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.click("#export-import-report");
const importReportDownload = await importReportDownloadPromise;
const importReportPath = `${root}/outputs/${importReportDownload.suggestedFilename()}`;
await importReportDownload.saveAs(importReportPath);
stages.push("import-report-download");
await page.click("#confirm-import");
await page.waitForFunction((count) => document.querySelectorAll(".purchase-row").length >= count + 1, rowsAfterParse);
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

const claimBundleDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.locator("[data-claim-bundle]").first().click();
const claimBundleDownload = await claimBundleDownloadPromise;
const claimBundlePath = `${root}/outputs/${claimBundleDownload.suggestedFilename()}`;
await claimBundleDownload.saveAs(claimBundlePath);
stages.push("claim-bundle-download");

const claimZipDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.locator("[data-claim-zip]").first().click();
const claimZipDownload = await claimZipDownloadPromise;
const claimZipPath = `${root}/outputs/${claimZipDownload.suggestedFilename()}`;
await claimZipDownload.saveAs(claimZipPath);
stages.push("claim-zip-download");

const icsDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.click("#export-ics");
const icsDownload = await icsDownloadPromise;
const icsPath = `${root}/outputs/${icsDownload.suggestedFilename()}`;
await icsDownload.saveAs(icsPath);
stages.push("ics-download");

await page.check('input[name="enabled"]');
await page.selectOption('select[name="provider"]', "ntfy");
await page.fill('input[name="endpoint"]', "https://alerts.example.test");
await page.fill('input[name="topic"]', "returns");
await page.click('#self-hosted-alerts-form button[type="submit"]');
await page.waitForSelector("text=셀프호스티드 알림 설정을 로컬에 저장했습니다.");
const selfHostedSettingsSavedVisible = await page.locator("text=셀프호스티드 알림 설정을 로컬에 저장했습니다.").count();
stages.push("self-hosted-settings-save");

const selfHostedDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.click("#export-self-hosted-alerts");
const selfHostedDownload = await selfHostedDownloadPromise;
const selfHostedPath = `${root}/outputs/${selfHostedDownload.suggestedFilename()}`;
await selfHostedDownload.saveAs(selfHostedPath);
stages.push("self-hosted-alerts-download");

const selfHostedDryRunDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.click("#export-self-hosted-dry-run");
const selfHostedDryRunDownload = await selfHostedDryRunDownloadPromise;
const selfHostedDryRunPath = `${root}/outputs/${selfHostedDryRunDownload.suggestedFilename()}`;
await selfHostedDryRunDownload.saveAs(selfHostedDryRunPath);
stages.push("self-hosted-dry-run-download");

await page.click("#enable-local-alerts");
await page.waitForSelector("text=앱이 열려 있을 때의 로컬 알림을 켰습니다.");
const localAlertsVisible = await page.locator("text=앱이 열려 있을 때의 로컬 알림을 켰습니다.").count();
stages.push("local-alerts");

const csvDownloadPromise = page.waitForEvent("download", { timeout: 7000 });
await page.click("#export-csv");
const csvDownload = await csvDownloadPromise;
const csvPath = `${root}/outputs/${csvDownload.suggestedFilename()}`;
await csvDownload.saveAs(csvPath);
stages.push("csv-download");

page.once("dialog", (dialog) => dialog.accept("qa encrypted backup passphrase"));
const encryptedBackupDownloadPromise = page.waitForEvent("download", { timeout: 10000 });
await page.click("#export-encrypted-backup");
const encryptedBackupDownload = await encryptedBackupDownloadPromise;
const encryptedBackupPath = `${root}/outputs/${encryptedBackupDownload.suggestedFilename()}`;
await encryptedBackupDownload.saveAs(encryptedBackupPath);
await page.waitForSelector("text=암호화 백업을 만들었습니다");
const encryptedBackupStatusVisible = await page.locator("text=암호화 백업을 만들었습니다").count();
stages.push("encrypted-backup-download");

await page.evaluate(async () => {
  localStorage.clear();
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("return-warranty-guardian", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("settings", "readwrite");
    transaction.objectStore("settings").put([], "purchases");
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  if (navigator.storage?.getDirectory) {
    try {
      const rootHandle = await navigator.storage.getDirectory();
      await rootHandle.removeEntry("rwg-attachments", { recursive: true });
    } catch {
      // OPFS may be empty or unavailable in the current browser context.
    }
  }
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("text=반품기한과 보증기간을 다시는 놓치지 마세요.");
const rowsAfterFreshState = await page.locator(".purchase-row").count();
page.once("dialog", (dialog) => dialog.accept("qa encrypted backup passphrase"));
await page.setInputFiles("#import-encrypted-backup", encryptedBackupPath);
await page.waitForSelector("text=암호화 백업 복구 미리보기");
const restorePreviewVisible = await page.locator("text=암호화 백업 복구 미리보기").count();
await page.click("#confirm-restore-backup");
await page.waitForSelector("text=암호화 백업에서");
await page.waitForSelector("text=QA Attachment Purchase");
const restoreCompleteVisible = await page.locator("text=암호화 백업에서").count();
const restoredPurchaseVisible = await page.locator("text=QA Attachment Purchase").count();
await page.locator("button.row-title", { hasText: "QA Attachment Purchase" }).click();
const restoredAttachmentDownload = await Promise.all([
  page.waitForEvent("download", { timeout: 10000 }),
  page.locator(".detail-panel [data-attachment-purchase]").first().click(),
]).then(([download]) => download);
const restoredAttachmentDownloadName = restoredAttachmentDownload.suggestedFilename();
const restoredEvidenceDownloadPromise = page.waitForEvent("download", { timeout: 10000 });
await page.locator(".detail-panel [data-evidence]").first().click();
const restoredEvidenceDownload = await restoredEvidenceDownloadPromise;
const restoredEvidencePath = `${root}/outputs/restored-${restoredEvidenceDownload.suggestedFilename()}`;
await restoredEvidenceDownload.saveAs(restoredEvidencePath);
stages.push("encrypted-backup-restore");

const accessibilitySmoke = await page.evaluate(() => {
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  };
  const accessibleName = (element) => {
    const aria = element.getAttribute("aria-label") || element.getAttribute("aria-labelledby");
    const title = element.getAttribute("title");
    const text = element.textContent?.trim();
    const labels = element.labels ? [...element.labels].map((label) => label.textContent.trim()).join(" ") : "";
    return [aria, title, text, labels].find((value) => String(value || "").trim());
  };
  const controls = [...document.querySelectorAll("button,a,input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter(visible);
  const unnamedControls = controls
    .filter((control) => control.tagName !== "INPUT" || control.type !== "hidden")
    .filter((control) => !accessibleName(control))
    .map((control) => control.outerHTML.slice(0, 120));
  const unlabeledFields = [...document.querySelectorAll("input:not([type='hidden']),select,textarea")]
    .filter(visible)
    .filter((field) => !(field.labels?.length || field.getAttribute("aria-label") || field.getAttribute("aria-labelledby")))
    .map((field) => field.outerHTML.slice(0, 120));
  const iconButtonIssues = [...document.querySelectorAll("button.icon-action")]
    .filter(visible)
    .filter((button) => !(button.getAttribute("aria-label") && button.getAttribute("title")))
    .map((button) => button.outerHTML.slice(0, 120));
  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((heading) => Number(heading.tagName.slice(1)));
  const headingJumps = headings.filter((level, index) => index > 0 && level - headings[index - 1] > 1).length;
  return {
    unnamedControls,
    unlabeledFields,
    iconButtonIssues,
    headingJumps,
    hasMain: Boolean(document.querySelector("main")),
    hasNav: Boolean(document.querySelector("nav")),
    hasH1: Boolean(document.querySelector("h1")),
  };
});

await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${root}/outputs/playwright-mobile.png`, fullPage: true });
const mobileHasQueue = await page.locator("text=Deadline queue").count();
const mobileHasKoreanQueue = await page.locator("text=마감 큐").count();
const mobileBackupControlsVisible = await page.locator("text=암호화 백업").count();
const mobileTopbarOverlapCount = await page.evaluate(() => {
  const visibleChildren = [...document.querySelectorAll(".topbar-tools > *")].filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  });
  let overlaps = 0;
  for (let index = 0; index < visibleChildren.length; index += 1) {
    const a = visibleChildren[index].getBoundingClientRect();
    for (let next = index + 1; next < visibleChildren.length; next += 1) {
      const b = visibleChildren[next].getBoundingClientRect();
      const horizontal = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const vertical = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      if (horizontal > 2 && vertical > 2) overlaps += 1;
    }
  }
  return overlaps;
});
stages.push("mobile-screenshot");

await browser.close();
server.close();

const evidenceText = await readFile(evidencePath, "utf8");
const importReportText = await readFile(importReportPath, "utf8");
const presetBundleText = await readFile(presetBundlePath, "utf8");
const claimText = await readFile(claimPath, "utf8");
const claimBundleText = await readFile(claimBundlePath, "utf8");
const claimZipBytes = await readFile(claimZipPath);
const icsText = await readFile(icsPath, "utf8");
const selfHostedText = await readFile(selfHostedPath, "utf8");
const selfHostedDryRunText = await readFile(selfHostedDryRunPath, "utf8");
const csvText = await readFile(csvPath, "utf8");
const encryptedBackupText = await readFile(encryptedBackupPath, "utf8");
const restoredEvidenceText = await readFile(restoredEvidencePath, "utf8");

const result = {
  url: `http://127.0.0.1:${port}/`,
  defaultLanguage,
  languageOptionCount,
  serviceWorkerState,
  serviceWorkerReady: serviceWorkerState.supported && serviceWorkerState.active && serviceWorkerState.controlled,
  offlineAppShellVisible,
  offlineDeadlineQueueVisible,
  offlineEvidenceDeskVisible,
  initialRows,
  initialSummary,
  calendarGuideVisible,
  reminderQueueVisible,
  snoozeButtonVisible,
  snoozeStatusVisible,
  clearSnoozeVisible,
  rowsAfterManualSave,
  attachmentVisible,
  attachmentStatusVisible,
  opfsSupported,
  attachmentStorageRecord,
  attachmentDownloadName,
  policyReturnDays,
  policyNotesUpdated: policyNotes.includes("extended 60-day return"),
  policyReviewNoteVisible: policyNotes.includes("Policy review scope"),
  previewItems,
  rowsAfterParse,
  ocrImportedTextVisible,
  svgOcrVisible,
  pdfOcrVisible,
  scannedPdfFallbackVisible,
  scannedPdfSidecarVisible,
  scannedPdfSidecarFileVisible,
  scannedPdfAutoPairVisible,
  koreanPresetPreviewVisible,
  importPreviewVisible,
  importMappingVisible,
  importDuplicateVisible,
  importInvalidVisible,
  importConfirmDisabledWhenDeselected,
  importRowSelectionVisible,
  savedPresetVisible,
  presetBundlePath,
  presetBundleContainsSchema: presetBundleText.includes("return-warranty-guardian.csv-preset-bundle.v1"),
  presetImportStatusVisible,
  importReportPath,
  importReportContainsCounts: importReportText.includes("csv-import-report.v1") && importReportText.includes('"duplicateCount": 1'),
  rowsAfterCsvImport,
  filteredRows,
  filteredTextContainsCoffeeMaker: filteredText.includes("Coffee Maker"),
  evidencePath,
  evidenceContainsChecklist: evidenceText.includes("Claim Checklist"),
  claimPath,
  claimContainsPrintPdf: claimText.includes("Print or save PDF") && claimText.includes("Claim Packet"),
  claimContainsPdfGuide: claimText.includes("PDF Save Guide") && claimText.includes("Attachment Manifest"),
  claimContainsProfile: claimText.includes("Claim Profile") && claimText.includes("Attachment Export Review"),
  claimContainsTemplates: claimText.includes("Submission Templates") && claimText.includes("Merchant Return Request"),
  claimBundlePath,
  claimBundleContainsEvidence: claimBundleText.includes("return-warranty-guardian.claim-bundle.v1") && claimBundleText.includes("claimPacketHtml"),
  claimBundleContainsManifest: claimBundleText.includes("attachmentManifest"),
  claimBundleContainsProfile: claimBundleText.includes("claimProfile") && claimBundleText.includes("attachmentExportReview"),
  claimBundleContainsTemplates: claimBundleText.includes("submissionTemplates") && claimBundleText.includes("chargeback-summary"),
  claimZipPath,
  claimZipHasSignature: claimZipBytes[0] === 0x50 && claimZipBytes[1] === 0x4b && claimZipBytes.includes(0x50),
  claimZipHasTemplateFiles: Buffer.from(claimZipBytes).includes(Buffer.from("templates/merchant-return.txt")),
  claimZipHasAttachmentManifest: Buffer.from(claimZipBytes).includes(Buffer.from("attachment-manifest.json")),
  claimZipHasAttachmentReview: Buffer.from(claimZipBytes).includes(Buffer.from("attachment-export-review.json")),
  icsPath,
  icsContainsCalendar: icsText.includes("BEGIN:VCALENDAR"),
  icsContainsAlarm: icsText.includes("BEGIN:VALARM") && icsText.includes("TRIGGER:-P"),
  icsContainsRepeatAlarm: icsText.includes("TRIGGER:-P1D"),
  selfHostedPath,
  selfHostedSettingsSavedVisible,
  selfHostedContainsPayload: selfHostedText.includes("return-warranty-guardian.self-hosted-notifications.v1") && selfHostedText.includes("alerts.example.test/returns"),
  selfHostedDryRunPath,
  selfHostedDryRunContainsReport: selfHostedDryRunText.includes("return-warranty-guardian.self-hosted-dry-run.v1") && selfHostedDryRunText.includes("requiresExternalRunner"),
  localAlertsVisible,
  csvPath,
  csvContainsHomeFields: csvText.includes("support_contact") && csvText.includes("documents"),
  encryptedBackupPath,
  encryptedBackupStatusVisible,
  encryptedBackupContainsSchema: encryptedBackupText.includes("return-warranty-guardian.encrypted-backup.v1"),
  encryptedBackupHidesPassphrase: !encryptedBackupText.includes("qa encrypted backup passphrase"),
  rowsAfterFreshState,
  restorePreviewVisible,
  restoreCompleteVisible,
  restoredPurchaseVisible,
  restoredAttachmentDownloadName,
  restoredEvidencePath,
  restoredEvidenceContainsChecklist: restoredEvidenceText.includes("Claim Checklist"),
  accessibilitySmoke,
  accessibilitySmokePassed:
    accessibilitySmoke.unnamedControls.length === 0 &&
    accessibilitySmoke.unlabeledFields.length === 0 &&
    accessibilitySmoke.iconButtonIssues.length === 0 &&
    accessibilitySmoke.headingJumps === 0 &&
    accessibilitySmoke.hasMain &&
    accessibilitySmoke.hasNav &&
    accessibilitySmoke.hasH1,
  mobileHasQueue: mobileHasKoreanQueue || mobileHasQueue,
  mobileBackupControlsVisible,
  mobileTopbarOverlapCount,
  stages,
  consoleErrors,
  screenshots: [`${root}/outputs/playwright-desktop.png`, `${root}/outputs/playwright-mobile.png`],
};

const failures = [
  defaultLanguage !== "ko" && "Expected Korean default language",
  languageOptionCount !== 8 && "Expected eight language options",
  !(serviceWorkerState.supported && serviceWorkerState.active && serviceWorkerState.controlled) && "Expected service worker to install and control the page",
  offlineAppShellVisible < 1 && "Expected offline reload to render cached app shell",
  offlineDeadlineQueueVisible < 1 && "Expected offline reload to render deadline queue",
  offlineEvidenceDeskVisible < 1 && "Expected offline reload to render evidence desk",
  initialRows < 3 && "Expected seeded purchase rows",
  initialSummary !== 4 && "Expected four dashboard summary cards",
  calendarGuideVisible < 1 && "Expected calendar import guide",
  reminderQueueVisible < 1 && "Expected open-app reminder queue",
  snoozeButtonVisible < 1 && "Expected reminder snooze controls",
  snoozeStatusVisible < 1 && "Expected reminder snooze status",
  clearSnoozeVisible < 1 && "Expected clear snooze status",
  rowsAfterManualSave < 4 && "Expected manual purchase with attachment to be saved",
  attachmentVisible < 1 && "Expected saved local attachment name to be visible",
  attachmentStatusVisible < 1 && "Expected attachment save/skipped status",
  opfsSupported && attachmentStorageRecord !== "opfs" && "Expected OPFS attachment storage when browser supports it",
  attachmentDownloadName !== "qa-receipt.pdf" && "Expected local attachment download to hydrate from storage",
  policyReturnDays !== "60" && "Expected policy template to set return days",
  !result.policyNotesUpdated && "Expected policy template to append a user-confirmed note",
  !result.policyReviewNoteVisible && "Expected policy template to append structured review note",
  previewItems !== 2 && "Expected two parsed receipt items",
  rowsAfterParse < 6 && "Expected parsed items to be saved",
  ocrImportedTextVisible < 1 && "Expected local OCR extracted receipt item to be visible",
  svgOcrVisible < 1 && "Expected bundled SVG OCR worker preview",
  pdfOcrVisible < 1 && "Expected local PDF text extraction preview",
  scannedPdfFallbackVisible < 1 && "Expected scanned PDF fallback notice",
  scannedPdfSidecarVisible < 1 && "Expected scanned PDF local OCR sidecar preview",
  scannedPdfSidecarFileVisible < 1 && "Expected scanned PDF local OCR sidecar file preview",
  scannedPdfAutoPairVisible < 1 && "Expected scanned PDF and matching OCR sidecar auto-pair preview",
  koreanPresetPreviewVisible < 1 && "Expected Korean card CSV preset preview",
  importPreviewVisible < 1 && "Expected CSV import preview to appear",
  importMappingVisible < 1 && "Expected CSV mapping controls to appear",
  importDuplicateVisible < 1 && "Expected CSV duplicate count to appear",
  importInvalidVisible < 1 && "Expected CSV invalid row count to appear",
  !importConfirmDisabledWhenDeselected && "Expected import confirm to disable when all rows are deselected",
  importRowSelectionVisible < 1 && "Expected import row include checkboxes",
  savedPresetVisible < 1 && "Expected saved CSV preset to appear",
  !result.presetBundleContainsSchema && "Expected CSV preset bundle export",
  presetImportStatusVisible < 1 && "Expected CSV preset bundle import status",
  !result.importReportContainsCounts && "Expected CSV import report JSON export",
  rowsAfterCsvImport < 7 && "Expected CSV import to add a purchase",
  filteredRows !== 1 && "Expected Coffee Maker search to return one row",
  !result.filteredTextContainsCoffeeMaker && "Expected filtered row to include Coffee Maker",
  !result.evidenceContainsChecklist && "Expected evidence pack checklist",
  !result.claimContainsPrintPdf && "Expected printable claim packet HTML",
  !result.claimContainsPdfGuide && "Expected claim packet PDF save guide and attachment manifest",
  !result.claimContainsProfile && "Expected claim packet profile and attachment export review",
  !result.claimContainsTemplates && "Expected claim packet submission templates",
  !result.claimBundleContainsEvidence && "Expected claim bundle JSON export",
  !result.claimBundleContainsManifest && "Expected claim bundle attachment manifest",
  !result.claimBundleContainsProfile && "Expected claim bundle profile and attachment export review",
  !result.claimBundleContainsTemplates && "Expected claim bundle templates",
  !result.claimZipHasSignature && "Expected claim ZIP bundle export",
  !result.claimZipHasTemplateFiles && "Expected claim ZIP template files",
  !result.claimZipHasAttachmentManifest && "Expected claim ZIP attachment manifest",
  !result.claimZipHasAttachmentReview && "Expected claim ZIP attachment export review",
  !result.icsContainsCalendar && "Expected ICS calendar export",
  !result.icsContainsAlarm && "Expected ICS VALARM reminder export",
  !result.icsContainsRepeatAlarm && "Expected repeated ICS reminder alarm",
  !result.selfHostedContainsPayload && "Expected self-hosted notification payload export",
  selfHostedSettingsSavedVisible < 1 && "Expected self-hosted settings save status",
  !result.selfHostedDryRunContainsReport && "Expected self-hosted dry-run report export",
  localAlertsVisible < 1 && "Expected open-app local alert status",
  !result.csvContainsHomeFields && "Expected CSV export to include home memory fields",
  encryptedBackupStatusVisible < 1 && "Expected encrypted backup success status",
  !result.encryptedBackupContainsSchema && "Expected encrypted backup schema",
  !result.encryptedBackupHidesPassphrase && "Expected encrypted backup envelope to omit raw passphrase",
  rowsAfterFreshState < 3 && "Expected fresh local state to reseed baseline purchases",
  restorePreviewVisible < 1 && "Expected encrypted restore preview",
  restoreCompleteVisible < 1 && "Expected encrypted restore completion status",
  restoredPurchaseVisible < 1 && "Expected restored purchase to appear",
  restoredAttachmentDownloadName !== "qa-receipt.pdf" && "Expected restored attachment download to hydrate from encrypted backup",
  !result.restoredEvidenceContainsChecklist && "Expected restored evidence pack export",
  !result.accessibilitySmokePassed &&
    `Expected accessibility smoke checks to pass: ${JSON.stringify(accessibilitySmoke)}`,
  mobileHasKoreanQueue < 1 && "Expected mobile layout to include Korean deadline queue",
  mobileBackupControlsVisible < 1 && "Expected mobile layout to include encrypted backup controls",
  mobileTopbarOverlapCount !== 0 && "Expected mobile topbar controls not to overlap",
  consoleErrors.length > 0 && `Console errors: ${consoleErrors.join(" | ")}`,
].filter(Boolean);

console.log(JSON.stringify(result, null, 2));

if (failures.length) {
  throw new Error(failures.join("; "));
}
