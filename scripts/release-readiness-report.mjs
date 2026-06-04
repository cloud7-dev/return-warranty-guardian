import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { auditNotificationSmokeRecords } from "./audit-notification-smoke-records.mjs";
import { sampleIntakeCoverageReport } from "./sample-intake-coverage-report.mjs";

function markdownTable(rows, columns) {
  if (!rows.length) return "| none |\n| --- |";
  const header = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${columns.map((column) => String(row[column.key] ?? "").replaceAll("|", "\\|")).join(" | ")} |`)
    .join("\n");
  return [header, divider, body].join("\n");
}

export function releaseReadinessReport(sampleManifest, now = new Date(), options = {}) {
  const sampleCoverage = sampleIntakeCoverageReport(sampleManifest, now);
  const notificationSmokeAudit = options.notificationSmokeAudit || null;
  const ocrEngineManifest = options.ocrEngineManifest || null;
  const encryptedBackupAvailable = Boolean(options.encryptedBackupAvailable);
  const pwaReleaseReady = Boolean(options.pwaReleaseReady);
  const priceRecallReady = Boolean(options.priceRecallReady);
  const notificationSmokeReady =
    Boolean(notificationSmokeAudit?.ok) && Boolean(notificationSmokeAudit?.freshSuccessfulProviders?.includes("ntfy"));
  const ocrEngines = Array.isArray(ocrEngineManifest?.engines) ? ocrEngineManifest.engines : [];
  const bundledOcrReady = ocrEngines.some(
    (engine) =>
      engine.id === "bundled-template-pbm-worker" &&
      engine.status === "available" &&
      engine.networkAccess === "none" &&
      engine.storesInput === false &&
      engine.supportedMimeTypes?.includes("image/x-portable-bitmap"),
  );
  const scannedPdfOcrReady = ocrEngines.some(
    (engine) => engine.id === "scanned-pdf-embedded-template-ocr" && engine.status === "available" && engine.networkAccess === "none" && engine.storesInput === false,
  );
  const localOcrReady = bundledOcrReady && scannedPdfOcrReady;
  const gates = [
    {
      area: "Core local-first app",
      status: "Ready for OSS review",
      evidence: "Static web app, PWA shell, local storage, exports, i18n, and browser QA checks are covered by the default validation commands.",
    },
    {
      area: "Fixture intake operations",
      status: sampleCoverage.communityReady ? "Community-ready" : "Needs accepted community/public sample",
      evidence: `Coverage ${sampleCoverage.ok ? "passes" : "fails"} with ${sampleCoverage.entryCount} accepted entries; community status is ${sampleCoverage.communityReady ? "READY" : "MISSING"}.`,
    },
    {
      area: "Local OCR path",
      status: localOcrReady ? "Bundled OCR automation available" : "Partial",
      evidence: localOcrReady
        ? "Text, CSV, HTML/email, PDF text operators, scanned PDF diagnostics, local OCR sidecars, bundled PBM template OCR, and scanned PDF embedded-bitmap OCR automation are covered without network access."
        : "Text, CSV, HTML/email, PDF text operators, scanned PDF diagnostics, local OCR sidecar paste/file/auto-pairing, and adapter fixtures exist.",
    },
    {
      area: "Notification operations",
      status: notificationSmokeReady ? "Recurring public smoke configured" : "Partial",
      evidence: notificationSmokeReady
        ? `Calendar fallback, open-app notifications, self-hosted dry-runs, loopback smoke tests, scheduled workflow, and fresh sanitized public smoke records cover ${notificationSmokeAudit.freshSuccessfulProviders.join(", ")}.`
        : "Calendar fallback, open-app notifications, self-hosted dry-runs, loopback smoke tests, sanitized records, and ops reports exist.",
    },
    {
      area: "Claim evidence export",
      status: "Ready for OSS review",
      evidence: "HTML/JSON/ZIP claim bundles include evidence pack, attachments, manifests, export review, profile, and submission templates.",
    },
    {
      area: "Encrypted backup and recovery",
      status: encryptedBackupAvailable ? "Available" : "Missing",
      evidence: encryptedBackupAvailable
        ? "PBKDF2-SHA256 plus AES-GCM encrypted .rwgbackup export, passphrase-free envelope, restore preview, duplicate-aware merge, and attachment hydration are implemented."
        : "Encrypted backup and merge-only restore are not available yet.",
    },
    {
      area: "Polished PWA release",
      status: pwaReleaseReady ? "Ready" : "Partial",
      evidence: pwaReleaseReady
        ? "Install manifest, service worker app-shell offline fallback, core module cache coverage, accessibility smoke checks, and desktop/mobile release screenshots are covered by static and browser QA."
        : "PWA install, offline, accessibility, and release screenshot evidence are not fully gated yet.",
    },
    {
      area: "Price protection and recall notes",
      status: priceRecallReady ? "Available" : "Missing",
      evidence: priceRecallReady
        ? "Manual price-protection deadlines, price adjustment candidates, safety/recall notes, Korean UI filters, CSV/evidence/claim exports, encrypted backup preservation, and browser QA coverage are implemented without scraping or external lookup."
        : "Manual price-protection and recall/safety note coverage is not fully wired into deadlines, filters, exports, and QA yet.",
    },
  ];

  return {
    schema: "return-warranty-guardian.release-readiness-report.v1",
    generatedAt: now.toISOString(),
    gates,
    remainingItems: [
      ...(!sampleCoverage.communityReady
        ? ["2. Actual anonymized-community or public-open-license user/community samples accepted into the fixture corpus."]
        : []),
      ...(!localOcrReady ? ["3. Actual bundled cross-browser OCR engine and automated scanned PDF OCR path beyond sidecars/adapters."] : []),
      ...(!notificationSmokeReady
        ? ["4. Actual recurring public/self-hosted endpoint smoke records operated by the maintainer environment."]
        : []),
      ...(!encryptedBackupAvailable ? ["7. Encrypted backup and merge-only recovery for local data durability."] : []),
      ...(!pwaReleaseReady ? ["9. Polished PWA release with install QA, offline fallback, release screenshots, and accessibility pass."] : []),
      ...(!priceRecallReady ? ["10. Price protection and recall/safety notes across deadlines, filters, exports, backup, and QA."] : []),
    ],
    recommendedCommands: [
      "node --check src/*.js scripts/*.mjs tests/*.mjs",
      "npm test",
      "npm run build",
      "npm run pwa:readiness",
      "npm run fixture:validate",
      "npm run fixture:coverage -- tests/fixtures/intake/sample-intake.json",
      "npm run fixture:request-pack -- tests/fixtures/intake/sample-intake.json",
      "npm run release:readiness -- tests/fixtures/intake/sample-intake.json",
      "npm run qa:browser",
    ],
  };
}

export function releaseReadinessMarkdown(report) {
  const remainingNumbers = report.remainingItems.map((item) => item.match(/^(\d+)\./)?.[1]).filter(Boolean);
  const remainingLabel = remainingNumbers.length ? `${remainingNumbers.join(", ")} remain.` : "No numbered follow-up items remain.";
  return `# Release Readiness Report

Generated: ${report.generatedAt}

## Gates

${markdownTable(report.gates, [
  { key: "area", label: "Area" },
  { key: "status", label: "Status" },
  { key: "evidence", label: "Evidence" },
])}

## Recommended Verification

${report.recommendedCommands.map((command) => `- \`${command}\``).join("\n")}

## Remaining Items

${report.remainingItems.length ? report.remainingItems.map((item) => `- ${item}`).join("\n") : "- None"}

${remainingLabel}
`;
}

async function main() {
  const manifestPath = process.argv.find((item, index) => index > 1 && !item.startsWith("--")) || "tests/fixtures/intake/sample-intake.json";
  const sampleManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const policy = JSON.parse(await readFile("tests/fixtures/notifications/smoke-policy.json", "utf8"));
  const ocrEngineManifest = JSON.parse(await readFile("tests/fixtures/ocr/engine-manifest.json", "utf8"));
  const backupSource = await readFile("src/backup.js", "utf8");
  const deadlineSource = await readFile("src/deadline-engine.js", "utf8");
  const appSource = await readFile("src/app.js", "utf8");
  const exporterSource = await readFile("src/exporters.js", "utf8");
  const i18nSource = await readFile("src/i18n.js", "utf8");
  const manifest = JSON.parse(await readFile("manifest.webmanifest", "utf8"));
  const sw = await readFile("sw.js", "utf8");
  await readFile("offline.html", "utf8");
  await readFile("docs/assets/desktop.png");
  await readFile("docs/assets/mobile.png");
  const encryptedBackupAvailable =
    backupSource.includes("return-warranty-guardian.encrypted-backup.v1") &&
    backupSource.includes("encryptedBackupEnvelope") &&
    backupSource.includes("backupRestorePreview") &&
    backupSource.includes("mergeBackupPurchases");
  const pwaReleaseReady =
    manifest.id === "/return-warranty-guardian/" &&
    manifest.start_url === "./" &&
    manifest.scope === "./" &&
    manifest.display === "standalone" &&
    manifest.lang === "ko" &&
    sw.includes('caches.match("./index.html").then((cached) => cached || caches.match("./offline.html"))') &&
    sw.includes("./src/backup.js") &&
    sw.includes("self.skipWaiting()") &&
    sw.includes("self.clients.claim()");
  const priceRecallReady =
    deadlineSource.includes("priceProtectionCandidate") &&
    deadlineSource.includes('"price-protection"') &&
    appSource.includes('"safety-check"') &&
    appSource.includes("priceProtectionRecallSection") &&
    exporterSource.includes("Price Protection") &&
    exporterSource.includes("Recall and Safety Notes") &&
    exporterSource.includes("price_protection_deadline") &&
    i18nSource.includes("가격보호") &&
    i18nSource.includes("공식 리콜 또는 안전 여부");
  const notificationSmokeAudit = await auditNotificationSmokeRecords("tests/fixtures/notifications/smoke-records", policy);
  console.log(
    releaseReadinessMarkdown(
      releaseReadinessReport(sampleManifest, new Date(), {
        notificationSmokeAudit,
        ocrEngineManifest,
        encryptedBackupAvailable,
        pwaReleaseReady,
        priceRecallReady,
      }),
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
