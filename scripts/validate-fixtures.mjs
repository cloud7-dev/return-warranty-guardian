import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pdfExtractionDiagnostics, textFromPdfSource } from "../src/local-extraction.js";
import { bundledLocalOcrWorker, bundledLocalOcrWorkerSupports } from "../src/local-ocr-worker.js";
import {
  CSV_IMPORT_PRESETS,
  analyzeCsvImport,
  csvMappingForPreset,
  csvPresetBundle,
  csvPresetBundleFingerprint,
  csvPresetBundleReviewSummary,
  verifyCsvPresetBundleDetachedSignatures,
  verifyCsvPresetBundleFingerprint,
} from "../src/importers.js";
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
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const ids = new Set();
  const fixturePaths = new Set();
  const sourceKinds = new Set();
  const countsByType = new Map();
  for (const entry of entries) {
    if (!entry.id) throw new Error("Sample intake entry is missing id.");
    if (ids.has(entry.id)) throw new Error(`Duplicate sample intake id: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.anonymized) throw new Error(`${entry.id} must be marked anonymized.`);
    if (!entry.fixturePath) throw new Error(`${entry.id} is missing fixturePath.`);
    if (path.isAbsolute(entry.fixturePath) || entry.fixturePath.split(/[\\/]/).includes("..")) {
      throw new Error(`${entry.id} must use a relative fixturePath inside tests/fixtures.`);
    }
    if (!["csv", "ocr-text", "ocr-image", "pdf-text", "policy"].includes(entry.type)) throw new Error(`${entry.id} has unsupported type.`);
    if (!entry.sourceKind) throw new Error(`${entry.id} is missing sourceKind.`);
    if (!entry.review?.piiChecked || !entry.review?.parserChecked) throw new Error(`${entry.id} must include piiChecked and parserChecked review flags.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.review?.reviewedAt || "")) throw new Error(`${entry.id} must include reviewedAt as YYYY-MM-DD.`);
    if (!entry.review?.reviewer) throw new Error(`${entry.id} must include reviewer.`);
    fixturePaths.add(entry.fixturePath);
    sourceKinds.add(entry.sourceKind);
    countsByType.set(entry.type, (countsByType.get(entry.type) || 0) + 1);
    const fixturePath = path.join(root, entry.fixturePath);
    const text = await readFile(fixturePath, "utf8");
    assertNoPrivateData(fixturePath, text);
    if (entry.type === "csv") {
      const headers = (text.split(/\r?\n/)[0] || "")
        .split(",")
        .map((value) => value.replaceAll('"', "").trim().toLowerCase().replace(/[\s-]+/g, "_"));
      const preset =
        [...CSV_IMPORT_PRESETS]
          .filter((item) => item.id !== "auto")
          .sort((a, b) => b.id.length - a.id.length)
          .find((item) => entry.fixturePath.includes(item.id)) || CSV_IMPORT_PRESETS.find((item) => item.id !== "auto");
      const mapping = csvMappingForPreset(headers, preset?.id || "auto");
      const preview = analyzeCsvImport(text, [], new Date("2026-06-02T10:00:00Z"), { presetId: preset?.id || "auto", mapping });
      if (!preview.valid.length) throw new Error(`${entry.id} CSV intake fixture did not produce an importable row.`);
    }
    if (entry.type === "ocr-text") {
      const parsed = parseReceiptText(text);
      if (!parsed.merchant || !parsed.purchaseDate || !parsed.items.length) {
        throw new Error(`${entry.id} OCR intake fixture must parse merchant, purchase date, and at least one item.`);
      }
    }
    if (entry.type === "ocr-image") {
      const imageFile = { name: path.basename(entry.fixturePath), type: "image/svg+xml", text: async () => text };
      if (!bundledLocalOcrWorkerSupports(imageFile)) throw new Error(`${entry.id} OCR image fixture is not supported by the bundled worker.`);
      const parsed = parseReceiptText(await bundledLocalOcrWorker(imageFile));
      if (!parsed.merchant || !parsed.purchaseDate || !parsed.items.length) {
        throw new Error(`${entry.id} bundled OCR image fixture must parse merchant, purchase date, and at least one item.`);
      }
    }
    if (entry.type === "pdf-text") {
      const diagnostics = pdfExtractionDiagnostics(text);
      if (!diagnostics.noCloudOcrUsed) throw new Error(`${entry.id} PDF intake fixture must not depend on cloud OCR.`);
    }
  }
  const targets = manifest.coverageTargets || {};
  for (const [type, minimum] of Object.entries(targets.minByType || {})) {
    if ((countsByType.get(type) || 0) < Number(minimum)) {
      throw new Error(`Sample intake coverage needs at least ${minimum} ${type} fixture(s).`);
    }
  }
  for (const sourceKind of targets.requiredSourceKinds || []) {
    if (!sourceKinds.has(sourceKind)) throw new Error(`Sample intake coverage is missing sourceKind ${sourceKind}.`);
  }
  for (const fixturePath of targets.requiredFixturePaths || []) {
    if (!fixturePaths.has(fixturePath)) throw new Error(`Sample intake coverage is missing fixturePath ${fixturePath}.`);
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
    const parsed =
      item.sourceType === "bundled-fixture-worker"
        ? parseReceiptText(await bundledLocalOcrWorker({ name: path.basename(item.path), type: "image/svg+xml", text: async () => text }))
        : parseReceiptText(text);
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

  const trustedKeysPath = path.join(root, "presets/trusted-keys.json");
  const trustedKeys = JSON.parse(await readFile(trustedKeysPath, "utf8"));
  if (trustedKeys.schema !== "return-warranty-guardian.csv-preset-trusted-keys.v1") {
    throw new Error("Trusted key registry fixture has unsupported schema.");
  }
  const reviewKeys = (trustedKeys.keys || []).filter((key) => key.purpose === "csv-preset-review");
  if (!reviewKeys.length) throw new Error("Trusted key registry fixture must include at least one csv-preset-review key.");
  for (const key of reviewKeys) {
    if (!key.keyId || !key.trustedSince || key.publicKeyJwk?.kty !== "EC" || key.publicKeyJwk?.crv !== "P-256") {
      throw new Error(`Trusted key ${key.keyId || "(missing)"} must include P-256 public key metadata.`);
    }
  }

  const signedBundlePath = path.join(root, "presets/signed-bundle.json");
  const signedBundle = JSON.parse(await readFile(signedBundlePath, "utf8"));
  const signedFingerprintCheck = await verifyCsvPresetBundleFingerprint(signedBundle);
  if (!signedFingerprintCheck.ok) throw new Error(`Signed preset bundle fingerprint failed: ${signedFingerprintCheck.issues.join("; ")}`);
  const signatureCheck = await verifyCsvPresetBundleDetachedSignatures(signedBundle, reviewKeys);
  if (!signatureCheck.ok || signatureCheck.verifiedCount < 1) {
    throw new Error(`Signed preset bundle signature failed: ${signatureCheck.results.map((result) => result.status).join("; ")}`);
  }
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
