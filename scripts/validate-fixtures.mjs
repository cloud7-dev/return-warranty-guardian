import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pdfExtractionDiagnostics, textFromPdfSource } from "../src/local-extraction.js";
import { CSV_IMPORT_PRESETS, analyzeCsvImport, csvMappingForPreset, csvPresetBundle, csvPresetBundleFingerprint, csvPresetBundleReviewSummary } from "../src/importers.js";
import { policyTemplateById } from "../src/policy-templates.js";
import { parseReceiptText } from "../src/receipt-parser.js";
import { buildRunnerPlan } from "./self-hosted-notification-runner.mjs";

const root = path.resolve("tests/fixtures");
const piiPatterns = [
  { name: "email outside .test", pattern: /\b[A-Z0-9._%+-]+@(?!example\.test\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: "card-like number", pattern: /\b(?:\d[ -]?){13,19}\b/ },
  { name: "Korean mobile number", pattern: /\b010[- ]?\d{3,4}[- ]?\d{4}\b/ },
];

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
    }),
  );
  return files.flat();
}

function assertNoPrivateData(file, text) {
  for (const item of piiPatterns) {
    if (item.pattern.test(text)) throw new Error(`${file} contains possible private data: ${item.name}`);
  }
}

async function validateCsvFixtures() {
  const csvDir = path.join(root, "csv");
  const files = (await listFiles(csvDir)).filter((file) => file.endsWith(".csv"));
  if (files.length < 5) throw new Error("Expected at least five CSV fixtures.");
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assertNoPrivateData(file, text);
    const headerLine = text.split(/\r?\n/)[0] || "";
    const headers = headerLine.split(",").map((value) => value.replaceAll('"', "").trim().toLowerCase().replace(/[\s-]+/g, "_"));
    const preset =
      [...CSV_IMPORT_PRESETS]
        .filter((item) => item.id !== "auto")
        .sort((a, b) => b.id.length - a.id.length)
        .find((item) => file.includes(item.id)) || CSV_IMPORT_PRESETS.find((item) => item.id !== "auto");
    const mapping = csvMappingForPreset(headers, preset?.id || "auto");
    const preview = analyzeCsvImport(text, [], new Date("2026-06-02T10:00:00Z"), { presetId: preset?.id || "auto", mapping });
    if (!preview.valid.length) throw new Error(`${file} did not produce an importable row.`);
  }
}

async function validateSampleIntakeManifest() {
  const manifestPath = path.join(root, "intake/sample-intake.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== "return-warranty-guardian.sample-intake.v1") {
    throw new Error("Sample intake manifest has unsupported schema.");
  }
  for (const entry of manifest.entries || []) {
    if (!entry.anonymized) throw new Error(`${entry.id} must be marked anonymized.`);
    if (!entry.fixturePath) throw new Error(`${entry.id} is missing fixturePath.`);
    if (!["csv", "ocr-text", "pdf-text", "policy"].includes(entry.type)) throw new Error(`${entry.id} has unsupported type.`);
    if (!entry.review?.piiChecked || !entry.review?.parserChecked) throw new Error(`${entry.id} must include piiChecked and parserChecked review flags.`);
    const fixturePath = path.join(root, entry.fixturePath);
    const text = await readFile(fixturePath, "utf8");
    assertNoPrivateData(fixturePath, text);
  }
}

async function validatePdfFixtures() {
  const pdfDir = path.join(root, "pdf");
  const files = (await listFiles(pdfDir)).filter((file) => file.endsWith(".txt"));
  const statuses = new Set();
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const diagnostics = pdfExtractionDiagnostics(text);
    statuses.add(diagnostics.status);
    if (!diagnostics.noCloudOcrUsed) throw new Error(`${file} must not use cloud OCR.`);
    if (diagnostics.status === "scanned-or-compressed") {
      const extracted = textFromPdfSource(text);
      if (!/No cloud OCR was used/.test(extracted)) throw new Error(`${file} scanned fallback must state that no cloud OCR was used.`);
    }
  }
  if (!statuses.has("text-operator")) throw new Error("Expected at least one PDF text-operator fixture.");
  if (!statuses.has("scanned-or-compressed")) throw new Error("Expected at least one scanned/compressed PDF fallback fixture.");
}

async function validatePolicyFixtures() {
  const fixturePath = path.join(root, "policies/templates.json");
  const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
  for (const item of fixtures) {
    const template = policyTemplateById(item.id);
    if (!template) throw new Error(`Missing policy template: ${item.id}`);
    if (template.sourceLicense !== item.expectedSourceLicense) throw new Error(`${item.id} source license mismatch.`);
    if (!/^https:\/\/example\.test\//.test(template.sourceUrl || "")) throw new Error(`${item.id} must use a synthetic example.test source URL.`);
    if (!template.lastReviewed || !template.version) throw new Error(`${item.id} missing review metadata.`);
  }
}

async function validateOcrResultFixtures() {
  const manifestPath = path.join(root, "ocr/results.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== "return-warranty-guardian.ocr-result-fixtures.v1") {
    throw new Error("OCR result fixture manifest has unsupported schema.");
  }
  for (const item of manifest.fixtures || []) {
    const fixturePath = path.join(root, item.path);
    const text = await readFile(fixturePath, "utf8");
    assertNoPrivateData(fixturePath, text);
    const parsed = parseReceiptText(text);
    if (parsed.merchant !== item.expectedMerchant) throw new Error(`${item.path} merchant mismatch.`);
    if (parsed.purchaseDate !== item.expectedPurchaseDate) throw new Error(`${item.path} purchase date mismatch.`);
    if (parsed.items.length < Number(item.expectedMinItems || 1)) throw new Error(`${item.path} did not produce enough receipt items.`);
    if (!parsed.items.some((receiptItem) => receiptItem.name === item.expectedItem)) throw new Error(`${item.path} missing expected item.`);
    if (parsed.total !== Number(item.expectedTotal || 0)) throw new Error(`${item.path} total mismatch.`);
  }
}

async function validateNotificationFixtures() {
  const notificationDir = path.join(root, "notifications");
  const files = (await listFiles(notificationDir)).filter((file) => file.endsWith(".json"));
  const providers = new Set();
  for (const file of files) {
    if (file.includes(`${path.sep}smoke-records${path.sep}`)) continue;
    const payload = JSON.parse(await readFile(file, "utf8"));
    const expectedProvider = payload.expectedRunner?.provider || payload.settings?.provider;
    const plan = buildRunnerPlan(payload, {
      provider: expectedProvider,
      limit: payload.expectedRunner?.plannedCount || 1,
      checkEndpoint: true,
    });
    providers.add(plan.provider);
    if (plan.endpointCheck.sendsPurchaseData) throw new Error(`${file} endpoint check must not send purchase data.`);
    if (plan.appSendsNetworkRequests) throw new Error(`${file} dry-run plan must not send network requests.`);
    if (plan.plannedCount !== payload.expectedRunner?.plannedCount) throw new Error(`${file} planned reminder count mismatch.`);
    if (!plan.endpointCheck.url.includes("example.test")) throw new Error(`${file} must use a synthetic example.test endpoint.`);
  }
  for (const provider of ["ntfy", "gotify", "apprise"]) {
    if (!providers.has(provider)) throw new Error(`Missing notification fixture for ${provider}.`);
  }
}

async function validateNotificationSmokeRecords() {
  const recordDir = path.join(root, "notifications/smoke-records");
  const files = (await listFiles(recordDir)).filter((file) => file.endsWith(".json"));
  if (!files.length) throw new Error("Expected at least one notification smoke record fixture.");
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assertNoPrivateData(file, text);
    if (/https?:\/\//i.test(text)) throw new Error(`${file} must not store raw endpoint URLs.`);
    if (/token|bearer|authorization/i.test(text.replace(/"privacyNote"\s*:\s*"[^"]+"/g, ""))) {
      throw new Error(`${file} must not store token or authorization data.`);
    }
    const record = JSON.parse(text);
    if (record.schema !== "return-warranty-guardian.notification-smoke-record.v1") {
      throw new Error(`${file} has unsupported smoke record schema.`);
    }
    if (!/^[a-f0-9]{64}$/.test(record.publicSmoke?.endpointHostHash || "")) {
      throw new Error(`${file} must store a SHA-256 endpoint host hash.`);
    }
    if (!record.loopback?.purchaseDataSentOnlyDuringExplicitSend) {
      throw new Error(`${file} must confirm purchase data is only sent during explicit send.`);
    }
  }
}

async function validatePresetReviewFixtures() {
  const fixturePath = path.join(root, "presets/review-manifest.json");
  const manifest = JSON.parse(await readFile(fixturePath, "utf8"));
  if (manifest.schema !== "return-warranty-guardian.csv-preset-review-manifest.v1") {
    throw new Error("Preset review manifest has unsupported schema.");
  }
  const bundle = JSON.parse(
    csvPresetBundle(
      [
        {
          id: "fixture-reviewed-shopify",
          label: "Fixture reviewed Shopify",
          mapping: { productName: "lineitem_name", merchant: "vendor", purchaseDate: "created_at", price: "lineitem_price" },
          source: "fixture-review",
          reviewedAt: "2026-06-02",
          fixtureCoverage: manifest.fixtureCoverage,
        },
      ],
      new Date("2026-06-02T10:00:00Z"),
    ),
  );
  const fingerprint = await csvPresetBundleFingerprint(bundle);
  const summary = await csvPresetBundleReviewSummary({ ...bundle, fingerprint }, { ...manifest, fingerprint });
  if (!summary.ok) throw new Error(`Preset review manifest failed: ${summary.issues.join("; ")}`);
}

async function main() {
  const files = await listFiles(root);
  for (const file of files) {
    assertNoPrivateData(file, await readFile(file, "utf8"));
  }
  await validateCsvFixtures();
  await validateSampleIntakeManifest();
  await validatePdfFixtures();
  await validateOcrResultFixtures();
  await validatePolicyFixtures();
  await validateNotificationFixtures();
  await validateNotificationSmokeRecords();
  await validatePresetReviewFixtures();
  console.log("Fixture validation passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
