import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { addDays, addMonths, computeDeadlines, daysUntil, summarizePurchases } from "../src/deadline-engine.js";
import {
  attachmentToDataUrl,
  fileToLocalAttachment,
  hydratePurchaseAttachments,
  localAttachmentStorageMode,
} from "../src/attachment-storage.js";
import {
  BACKUP_PAYLOAD_SCHEMA,
  backupPayloadFromState,
  backupRestorePreview,
  decryptBackupEnvelope,
  encryptedBackupEnvelope,
  mergeBackupPurchases,
} from "../src/backup.js";
import { sanitizeFixtureFilename, sanitizeFixtureReport, sanitizeFixtureText } from "../src/fixture-sanitizer.js";
import { buildRunnerPlan, schedulerRecipes } from "../scripts/self-hosted-notification-runner.mjs";
import { auditNotificationSmokeRecords } from "../scripts/audit-notification-smoke-records.mjs";
import { notificationSmokeOpsReportMarkdown } from "../scripts/notification-smoke-ops-report.mjs";
import { notificationSmokeReadiness } from "../scripts/notification-smoke-readiness.mjs";
import { notificationSmokeRecord } from "../scripts/record-notification-smoke-result.mjs";
import { releaseReadinessMarkdown, releaseReadinessReport } from "../scripts/release-readiness-report.mjs";
import { sampleIntakeCoverageMarkdown, sampleIntakeCoverageReport } from "../scripts/sample-intake-coverage-report.mjs";
import { sampleRequestPack, sampleRequestPackMarkdown } from "../scripts/sample-request-pack.mjs";
import { validateNotificationSmokeRecord } from "../scripts/validate-notification-smoke-record.mjs";
import {
  analyzeCsvImport,
  csvImportReport,
  csvImportReviewFilters,
  csvImportReviewChecklist,
  csvHeaders,
  csvMappingForPreset,
  csvPresetBundle,
  csvPresetBundleFingerprint,
  csvPresetBundleSigningPayload,
  csvPresetBundleReviewSummary,
  purchasesFromCsv,
  validateCsvPresetBundle,
  verifyCsvPresetBundleDetachedSignatures,
  verifyCsvPresetBundleFingerprint,
} from "../src/importers.js";
import {
  embeddedBundledOcrBitmapFromPdf,
  localOcrEnginePlan,
  pdfExtractionDiagnostics,
  pdfExtractionStatus,
  textFromHtmlSource,
  textFromImageSource,
  textFromPdfSource,
  textFromScannedPdfWithBundledOcr,
  textFromScannedPdfWithLocalOcr,
} from "../src/local-extraction.js";
import { bundledLocalOcrWorker, bundledLocalOcrWorkerSupports, localOcrEnvironment, renderBundledOcrPbm } from "../src/local-ocr-worker.js";
import { policyTemplateById, policyTemplateReviewNote } from "../src/policy-templates.js";
import { parseReceiptText } from "../src/receipt-parser.js";
import {
  attachmentExportReview,
  browserPdfSaveGuide,
  claimPacketBundleJson,
  claimPacketHtml,
  claimPacketZipBytes,
  claimPacketProfile,
  claimSubmissionTemplates,
  evidencePackMarkdown,
  purchasesToCsv,
  purchasesToIcs,
  reminderAlarmOffsets,
  selfHostedDryRunReport,
  selfHostedNotificationPayload,
} from "../src/exporters.js";

const now = new Date("2026-06-02T10:00:00Z");
const fixture = (path) => readFile(new URL(`./fixtures/${path}`, import.meta.url), "utf8");
const execFileAsync = promisify(execFile);

const sanitizedFixture = sanitizeFixtureText(`Jane Buyer
jane.buyer@example.com
010-1234-5678
ORDER AB12CD34
4111-1111-1111-1111
서울시 샘플구 12345`);
assert.doesNotMatch(sanitizedFixture, /jane\.buyer@example\.com/);
assert.doesNotMatch(sanitizedFixture, /010-1234-5678/);
assert.doesNotMatch(sanitizedFixture, /4111-1111-1111-1111/);
assert.match(sanitizedFixture, /user@example\.test/);
assert.equal(sanitizeFixtureFilename("Real Receipt 2026.pdf"), "real-receipt-2026");
const fixtureReport = sanitizeFixtureReport(`buyer@example.com
ORDER XYZA1234
4111-1111-1111-1111`);
assert.equal(fixtureReport.schema, "return-warranty-guardian.fixture-anonymize-report.v1");
assert.equal(fixtureReport.redacted, 3);
assert.match(fixtureReport.sanitizedText, /user@example\.test/);
assert.doesNotMatch(fixtureReport.sanitizedText, /4111-1111-1111-1111/);

assert.equal(addDays("2026-06-02", 30), "2026-07-02");
assert.equal(addDays("2026-06-02", 14), "2026-06-16");
assert.equal(addMonths("2026-06-02", 12), "2027-06-02");
assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
assert.equal(daysUntil("2026-06-16", now), 14);

const purchase = {
  id: "test",
  productName: "Wireless Headset",
  merchant: "Example Electronics",
  purchaseDate: "2026-06-02",
  price: 129.99,
  returnWindowDays: 30,
  refundWindowDays: 14,
  warrantyMonths: 12,
  reminderLeadDays: 5,
  hasReceipt: true,
  status: "active",
  category: "Electronics",
  room: "Home office",
  supportContact: "support@example.test",
  documents: ["receipt.pdf", "manual.pdf"],
  attachments: [
    {
      name: "warranty-card.pdf",
      type: "application/pdf",
      size: 128,
      dataUrl: "data:application/pdf;base64,JVBERi0x",
    },
    {
      name: "receipt-photo.png",
      type: "image/png",
      size: 96,
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    },
  ],
  serviceNotes: "No repairs yet.",
};

const enriched = computeDeadlines(purchase, now);
assert.equal(enriched.returnDeadline, "2026-07-02");
assert.equal(enriched.refundDeadline, "2026-06-16");
assert.equal(enriched.warrantyDeadline, "2027-06-02");
assert.equal(enriched.deadlines.find((deadline) => deadline.type === "refund").status, "due-soon");

const summary = summarizePurchases([purchase], now);
assert.equal(summary.total, 1);
assert.equal(summary.dueSoon, 1);
assert.equal(summary.missingProof, 0);
assert.equal(summary.returnValueAtRisk, 129.99);

const fallbackAttachmentFile = new Blob(["%PDF-1.4\n% Local fallback attachment"], { type: "application/pdf" });
Object.defineProperty(fallbackAttachmentFile, "name", { value: "fallback-receipt.pdf" });
const fallbackAttachment = await fileToLocalAttachment(fallbackAttachmentFile, "purchase-test");
assert.equal(localAttachmentStorageMode(), "data-url");
assert.equal(fallbackAttachment.storage, "data-url");
assert.match(fallbackAttachment.dataUrl, /^data:application\/pdf;base64,/);
assert.equal(await attachmentToDataUrl(fallbackAttachment), fallbackAttachment.dataUrl);
const hydratedFallbackPurchase = await hydratePurchaseAttachments({ ...purchase, attachments: [fallbackAttachment] });
assert.equal(hydratedFallbackPurchase.attachments[0].dataUrl, fallbackAttachment.dataUrl);

const opfsBackupPurchase = {
  ...purchase,
  id: "backup-opfs",
  productName: "Backup Router",
  merchant: "Backup Shop",
  purchaseDate: "2026-06-01",
  attachments: [{ name: "opfs-receipt.pdf", type: "application/pdf", size: 64, storage: "opfs", opfsPath: "backup/opfs-receipt.pdf" }],
};
const backupPayload = await backupPayloadFromState(
  {
    purchases: [opfsBackupPurchase],
    userCsvPresets: [{ id: "user-backup", label: "Backup Preset", mapping: { productName: "item" } }],
    selfHostedAlerts: { enabled: true, provider: "ntfy", endpoint: "https://alerts.example.test", topic: "returns" },
    snoozedReminders: { "backup-opfs:return:2026-07-01": "2026-06-03T00:00:00.000Z" },
    hydratePurchase: async (item) => ({
      ...item,
      attachments: item.attachments.map((attachment) => ({
        ...attachment,
        dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
      })),
    }),
  },
  now,
);
assert.equal(backupPayload.schema, BACKUP_PAYLOAD_SCHEMA);
assert.equal(backupPayload.backupManifest.purchaseCount, 1);
assert.equal(backupPayload.backupManifest.includedAttachmentCount, 1);
assert.match(backupPayload.purchases[0].attachments[0].dataUrl, /^data:application\/pdf;base64,/);
const skippedBackupPayload = await backupPayloadFromState(
  {
    purchases: [
      {
        ...opfsBackupPurchase,
        attachments: [
          { name: "too-large.pdf", type: "application/pdf", size: 5 * 1024 * 1024 + 1, storage: "opfs", opfsPath: "backup/too-large.pdf" },
          { name: "missing-opfs.pdf", type: "application/pdf", size: 128, storage: "opfs", opfsPath: "backup/missing-opfs.pdf" },
        ],
      },
    ],
    hydratePurchase: async (item) => item,
  },
  now,
);
assert.equal(skippedBackupPayload.backupManifest.skippedAttachmentCount, 2);
assert.deepEqual(
  skippedBackupPayload.backupManifest.skippedAttachments.map((item) => item.reason),
  ["over-size-limit", "hydration-failed"],
);
const encryptedBackup = await encryptedBackupEnvelope(backupPayload, "correct horse battery staple", now);
const encryptedBackupText = JSON.stringify(encryptedBackup);
assert.match(encryptedBackupText, /return-warranty-guardian\.encrypted-backup\.v1/);
assert.doesNotMatch(encryptedBackupText, /correct horse battery staple/);
const decryptedBackup = await decryptBackupEnvelope(encryptedBackup, "correct horse battery staple");
assert.equal(decryptedBackup.purchases[0].productName, "Backup Router");
await assert.rejects(() => decryptBackupEnvelope(encryptedBackup, "wrong passphrase"), /Wrong passphrase or corrupted backup file/);
await assert.rejects(() => decryptBackupEnvelope({ ...encryptedBackup, schema: "unknown" }, "correct horse battery staple"), /Unsupported encrypted backup schema/);
await assert.rejects(() => decryptBackupEnvelope({ ...encryptedBackup, ciphertext: "not-valid-json" }, "correct horse battery staple"), /Wrong passphrase or corrupted backup file/);
const restorePreview = backupRestorePreview(backupPayload, [opfsBackupPurchase]);
assert.equal(restorePreview.recordCount, 1);
assert.equal(restorePreview.attachmentCount, 1);
assert.equal(restorePreview.duplicateCandidates.length, 1);
const mergeResult = mergeBackupPurchases(
  {
    ...backupPayload,
    purchases: [opfsBackupPurchase, { ...opfsBackupPurchase, id: "backup-new", productName: "Backup Monitor" }],
  },
  [opfsBackupPurchase],
);
assert.equal(mergeResult.addedCount, 1);
assert.equal(mergeResult.duplicateCount, 1);
assert.equal(mergeResult.purchases[0].productName, "Backup Monitor");
assert.equal(mergeResult.purchases[1].productName, "Backup Router");

const parsed = parseReceiptText(`Example Electronics
Receipt 7142
2026-06-02
Wireless Headset 129.99
Phone Case 24.99
Subtotal 154.98
Tax 12.01
Total 166.99`);

assert.equal(parsed.merchant, "Example Electronics");
assert.equal(parsed.purchaseDate, "2026-06-02");
assert.equal(parsed.total, 166.99);
assert.deepEqual(
  parsed.items.map((item) => item.name),
  ["Wireless Headset", "Phone Case"],
);

const pack = evidencePackMarkdown(purchase, now);
assert.match(pack, /Evidence Pack: Wireless Headset/);
assert.match(pack, /2026-07-02/);
assert.match(pack, /Claim Checklist/);
assert.match(pack, /receipt\.pdf/);
assert.match(pack, /warranty-card\.pdf/);
assert.match(pack, /Home office/);

const csv = purchasesToCsv([purchase], now);
assert.match(csv, /product_name/);
assert.match(csv, /reminder_lead_days/);
assert.match(csv, /Wireless Headset/);
assert.match(csv, /manual\.pdf/);
assert.match(csv, /warranty-card\.pdf/);

const imported = purchasesFromCsv(`product_name,merchant,purchase_date,price,return_days,refund_days,warranty_months,documents
"Imported Lamp","Home Store","2026-06-01","59.99","30","14","24","lamp-receipt.pdf; lamp-manual.pdf"`, now);
assert.equal(imported.length, 1);
assert.equal(imported[0].productName, "Imported Lamp");
assert.equal(imported[0].documents.length, 2);

const analyzed = analyzeCsvImport(
  `product_name,merchant,purchase_date,price
"Imported Lamp","Home Store","2026-06-01","59.99"
"Wireless Headset","Example Electronics","2026-06-02","129.99"
"Missing Merchant","","2026-06-01","10.00"`,
  [purchase],
  now,
);
assert.equal(analyzed.valid.length, 1);
assert.equal(analyzed.duplicates.length, 1);
assert.equal(analyzed.invalid.length, 1);
const importReport = JSON.parse(csvImportReport({ ...analyzed, fileName: "qa.csv" }, now));
assert.equal(importReport.schema, "return-warranty-guardian.csv-import-report.v1");
assert.equal(importReport.duplicateCount, 1);
assert.equal(importReport.invalidCount, 1);
const reviewChecklist = csvImportReviewChecklist(analyzed);
assert.equal(reviewChecklist.length, 4);
assert.equal(reviewChecklist.find((item) => item.id === "duplicate-review").status, "warn");
assert.equal(reviewChecklist.find((item) => item.id === "invalid-review").status, "warn");
const reviewFilters = csvImportReviewFilters(analyzed, { query: "lamp", proof: "without-proof" });
assert.equal(reviewFilters.schema, "return-warranty-guardian.csv-import-review-filters.v1");
assert.equal(reviewFilters.totalCount, 3);
assert.equal(reviewFilters.filteredCount, 1);
assert.equal(reviewFilters.sections.valid[0].purchase.productName, "Imported Lamp");
const presetBundle = JSON.parse(
  csvPresetBundle(
    [{ id: "user-test", label: "User Test", mapping: { price: "amount" }, source: "community-fixture", fixtureCoverage: ["tests/fixtures/csv/shopify-order-export.csv"] }],
    now,
  ),
);
assert.equal(presetBundle.schema, "return-warranty-guardian.csv-preset-bundle.v1");
assert.equal(presetBundle.version, 1);
assert.equal(presetBundle.trustModel, "community-reviewed-local-mapping");
assert.equal(presetBundle.signatureStatus, "unsigned-local-draft");
assert.equal(presetBundle.signatureAlgorithm, "sha256-fingerprint-detached-signature-ready");
assert.equal(presetBundle.presets[0].mapping.price, "amount");
assert.equal(presetBundle.presets[0].source, "community-fixture");
const presetFingerprint = await csvPresetBundleFingerprint(presetBundle);
assert.match(presetFingerprint, /^[a-f0-9]{64}$/);
const unsignedFingerprintCheck = await verifyCsvPresetBundleFingerprint(presetBundle);
assert.equal(unsignedFingerprintCheck.ok, false);
assert.equal(unsignedFingerprintCheck.status, "unsigned-local-draft");
const fingerprintedPresetBundle = { ...presetBundle, fingerprint: presetFingerprint };
const fingerprintCheck = await verifyCsvPresetBundleFingerprint(fingerprintedPresetBundle);
assert.equal(fingerprintCheck.ok, true);
assert.equal(fingerprintCheck.status, "fingerprint-matched");
const signingKeyPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const publicKeyJwk = await crypto.subtle.exportKey("jwk", signingKeyPair.publicKey);
const detachedSignatureBytes = await crypto.subtle.sign(
  { name: "ECDSA", hash: "SHA-256" },
  signingKeyPair.privateKey,
  new TextEncoder().encode(csvPresetBundleSigningPayload(fingerprintedPresetBundle)),
);
const detachedSignature = Buffer.from(new Uint8Array(detachedSignatureBytes)).toString("base64url");
const signedPresetBundle = {
  ...fingerprintedPresetBundle,
  signatureStatus: "detached-signature",
  signatures: [{ keyId: "fixture-key", algorithm: "ECDSA-P256-SHA256", signature: detachedSignature }],
};
const signatureCheck = await verifyCsvPresetBundleDetachedSignatures(signedPresetBundle, [
  { keyId: "fixture-key", publicKeyJwk },
]);
assert.equal(signatureCheck.schema, "return-warranty-guardian.csv-preset-signature-verification.v1");
assert.equal(signatureCheck.ok, true);
assert.equal(signatureCheck.verifiedCount, 1);
const trustedKeysFixture = JSON.parse(await fixture("presets/trusted-keys.json"));
const signedBundleFixture = JSON.parse(await fixture("presets/signed-bundle.json"));
const keyGovernanceFixture = JSON.parse(await fixture("presets/key-governance.json"));
assert.equal(trustedKeysFixture.schema, "return-warranty-guardian.csv-preset-trusted-keys.v1");
assert.equal(trustedKeysFixture.keys[0].purpose, "csv-preset-review");
assert.equal(keyGovernanceFixture.schema, "return-warranty-guardian.csv-preset-key-governance.v1");
assert.equal(keyGovernanceFixture.keyStates.find((key) => key.keyId === "fixture-maintainer-p256").state, "active");
assert.ok(keyGovernanceFixture.keyStates.some((key) => key.state === "revoked"));
const signedBundleFingerprintCheck = await verifyCsvPresetBundleFingerprint(signedBundleFixture);
assert.equal(signedBundleFingerprintCheck.ok, true);
const signedBundleSignatureCheck = await verifyCsvPresetBundleDetachedSignatures(signedBundleFixture, trustedKeysFixture.keys);
assert.equal(signedBundleSignatureCheck.ok, true);
assert.equal(signedBundleSignatureCheck.verifiedCount, 1);
const reviewManifest = JSON.parse(await fixture("presets/review-manifest.json"));
const reviewSummary = await csvPresetBundleReviewSummary(fingerprintedPresetBundle, {
  ...reviewManifest,
  fingerprint: presetFingerprint,
});
assert.equal(reviewSummary.schema, "return-warranty-guardian.csv-preset-review-summary.v1");
assert.equal(reviewSummary.ok, true);
assert.equal(reviewSummary.status, "community-reviewed");
assert.equal(reviewSummary.acceptedCount, 2);
const presetValidation = validateCsvPresetBundle({
  ...presetBundle,
  presets: [{ id: "user-test", label: "User Test", mapping: { price: "amount", unexpected: "x" } }],
});
assert.equal(presetValidation.ok, true);
assert.equal(presetValidation.warnings.length, 3);
assert.match(presetValidation.warnings.join(" "), /no source metadata/);
assert.deepEqual(presetValidation.presets[0].mapping, { price: "amount" });

const cardMapping = csvMappingForPreset(["transaction_date", "description", "amount"], "card-statement");
assert.equal(cardMapping.merchant, "description");
assert.equal(cardMapping.purchaseDate, "transaction_date");
assert.equal(cardMapping.price, "amount");
const mapped = analyzeCsvImport(
  `transaction_date,description,amount
"2026-06-01","Mapped Card Store","19.95"`,
  [],
  now,
  { presetId: "card-statement", mapping: cardMapping },
);
assert.equal(mapped.valid[0].purchase.productName, "Mapped Card Store");
assert.equal(mapped.valid[0].purchase.price, 19.95);
assert.equal(mapped.valid[0].purchase.reminderLeadDays, 3);

const koreanCardMapping = csvMappingForPreset(["승인일", "가맹점명", "이용금액"], "korean-card-statement");
assert.equal(koreanCardMapping.purchaseDate, "승인일");
assert.equal(koreanCardMapping.productName, "가맹점명");
assert.equal(koreanCardMapping.price, "이용금액");
const koreanCard = analyzeCsvImport(
  `승인일,가맹점명,이용금액
"2026-06-01","서울전자","₩39,900"`,
  [],
  now,
  { presetId: "korean-card-statement", mapping: koreanCardMapping },
);
assert.equal(koreanCard.valid[0].purchase.productName, "서울전자");
assert.equal(koreanCard.valid[0].purchase.price, 39900);

const amazonMapping = csvMappingForPreset(["order_date", "title", "seller", "item_subtotal", "order_id"], "amazon-style-order");
assert.equal(amazonMapping.productName, "title");
assert.equal(amazonMapping.documents, "order_id");

const koreanOrderMapping = csvMappingForPreset(["주문일", "상품명", "판매자", "결제금액", "주문번호"], "korean-shopping-order");
assert.equal(koreanOrderMapping.productName, "상품명");
assert.equal(koreanOrderMapping.merchant, "판매자");

const shopifyMapping = csvMappingForPreset(["created_at", "lineitem_name", "vendor", "lineitem_price", "name"], "shopify-order-export");
assert.equal(shopifyMapping.productName, "lineitem_name");
assert.equal(shopifyMapping.documents, "name");

const stripeMapping = csvMappingForPreset(["created", "description", "statement_descriptor", "amount_paid", "receipt_url"], "stripe-receipt-export");
assert.equal(stripeMapping.productName, "description");
assert.equal(stripeMapping.merchant, "statement_descriptor");

const fixtureCases = [
  {
    path: "csv/korean-card-statement.csv",
    presetId: "korean-card-statement",
    expectedProduct: "서울전자",
    expectedPrice: 39900,
  },
  {
    path: "csv/korean-shopping-order.csv",
    presetId: "korean-shopping-order",
    expectedProduct: "무선 청소기 필터",
    expectedPrice: 18900,
  },
  {
    path: "csv/amazon-style-order.csv",
    presetId: "amazon-style-order",
    expectedProduct: "USB-C Hub",
    expectedPrice: 32.49,
  },
  {
    path: "csv/shopify-order-export.csv",
    presetId: "shopify-order-export",
    expectedProduct: "Desk Lamp Shade",
    expectedPrice: 27.5,
  },
  {
    path: "csv/stripe-receipt-export.csv",
    presetId: "stripe-receipt-export",
    expectedProduct: "Countertop Water Filter",
    expectedPrice: 58.25,
  },
];
for (const item of fixtureCases) {
  const text = await fixture(item.path);
  const mapping = csvMappingForPreset(csvHeaders(text), item.presetId);
  const preview = analyzeCsvImport(text, [], now, { presetId: item.presetId, mapping });
  assert.equal(preview.valid.length, 1);
  assert.equal(preview.valid[0].purchase.productName, item.expectedProduct);
  assert.equal(preview.valid[0].purchase.price, item.expectedPrice);
}

const emailFixture = textFromHtmlSource(await fixture("receipts/email-receipt.html"));
assert.match(emailFixture, /Fixture Demo Store/);
assert.match(emailFixture, /Desk Organizer 18.50/);
assert.equal(parseReceiptText(emailFixture).items[0].name, "Desk Organizer");

const pdfText = textFromPdfSource(`%PDF-1.4
BT
(PDF Demo Store) Tj
[(Monitor) -20 ( Stand)] TJ
<323032362d30362d3032> Tj
ET`);
assert.match(pdfText, /PDF Demo Store/);
assert.match(pdfText, /Monitor Stand/);
assert.match(pdfText, /2026-06-02/);

const pdfFixtureText = textFromPdfSource(await fixture("pdf/simple-text-operator.pdf.txt"));
assert.match(pdfFixtureText, /PDF Fixture Store/);
assert.match(pdfFixtureText, /Warranty Router 89.00/);
const scannedPdfFallback = textFromPdfSource("%PDF-1.4\n/Filter /DCTDecode\n/Subtype /Image\nstream\n...");
assert.match(scannedPdfFallback, /appears to be compressed, image-based, or scanned/);
assert.equal(pdfExtractionStatus("%PDF-1.4\n/Filter /DCTDecode\n/Subtype /Image\nstream\n..."), "scanned-or-compressed");
assert.equal(pdfExtractionStatus("(Readable) Tj"), "text-operator");
const scannedPdfDiagnostics = pdfExtractionDiagnostics(await fixture("pdf/scanned-image-only.pdf.txt"));
assert.equal(scannedPdfDiagnostics.status, "scanned-or-compressed");
assert.equal(scannedPdfDiagnostics.hasImageXObject, true);
assert.equal(scannedPdfDiagnostics.hasCompressedStream, true);
assert.equal(scannedPdfDiagnostics.noCloudOcrUsed, true);
const scannedPdfSidecarText = textFromScannedPdfWithLocalOcr(
  await fixture("pdf/scanned-image-only.pdf.txt"),
  await fixture("ocr/scanned-receipt.local-ocr.txt"),
);
assert.match(scannedPdfSidecarText, /PDF local OCR sidecar note/);
assert.match(scannedPdfSidecarText, /No cloud OCR was used/);
assert.equal(parseReceiptText(scannedPdfSidecarText).merchant, "Fixture OCR Market");
const ocrResultFixture = parseReceiptText(await fixture("ocr/scanned-receipt.local-ocr.txt"));
assert.equal(ocrResultFixture.merchant, "Fixture OCR Market");
assert.equal(ocrResultFixture.purchaseDate, "2026-06-02");
assert.equal(ocrResultFixture.total, 75.87);
assert.equal(ocrResultFixture.items.length, 2);
assert.equal(localOcrEnginePlan({}).engine, "manual-fallback");
assert.equal(localOcrEnginePlan({ TextDetector: function TextDetector() {} }).engine, "browser-text-detector");
assert.equal(localOcrEnginePlan({ ReturnWarrantyGuardianOcrWorker: function worker() {} }).engine, "bundled-worker");
const bundledOcrText = await textFromImageSource("synthetic-image", {
  ReturnWarrantyGuardianOcrWorker: async () => "Bundled OCR Fixture Store\nReceipt 12.00",
});
assert.match(bundledOcrText, /Bundled OCR Fixture Store/);
const svgOcrFixture = await fixture("ocr/scanned-receipt.local-ocr.svg");
const svgOcrFile = new File([svgOcrFixture], "scanned-receipt.local-ocr.svg", { type: "image/svg+xml" });
assert.equal(bundledLocalOcrWorkerSupports(svgOcrFile), true);
const svgOcrText = await textFromImageSource(svgOcrFile, localOcrEnvironment(globalThis, svgOcrFile));
assert.match(svgOcrText, /Fixture SVG OCR Market/);
assert.equal(parseReceiptText(svgOcrText).total, 42.6);
assert.equal(await bundledLocalOcrWorker(svgOcrFile), svgOcrText);
const templateOcrPbm = renderBundledOcrPbm(`PUBLIC MART
2026-06-03
FILTER 19.99
LAMP 42.50
TOTAL 62.49`);
const templateOcrFile = new File([templateOcrPbm], "public-receipt.pbm", { type: "image/x-portable-bitmap" });
assert.equal(bundledLocalOcrWorkerSupports(templateOcrFile), true);
const templateOcrText = await textFromImageSource(templateOcrFile, localOcrEnvironment(globalThis, templateOcrFile));
assert.match(templateOcrText, /PUBLIC MART/);
assert.equal(parseReceiptText(templateOcrText).merchant, "PUBLIC MART");
assert.equal(parseReceiptText(templateOcrText).total, 62.49);
const scannedPdfWithEmbeddedBitmap = `%PDF-1.4
1 0 obj
<< /Subtype /Image /Filter /DCTDecode /Width 1 /Height 1 >>
stream
${templateOcrPbm}
endstream
endobj`;
assert.match(embeddedBundledOcrBitmapFromPdf(scannedPdfWithEmbeddedBitmap), /^P1/);
const bundledPdfOcrText = await textFromScannedPdfWithBundledOcr(scannedPdfWithEmbeddedBitmap);
assert.match(bundledPdfOcrText, /PDF bundled OCR note/);
assert.match(bundledPdfOcrText, /No cloud OCR was used/);
assert.equal(parseReceiptText(bundledPdfOcrText).merchant, "PUBLIC MART");
assert.equal(parseReceiptText(bundledPdfOcrText).total, 62.49);
const ocrEngineManifest = JSON.parse(await fixture("ocr/engine-manifest.json"));
assert.equal(ocrEngineManifest.schema, "return-warranty-guardian.local-ocr-engine-manifest.v1");
assert.ok(ocrEngineManifest.engines.every((engine) => engine.networkAccess === "none"));
assert.ok(ocrEngineManifest.engines.some((engine) => engine.id === "bundled-svg-fixture-worker"));
assert.ok(ocrEngineManifest.engines.some((engine) => engine.id === "bundled-template-pbm-worker" && engine.status === "available"));

const policyTemplate = policyTemplateById("extended-60-day-return");
assert.equal(policyTemplate.returnWindowDays, 60);
assert.match(policyTemplate.note, /Confirm current merchant terms/);
assert.match(policyTemplateReviewNote(policyTemplate), /Evidence to verify/);
const policyFixtures = JSON.parse(await fixture("policies/templates.json"));
for (const item of policyFixtures) {
  const template = policyTemplateById(item.id);
  assert.equal(template.returnWindowDays, item.expectedReturnWindowDays);
  assert.equal(template.refundWindowDays, item.expectedRefundWindowDays);
  assert.equal(template.warrantyMonths, item.expectedWarrantyMonths);
  assert.equal(template.country, item.expectedCountry);
  assert.equal(template.sourceType, item.expectedSourceType);
  assert.equal(template.sourceLicense, item.expectedSourceLicense);
  assert.match(template.sourceUrl, /^https:\/\/example\.test\//);
  assert.equal(template.version, item.expectedVersion);
  assert.match(template.lastReviewed, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(template.evidenceRequired.length >= 3);
  assert.ok(template.disclaimer.length > 40);
}

const claimPacket = claimPacketHtml(purchase, now);
assert.match(claimPacket, /Claim Packet: Wireless Headset/);
assert.match(claimPacket, /Print or save PDF/);
assert.match(claimPacket, /PDF Save Guide/);
assert.match(claimPacket, /Chrome\/Chromium/);
assert.match(claimPacket, /Claim Profile/);
assert.match(claimPacket, /Attachment Export Review/);
assert.match(claimPacket, /Attachment Manifest/);
assert.match(claimPacket, /warranty-card\.pdf/);
assert.match(claimPacket, /data:image\/png/);
assert.match(claimPacket, /Submission Note/);
assert.match(claimPacket, /Submission Templates/);
assert.match(claimPacket, /Merchant Return Request/);

const templates = claimSubmissionTemplates(purchase, now);
assert.equal(templates.length, 4);
assert.equal(templates.map((template) => template.id).join(","), "merchant-return,warranty-support,chargeback-summary,repair-intake");
assert.match(templates[1].body, /support@example\.test/);
assert.match(templates[1].body, /Claim profile/);
assert.match(templates[3].body, /Home office/);
assert.equal(claimPacketProfile(purchase).templateProfile, "custom-user-reviewed");
assert.match(browserPdfSaveGuide("Firefox"), /Firefox/);
assert.equal(attachmentExportReview(purchase.attachments).largeFileCount, 0);

const claimBundle = JSON.parse(claimPacketBundleJson(purchase, now));
assert.equal(claimBundle.schema, "return-warranty-guardian.claim-bundle.v1");
assert.match(claimBundle.claimPacketHtml, /Claim Packet: Wireless Headset/);
assert.equal(claimBundle.submissionTemplates.length, 4);
assert.equal(claimBundle.claimProfile.templateProfile, "custom-user-reviewed");
assert.equal(claimBundle.attachmentExportReview.totalFiles, 2);
assert.equal(claimBundle.attachmentManifest.length, 2);
assert.equal(claimBundle.attachmentManifest[0].exportPath, "attachments/01-warranty-card.pdf");
assert.equal(claimBundle.attachments.length, 2);
const claimZip = claimPacketZipBytes(purchase, now);
assert.deepEqual([...claimZip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
assert.match(new TextDecoder().decode(claimZip), /claim-packet\.html/);
assert.match(new TextDecoder().decode(claimZip), /claim-bundle\.json/);
assert.match(new TextDecoder().decode(claimZip), /attachment-manifest\.json/);
assert.match(new TextDecoder().decode(claimZip), /attachment-export-review\.json/);
assert.match(new TextDecoder().decode(claimZip), /templates\/merchant-return\.txt/);

const ics = purchasesToIcs([purchase], now);
assert.match(ics, /BEGIN:VCALENDAR/);
assert.match(ics, /SUMMARY:Return deadline: Wireless Headset/);
assert.match(ics, /DTSTART;VALUE=DATE:20260702/);
assert.match(ics, /BEGIN:VALARM/);
assert.match(ics, /TRIGGER:-P5D/);
assert.match(ics, /TRIGGER:-P1D/);
assert.deepEqual(reminderAlarmOffsets(purchase), ["-P5D", "-P1D"]);

const selfHosted = JSON.parse(
  selfHostedNotificationPayload([purchase], now, {
    enabled: true,
    provider: "ntfy",
    endpoint: "https://alerts.example.test",
    topic: "returns",
  }),
);
assert.equal(selfHosted.schema, "return-warranty-guardian.self-hosted-notifications.v1");
assert.match(selfHosted.privacyNote, /No data is sent/);
assert.equal(selfHosted.settings.enabled, true);
assert.equal(selfHosted.settings.tokenStored, false);
assert.equal(selfHosted.reminders.length, 3);
assert.match(selfHosted.providers.ntfy.curl, /alerts\.example\.test\/returns/);
assert.equal(selfHosted.dryRun.requiresExternalRunner, true);
assert.equal(selfHosted.dryRun.appSendsNetworkRequests, false);
const dryRunReport = JSON.parse(
  selfHostedDryRunReport([purchase], now, {
    enabled: true,
    provider: "gotify",
    endpoint: "https://gotify.example.test",
    topic: "",
  }),
);
assert.equal(dryRunReport.schema, "return-warranty-guardian.self-hosted-dry-run.v1");
assert.equal(dryRunReport.dryRun.provider, "gotify");
assert.match(dryRunReport.dryRun.warnings.join(" "), /tokens are not stored/);
assert.equal(dryRunReport.externalRunnerPlan.mode, "user-managed");
const runnerPayload = JSON.parse(
  selfHostedNotificationPayload([purchase], now, {
    enabled: true,
    provider: "ntfy",
    endpoint: "https://alerts.example.test",
    topic: "returns",
  }),
);
const runnerPlan = buildRunnerPlan(runnerPayload, { limit: 2, checkEndpoint: true });
assert.equal(runnerPlan.schema, "return-warranty-guardian.self-hosted-runner-plan.v1");
assert.equal(runnerPlan.plannedCount, 2);
assert.equal(runnerPlan.endpointCheck.sendsPurchaseData, false);
assert.equal(runnerPlan.schedulerRecipes.provider, "ntfy");
assert.match(runnerPlan.schedulerRecipes.linuxCron, /self-hosted-notification-runner/);
assert.match(runnerPlan.commands[0].command, /alerts\.example\.test\/returns/);
const recipes = schedulerRecipes(runnerPayload, { provider: "gotify", payloadPath: "/tmp/rwg-payload.json", limit: 1 });
assert.match(recipes.macosLaunchd, /gotify/);
assert.match(recipes.windowsTaskScheduler, /ReturnWarrantyGuardianNotify/);
assert.equal(recipes.sendsPurchaseDataDuringEndpointCheck, false);
const refusedSendPlan = buildRunnerPlan(runnerPayload, { limit: 1, send: true, yes: false });
assert.equal(refusedSendPlan.sendRequested, true);
assert.equal(refusedSendPlan.sendAllowed, false);
assert.match(refusedSendPlan.warnings.join(" "), /Sending requires --yes/);
const tempDir = await mkdtemp(join(tmpdir(), "rwg-runner-"));
const payloadPath = join(tempDir, "payload.json");
await writeFile(payloadPath, JSON.stringify(runnerPayload, null, 2));
const { stdout: runnerStdout } = await execFileAsync(process.execPath, [
  "scripts/self-hosted-notification-runner.mjs",
  payloadPath,
  "--limit",
  "1",
  "--json",
]);
const cliPlan = JSON.parse(runnerStdout);
assert.equal(cliPlan.plannedCount, 1);
assert.equal(cliPlan.appSendsNetworkRequests, false);
const smokeRecord = notificationSmokeRecord(
  {
    requestCount: 2,
    ntfy: { status: 204 },
    gotify: { status: 204 },
    publicSmoke: { skipped: false, provider: "ntfy", endpointHost: "ntfy.example.test", result: { ok: true, status: 200 } },
    purchaseDataSentOnlyDuringExplicitSend: true,
  },
  now,
);
assert.equal(smokeRecord.schema, "return-warranty-guardian.notification-smoke-record.v1");
assert.equal(smokeRecord.publicSmoke.provider, "ntfy");
assert.match(smokeRecord.publicSmoke.endpointHostHash, /^[a-f0-9]{64}$/);
assert.equal(JSON.stringify(smokeRecord).includes("ntfy.example.test"), false);
const smokePolicy = JSON.parse(await fixture("notifications/smoke-policy.json"));
assert.equal(smokePolicy.schema, "return-warranty-guardian.notification-smoke-policy.v1");
assert.ok(smokePolicy.maxRecordAgeDays >= 30);
assert.ok(smokePolicy.requiredProviders.includes("ntfy"));
const workflowText = await readFile(new URL("../.github/workflows/notification-smoke.yml", import.meta.url), "utf8");
assert.match(workflowText, /rwg-notification-smoke\/raw\/raw-smoke\.json/);
assert.match(workflowText, /rwg-notification-smoke\/records\/sanitized-smoke-record\.json/);
assert.match(workflowText, /notify:ops-report -- "\$RUNNER_TEMP\/rwg-notification-smoke\/records"/);
const readiness = notificationSmokeReadiness({
  env: {
    RWG_NOTIFY_PUBLIC_SMOKE: "1",
    RWG_NOTIFY_PUBLIC_PROVIDER: "ntfy",
    RWG_NOTIFY_PUBLIC_ENDPOINT: "https://ntfy.example.test",
    RWG_NOTIFY_PUBLIC_TOPIC: "returns",
  },
  workflowText,
  policy: smokePolicy,
  now,
});
assert.equal(readiness.schema, "return-warranty-guardian.notification-smoke-readiness.v1");
assert.equal(readiness.ok, true);
assert.match(readiness.endpoint.hostHash, /^[a-f0-9]{64}$/);
assert.equal(JSON.stringify(readiness).includes("ntfy.example.test"), false);
const smokeValidation = validateNotificationSmokeRecord(smokeRecord, smokePolicy, { now });
assert.equal(smokeValidation.ok, true);
const smokeRecordAudit = await auditNotificationSmokeRecords(
  new URL("./fixtures/notifications/smoke-records", import.meta.url).pathname,
  smokePolicy,
  { now },
);
assert.equal(smokeRecordAudit.schema, "return-warranty-guardian.notification-smoke-record-audit.v1");
assert.equal(smokeRecordAudit.ok, true);
assert.equal(smokeRecordAudit.freshSuccessfulProviders.includes("ntfy"), true);
assert.equal(JSON.stringify(smokeRecordAudit).includes("https://"), false);
const smokeOpsReport = notificationSmokeOpsReportMarkdown(smokeRecordAudit);
assert.match(smokeOpsReport, /Notification Smoke Operations Report/);
assert.match(smokeOpsReport, /Status: PASS/);
assert.match(smokeOpsReport, /Fresh successful providers: ntfy/);
assert.equal(/https?:\/\//i.test(smokeOpsReport), false);
for (const provider of ["ntfy", "gotify", "apprise"]) {
  const providerPayload = JSON.parse(await fixture(`notifications/${provider}-payload.json`));
  const providerPlan = buildRunnerPlan(providerPayload, { provider, limit: 1, checkEndpoint: true });
  assert.equal(providerPlan.provider, provider);
  assert.equal(providerPlan.plannedCount, 1);
  assert.equal(providerPlan.endpointCheck.sendsPurchaseData, false);
  assert.equal(providerPlan.appSendsNetworkRequests, false);
  assert.match(providerPlan.endpointCheck.url, /example\.test/);
}
const { stdout: fixtureStdout } = await execFileAsync(process.execPath, ["scripts/validate-fixtures.mjs"]);
assert.match(fixtureStdout, /Fixture validation passed/);
const tempSmokeRecordPath = join(tempDir, "smoke-record.json");
await writeFile(tempSmokeRecordPath, JSON.stringify(smokeRecord, null, 2));
const { stdout: smokeRecordValidationStdout } = await execFileAsync(process.execPath, [
  "scripts/validate-notification-smoke-record.mjs",
  tempSmokeRecordPath,
]);
assert.match(smokeRecordValidationStdout, /notification-smoke-record-validation/);
const { stdout: readinessStdout } = await execFileAsync(process.execPath, ["scripts/notification-smoke-readiness.mjs", "--strict"], {
  env: {
    ...process.env,
    RWG_NOTIFY_PUBLIC_SMOKE: "1",
    RWG_NOTIFY_PUBLIC_PROVIDER: "ntfy",
    RWG_NOTIFY_PUBLIC_ENDPOINT: "https://ntfy.example.test",
    RWG_NOTIFY_PUBLIC_TOPIC: "returns",
  },
});
const readinessCli = JSON.parse(readinessStdout);
assert.equal(readinessCli.ok, true);
assert.equal(JSON.stringify(readinessCli).includes("ntfy.example.test"), false);
const { stdout: auditStdout } = await execFileAsync(process.execPath, [
  "scripts/audit-notification-smoke-records.mjs",
  "tests/fixtures/notifications/smoke-records",
  "tests/fixtures/notifications/smoke-policy.json",
]);
const auditCli = JSON.parse(auditStdout);
assert.equal(auditCli.ok, true);
assert.equal(auditCli.freshSuccessfulProviders.includes("ntfy"), true);
const { stdout: opsReportStdout } = await execFileAsync(process.execPath, [
  "scripts/notification-smoke-ops-report.mjs",
  "tests/fixtures/notifications/smoke-records",
  "tests/fixtures/notifications/smoke-policy.json",
]);
assert.match(opsReportStdout, /Notification Smoke Operations Report/);
assert.match(opsReportStdout, /Status: PASS/);
assert.equal(/https?:\/\//i.test(opsReportStdout), false);
const anonymizeDir = await mkdtemp(join(tmpdir(), "rwg-anonymize-"));
const privateSamplePath = join(anonymizeDir, "private-sample.csv");
await writeFile(
  privateSamplePath,
  `date,merchant,amount,email,order
2026-06-02,Private Store,42.00,buyer@example.com,ORDER ABCD1234`,
);
const { stdout: anonymizeStdout } = await execFileAsync(process.execPath, ["scripts/anonymize-fixture.mjs", privateSamplePath, anonymizeDir]);
const anonymizeResult = JSON.parse(anonymizeStdout);
assert.match(await readFile(anonymizeResult.sanitizedFixturePath, "utf8"), /user@example\.test/);
const anonymizeReport = JSON.parse(await readFile(anonymizeResult.reportPath, "utf8"));
assert.equal(anonymizeReport.schema, "return-warranty-guardian.fixture-anonymize-report.v1");
assert.ok(anonymizeReport.redacted >= 2);
const intakeDraft = JSON.parse(await readFile(anonymizeResult.intakeDraftPath, "utf8"));
assert.equal(intakeDraft.anonymized, true);
assert.equal(intakeDraft.provenance.origin, "anonymized-community");
assert.equal(intakeDraft.provenance.rawSampleRetained, false);
assert.equal(intakeDraft.review.piiChecked, false);
const reviewedFixturePath = join(anonymizeDir, "csv", "reviewed-sample.csv");
await mkdir(join(anonymizeDir, "csv"), { recursive: true });
await writeFile(
  reviewedFixturePath,
  `date,merchant,amount
2026-06-02,Reviewed Sample Store,42.00`,
);
const reviewedEntryPath = join(anonymizeDir, "reviewed-entry.json");
await writeFile(
  reviewedEntryPath,
  JSON.stringify(
    {
      ...intakeDraft,
      id: "reviewed-community-sample",
      fixturePath: "csv/reviewed-sample.csv",
      sourceKind: "payment-receipt-shape",
      provenance: {
        ...intakeDraft.provenance,
        permission: "sanitized sample shared for parser regression",
        contributorHandle: "community-reviewer",
      },
      review: {
        piiChecked: true,
        parserChecked: true,
        reviewedAt: "2026-06-02",
        reviewer: "fixture-reviewer",
      },
    },
    null,
    2,
  ),
);
const { stdout: reviewSampleStdout } = await execFileAsync(process.execPath, [
  "scripts/review-sample-intake.mjs",
  reviewedEntryPath,
  anonymizeDir,
]);
const reviewSampleResult = JSON.parse(reviewSampleStdout);
assert.equal(reviewSampleResult.schema, "return-warranty-guardian.sample-intake-review.v1");
assert.equal(reviewSampleResult.ok, true);
assert.equal(reviewSampleResult.parserResult.validRows, 1);
const batchEntryDir = join(anonymizeDir, "entries");
await mkdir(batchEntryDir, { recursive: true });
await writeFile(join(batchEntryDir, "reviewed-entry.json"), await readFile(reviewedEntryPath, "utf8"));
const { stdout: batchReviewStdout } = await execFileAsync(process.execPath, [
  "scripts/review-sample-batch.mjs",
  batchEntryDir,
  anonymizeDir,
]);
const batchReview = JSON.parse(batchReviewStdout);
assert.equal(batchReview.schema, "return-warranty-guardian.sample-intake-batch-review.v1");
assert.equal(batchReview.ok, true);
assert.equal(batchReview.acceptedCount, 1);
assert.equal(batchReview.acceptedEntries[0].id, "reviewed-community-sample");
const sampleManifest = JSON.parse(await fixture("intake/sample-intake.json"));
const sampleCoverage = sampleIntakeCoverageReport(sampleManifest, now);
assert.equal(sampleCoverage.schema, "return-warranty-guardian.sample-intake-coverage-report.v1");
assert.equal(sampleCoverage.ok, true);
assert.equal(sampleCoverage.communityReady, true);
assert.equal(sampleCoverage.countsByType.csv, 5);
assert.equal(sampleCoverage.countsByType["ocr-text"], 2);
assert.equal(sampleCoverage.countsByOrigin["public-open-license"], 1);
const sampleCoverageMarkdown = sampleIntakeCoverageMarkdown(sampleCoverage);
assert.match(sampleCoverageMarkdown, /Sample Intake Coverage Report/);
assert.match(sampleCoverageMarkdown, /Community sample status: READY/);
const requestPack = sampleRequestPack(sampleManifest, now);
assert.equal(requestPack.schema, "return-warranty-guardian.sample-request-pack.v1");
assert.equal(requestPack.communitySampleStatus, "READY");
assert.match(JSON.stringify(requestPack.intakeEntryTemplate), /rawSampleRetained/);
const requestPackMarkdown = sampleRequestPackMarkdown(requestPack);
assert.match(requestPackMarkdown, /Sample Request Pack/);
assert.match(requestPackMarkdown, /Community sample status: READY/);
assert.match(requestPackMarkdown, /fixture:anonymize/);
assert.match(requestPackMarkdown, /rawSampleRetained=false/);
assert.match(requestPackMarkdown, /card-statement-shape/);
const { stdout: sampleCoverageStdout } = await execFileAsync(process.execPath, [
  "scripts/sample-intake-coverage-report.mjs",
  "tests/fixtures/intake/sample-intake.json",
]);
assert.match(sampleCoverageStdout, /Coverage status: PASS/);
assert.match(sampleCoverageStdout, /Community sample status: READY/);
const { stdout: requestPackStdout } = await execFileAsync(process.execPath, [
  "scripts/sample-request-pack.mjs",
  "tests/fixtures/intake/sample-intake.json",
]);
assert.match(requestPackStdout, /Sample Request Pack/);
assert.match(requestPackStdout, /Maintainer Gate/);
const releaseReport = releaseReadinessReport(sampleManifest, now, { notificationSmokeAudit: smokeRecordAudit, ocrEngineManifest, encryptedBackupAvailable: true });
assert.equal(releaseReport.schema, "return-warranty-guardian.release-readiness-report.v1");
assert.equal(releaseReport.remainingItems.length, 0);
assert.doesNotMatch(releaseReport.remainingItems.join("\n"), /Actual bundled cross-browser OCR engine/);
assert.doesNotMatch(releaseReport.remainingItems.join("\n"), /Actual anonymized-community or public-open-license/);
assert.doesNotMatch(releaseReport.remainingItems.join("\n"), /recurring public\/self-hosted endpoint smoke/);
const releaseMarkdown = releaseReadinessMarkdown(releaseReport);
assert.match(releaseMarkdown, /Release Readiness Report/);
assert.match(releaseMarkdown, /Recurring public smoke configured/);
assert.match(releaseMarkdown, /Bundled OCR automation available/);
assert.match(releaseMarkdown, /Encrypted backup and recovery/);
assert.match(releaseMarkdown, /Available/);
assert.match(releaseMarkdown, /Community-ready/);
assert.match(releaseMarkdown, /No numbered follow-up items remain/);
const { stdout: releaseStdout } = await execFileAsync(process.execPath, [
  "scripts/release-readiness-report.mjs",
  "tests/fixtures/intake/sample-intake.json",
]);
assert.match(releaseStdout, /Release Readiness Report/);
assert.match(releaseStdout, /Recurring public smoke configured/);
assert.match(releaseStdout, /Bundled OCR automation available/);
assert.match(releaseStdout, /Encrypted backup and recovery/);
assert.match(releaseStdout, /Available/);
assert.match(releaseStdout, /No numbered follow-up items remain/);
const { stdout: strictCoverageStdout } = await execFileAsync(process.execPath, [
  "scripts/sample-intake-coverage-report.mjs",
  "--strict-community",
  "tests/fixtures/intake/sample-intake.json",
]);
assert.match(strictCoverageStdout, /Community sample status: READY/);

console.log("All logic tests passed.");
