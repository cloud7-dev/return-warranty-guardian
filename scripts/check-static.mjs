import { readFile } from "node:fs/promises";
import path from "node:path";

const requiredFiles = [
  "index.html",
  "offline.html",
  "styles.css",
  "manifest.webmanifest",
  "package.json",
  "sw.js",
  "src/app.js",
  "src/attachment-storage.js",
  "src/backup.js",
  "src/deadline-engine.js",
  "src/fixture-sanitizer.js",
  "src/receipt-parser.js",
  "src/i18n.js",
  "src/importers.js",
  "src/local-extraction.js",
  "src/local-ocr-worker.js",
  "src/policy-templates.js",
  "src/storage.js",
  "src/exporters.js",
  "src/sample-data.js",
  "scripts/anonymize-fixture.mjs",
  "scripts/review-sample-intake.mjs",
  "scripts/review-sample-batch.mjs",
  "scripts/sample-intake-coverage-report.mjs",
  "scripts/sample-request-pack.mjs",
  "scripts/release-readiness-report.mjs",
  "scripts/validate-fixtures.mjs",
  "scripts/self-hosted-notification-runner.mjs",
  "scripts/notification-smoke-readiness.mjs",
  "scripts/audit-notification-smoke-records.mjs",
  "scripts/notification-smoke-ops-report.mjs",
  "scripts/smoke-notifications.mjs",
  "scripts/record-notification-smoke-result.mjs",
  "scripts/validate-notification-smoke-record.mjs",
  "tests/fixtures/notifications/smoke-policy.json",
  "tests/fixtures/pdf/scanned-sidecars.json",
  "tests/fixtures/presets/key-governance.json",
  "tests/fixtures/ocr/engine-manifest.json",
  "assets/icon.svg",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
  ".github/ISSUE_TEMPLATE/receipt_parser_issue.md",
  ".github/ISSUE_TEMPLATE/localization_issue.md",
  ".github/workflows/ci.yml",
  ".github/workflows/notification-smoke.yml",
  ".github/workflows/pages.yml",
  "docs/product-boundaries.md",
  "docs/notification-fallback-guide.md",
  "docs/sample-intake.md",
  "docs/release-checklist.md",
  "docs/v2-implementation-checklist.ko.md",
  "docs/assets/desktop.png",
  "docs/assets/mobile.png",
  "LICENSE",
];

for (const file of requiredFiles) {
  await readFile(file, "utf8");
}

const html = await readFile("index.html", "utf8");
const css = await readFile("styles.css", "utf8");
const app = await readFile("src/app.js", "utf8");
const i18n = await readFile("src/i18n.js", "utf8");
const manifest = JSON.parse(await readFile("manifest.webmanifest", "utf8"));
const sw = await readFile("sw.js", "utf8");

const htmlRefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((ref) => !ref.startsWith("http"));

for (const ref of htmlRefs) {
  await readFile(ref.replace(/^\.\//, ""), "utf8");
}

function requireManifestField(condition, message) {
  if (!condition) throw new Error(message);
}

requireManifestField(manifest.name === "Return & Warranty Guardian", "manifest name must match app name");
requireManifestField(manifest.short_name === "Warranty Guardian", "manifest short_name must remain install-friendly");
requireManifestField(manifest.description?.includes("Never miss a return window"), "manifest description must state product value");
requireManifestField(manifest.id === "/return-warranty-guardian/", "manifest id must match GitHub Pages app path");
requireManifestField(manifest.start_url === "./", "manifest start_url must be ./ for Pages and local previews");
requireManifestField(manifest.scope === "./", "manifest scope must be ./ for Pages and local previews");
requireManifestField(manifest.lang === "ko", "manifest lang must reflect Korean default UI");
requireManifestField(manifest.display === "standalone", "manifest display must be standalone");
requireManifestField(manifest.orientation === "portrait-primary", "manifest orientation must prefer mobile install flow");
requireManifestField(/^#[0-9a-f]{6}$/i.test(manifest.background_color), "manifest background_color must be a hex color");
requireManifestField(/^#[0-9a-f]{6}$/i.test(manifest.theme_color), "manifest theme_color must be a hex color");
requireManifestField(manifest.categories?.includes("productivity") && manifest.categories?.includes("utilities"), "manifest categories must include productivity and utilities");
requireManifestField(Array.isArray(manifest.icons) && manifest.icons.length > 0, "manifest must include install icons");

for (const icon of manifest.icons) {
  requireManifestField(icon.src && icon.sizes && icon.type, "manifest icons must include src, sizes, and type");
  requireManifestField(String(icon.purpose || "").includes("maskable"), "manifest icon purpose must include maskable");
  await readFile(icon.src, "utf8");
}

if (!sw.includes("self.skipWaiting()") || !sw.includes("self.clients.claim()")) {
  throw new Error("service worker must take control after install/activate");
}

if (!sw.includes('caches.match("./index.html").then((cached) => cached || caches.match("./offline.html"))')) {
  throw new Error("service worker navigation fallback must prefer cached app shell before offline page");
}

const cachedAssets = [...sw.matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1].replace(/^\.\//, ""));
const cachedAssetSet = new Set(cachedAssets);

for (const cached of cachedAssets) {
  await readFile(cached || "index.html", "utf8");
}

function localImportSpecifiers(source) {
  return [
    ...source.matchAll(/(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["'](\.[^"']+)["']/g),
    ...source.matchAll(/import\(\s*["'](\.[^"']+)["']\s*\)/g),
  ].map((match) => match[1]);
}

async function moduleGraph(entryFile) {
  const visited = new Set();
  const queue = [entryFile];
  while (queue.length) {
    const file = queue.shift();
    const normalized = file.replaceAll(path.sep, "/");
    if (visited.has(normalized)) continue;
    visited.add(normalized);
    const source = await readFile(normalized, "utf8");
    const dirname = path.posix.dirname(normalized);
    for (const specifier of localImportSpecifiers(source)) {
      const resolved = path.posix.normalize(path.posix.join(dirname, specifier));
      if (resolved.endsWith(".js")) queue.push(resolved);
    }
  }
  return visited;
}

const moduleEntryRefs = htmlRefs.filter((ref) => ref.endsWith(".js")).map((ref) => ref.replace(/^\.\//, ""));
const appModuleGraph = new Set();
for (const entry of moduleEntryRefs) {
  for (const moduleFile of await moduleGraph(entry)) {
    appModuleGraph.add(moduleFile);
  }
}

for (const moduleFile of appModuleGraph) {
  if (!cachedAssetSet.has(moduleFile)) {
    throw new Error(`Service worker core cache is missing module: ${moduleFile}`);
  }
}

for (const requiredCached of ["index.html", "offline.html", "styles.css", "manifest.webmanifest", "assets/icon.svg"]) {
  if (!cachedAssetSet.has(requiredCached)) {
    throw new Error(`Service worker core cache is missing required asset: ${requiredCached}`);
  }
}

const requiredUiCopy = [
  "반품기한과 보증기간을 다시는 놓치지 마세요.",
  "마감 큐",
  "영수증 텍스트 파서",
  "캘린더 알림",
  "스누즈",
  "셀프호스티드 알림",
  "셀프호스티드 알림 설정",
  "가져오기 리뷰 체크리스트",
  "프리셋 내보내기",
  "이 행 포함",
  "드라이런",
  "첨부 {saved}개 저장됨",
  "스캔 PDF용 로컬 OCR 텍스트",
  "암호화 백업 만들기",
  "암호화 백업 복구",
  "증빙 데스크",
  "계정도, 서버 업로드도 없습니다.",
  "Never miss a return window or warranty again.",
  "返品期限や保証期限をもう逃さない。",
  "再也不要错过退货窗口或保修期限。",
  "Verpasse nie wieder eine Rueckgabe- oder Garantiefrist.",
  "Ne manquez plus jamais une fenetre de retour ou une garantie.",
  "Non perdere piu una finestra di reso o una garanzia.",
  "रिटर्न विंडो या वारंटी फिर कभी न चूकें।",
  "수리 또는 서비스 이력",
  "supportContact",
];

const uiBundle = `${html}\n${app}\n${i18n}`;

for (const copy of requiredUiCopy) {
  if (!uiBundle.includes(copy)) {
    throw new Error(`Missing required UI copy: ${copy}`);
  }
}

if (!css.includes("@media (max-width: 820px)")) {
  throw new Error("Missing mobile responsive breakpoint");
}

console.log("Static build check passed.");
