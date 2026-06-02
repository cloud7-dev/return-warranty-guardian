import { readFile } from "node:fs/promises";

const requiredFiles = [
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "src/app.js",
  "src/deadline-engine.js",
  "src/fixture-sanitizer.js",
  "src/receipt-parser.js",
  "src/i18n.js",
  "src/importers.js",
  "src/local-extraction.js",
  "src/policy-templates.js",
  "src/storage.js",
  "src/exporters.js",
  "src/sample-data.js",
  "scripts/anonymize-fixture.mjs",
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
  ".github/workflows/pages.yml",
  "docs/product-boundaries.md",
  "docs/release-checklist.md",
  "docs/v2-implementation-checklist.ko.md",
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

if (manifest.display !== "standalone") {
  throw new Error("manifest display must be standalone");
}

for (const cached of [...sw.matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1].replace(/^\.\//, ""))) {
  await readFile(cached || "index.html", "utf8");
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
  "첨부 {saved}개 저장됨",
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
