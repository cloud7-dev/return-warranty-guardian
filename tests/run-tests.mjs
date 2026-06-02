import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { addDays, addMonths, computeDeadlines, daysUntil, summarizePurchases } from "../src/deadline-engine.js";
import { sanitizeFixtureFilename, sanitizeFixtureText } from "../src/fixture-sanitizer.js";
import { buildRunnerPlan, schedulerRecipes } from "../scripts/self-hosted-notification-runner.mjs";
import { notificationSmokeRecord } from "../scripts/record-notification-smoke-result.mjs";
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
  localOcrEnginePlan,
  pdfExtractionDiagnostics,
  pdfExtractionStatus,
  textFromHtmlSource,
  textFromImageSource,
  textFromPdfSource,
  textFromScannedPdfWithLocalOcr,
} from "../src/local-extraction.js";
import { bundledLocalOcrWorker, bundledLocalOcrWorkerSupports, localOcrEnvironment } from "../src/local-ocr-worker.js";
import { policyTemplateById, policyTemplateReviewNote } from "../src/policy-templates.js";
import { parseReceiptText } from "../src/receipt-parser.js";
import {
  claimPacketBundleJson,
  claimPacketHtml,
  claimPacketZipBytes,
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
assert.match(templates[3].body, /Home office/);

const claimBundle = JSON.parse(claimPacketBundleJson(purchase, now));
assert.equal(claimBundle.schema, "return-warranty-guardian.claim-bundle.v1");
assert.match(claimBundle.claimPacketHtml, /Claim Packet: Wireless Headset/);
assert.equal(claimBundle.submissionTemplates.length, 4);
assert.equal(claimBundle.attachmentManifest.length, 2);
assert.equal(claimBundle.attachmentManifest[0].exportPath, "attachments/01-warranty-card.pdf");
assert.equal(claimBundle.attachments.length, 2);
const claimZip = claimPacketZipBytes(purchase, now);
assert.deepEqual([...claimZip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
assert.match(new TextDecoder().decode(claimZip), /claim-packet\.html/);
assert.match(new TextDecoder().decode(claimZip), /claim-bundle\.json/);
assert.match(new TextDecoder().decode(claimZip), /attachment-manifest\.json/);
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

console.log("All logic tests passed.");
