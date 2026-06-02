import { readFile } from "node:fs/promises";
import path from "node:path";
import { pdfExtractionDiagnostics } from "../src/local-extraction.js";
import { bundledLocalOcrWorker, bundledLocalOcrWorkerSupports } from "../src/local-ocr-worker.js";
import { CSV_IMPORT_PRESETS, analyzeCsvImport, csvMappingForPreset } from "../src/importers.js";
import { parseReceiptText } from "../src/receipt-parser.js";

const piiPatterns = [
  { name: "email outside .test", pattern: /\b[A-Z0-9._%+-]+@(?!example\.test\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: "card-like number", pattern: /\b(?:\d[ -]?){13,19}\b/ },
  { name: "Korean mobile number", pattern: /\b010[- ]?\d{3,4}[- ]?\d{4}\b/ },
];
const allowedSampleOrigins = new Set(["synthetic-fixture", "anonymized-community", "public-open-license"]);
const allowedSampleLicenses = new Set(["Apache-2.0", "MIT", "CC0-1.0", "public-domain", "permission-to-include-fixture"]);
const allowedTypes = new Set(["csv", "ocr-text", "ocr-image", "pdf-text", "policy"]);

function assertNoPrivateData(label, text, issues) {
  for (const item of piiPatterns) {
    if (item.pattern.test(text)) issues.push(`${label} contains possible private data: ${item.name}`);
  }
}

function validateEntryMetadata(entry, issues) {
  if (!entry?.id) issues.push("entry is missing id");
  if (!entry?.fixturePath) issues.push(`${entry?.id || "entry"} is missing fixturePath`);
  if (entry?.fixturePath && (path.isAbsolute(entry.fixturePath) || entry.fixturePath.split(/[\\/]/).includes(".."))) {
    issues.push(`${entry.id} fixturePath must be relative and stay inside the fixture root`);
  }
  if (!allowedTypes.has(entry?.type)) issues.push(`${entry?.id || "entry"} has unsupported type`);
  if (!entry?.sourceKind) issues.push(`${entry?.id || "entry"} is missing sourceKind`);
  if (entry?.anonymized !== true) issues.push(`${entry?.id || "entry"} must be marked anonymized`);

  const provenance = entry?.provenance || {};
  if (!allowedSampleOrigins.has(provenance.origin)) issues.push(`${entry?.id || "entry"} has unsupported provenance origin`);
  if (!allowedSampleLicenses.has(provenance.license)) issues.push(`${entry?.id || "entry"} has unsupported provenance license`);
  if (!provenance.permission || /^REPLACE-WITH/i.test(provenance.permission)) {
    issues.push(`${entry?.id || "entry"} must document sample reuse permission`);
  }
  if (provenance.rawSampleRetained !== false) issues.push(`${entry?.id || "entry"} must confirm raw private sample retention is false`);
  if (!provenance.contributorHandle || /@/.test(provenance.contributorHandle) || /^REPLACE-WITH/i.test(provenance.contributorHandle)) {
    issues.push(`${entry?.id || "entry"} must include a non-sensitive contributor handle`);
  }

  if (!entry?.review?.piiChecked || !entry?.review?.parserChecked) {
    issues.push(`${entry?.id || "entry"} must include piiChecked and parserChecked review flags`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry?.review?.reviewedAt || "")) {
    issues.push(`${entry?.id || "entry"} must include reviewedAt as YYYY-MM-DD`);
  }
  if (!entry?.review?.reviewer || /@/.test(entry.review.reviewer)) {
    issues.push(`${entry?.id || "entry"} must include a non-sensitive reviewer handle`);
  }
}

async function validateEntryFixture(entry, fixtureRoot, issues) {
  if (!entry?.fixturePath || path.isAbsolute(entry.fixturePath) || entry.fixturePath.split(/[\\/]/).includes("..")) return {};
  const fixturePath = path.join(fixtureRoot, entry.fixturePath);
  let text = "";
  try {
    text = await readFile(fixturePath, "utf8");
  } catch (error) {
    issues.push(`${entry.id} fixture cannot be read: ${error.message}`);
    return {};
  }
  assertNoPrivateData(entry.fixturePath, text, issues);

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
    if (!preview.valid.length) issues.push(`${entry.id} CSV fixture did not produce an importable row`);
    return { parser: "csv-import", validRows: preview.valid.length, invalidRows: preview.invalid.length, duplicateRows: preview.duplicates.length };
  }

  if (entry.type === "ocr-text") {
    const parsed = parseReceiptText(text);
    if (!parsed.merchant || !parsed.purchaseDate || !parsed.items.length) {
      issues.push(`${entry.id} OCR text must parse merchant, purchase date, and at least one item`);
    }
    return { parser: "receipt-text", merchant: parsed.merchant, purchaseDate: parsed.purchaseDate, itemCount: parsed.items.length };
  }

  if (entry.type === "ocr-image") {
    const imageFile = { name: path.basename(entry.fixturePath), type: "image/svg+xml", text: async () => text };
    if (!bundledLocalOcrWorkerSupports(imageFile)) {
      issues.push(`${entry.id} OCR image is not supported by the bundled worker`);
      return { parser: "bundled-ocr-worker", itemCount: 0 };
    }
    const parsed = parseReceiptText(await bundledLocalOcrWorker(imageFile));
    if (!parsed.merchant || !parsed.purchaseDate || !parsed.items.length) {
      issues.push(`${entry.id} bundled OCR image must parse merchant, purchase date, and at least one item`);
    }
    return { parser: "bundled-ocr-worker", merchant: parsed.merchant, purchaseDate: parsed.purchaseDate, itemCount: parsed.items.length };
  }

  if (entry.type === "pdf-text") {
    const diagnostics = pdfExtractionDiagnostics(text);
    if (!diagnostics.noCloudOcrUsed) issues.push(`${entry.id} PDF fixture must not depend on cloud OCR`);
    return { parser: "pdf-diagnostics", pdfStatus: diagnostics.status, noCloudOcrUsed: diagnostics.noCloudOcrUsed };
  }

  return { parser: "metadata-only" };
}

export async function reviewSampleIntakeEntry(entry, options = {}) {
  const issues = [];
  validateEntryMetadata(entry, issues);
  const parserResult = await validateEntryFixture(entry, options.fixtureRoot || path.resolve("tests/fixtures"), issues);
  return {
    schema: "return-warranty-guardian.sample-intake-review.v1",
    ok: issues.length === 0,
    entryId: entry?.id || "",
    fixturePath: entry?.fixturePath || "",
    parserResult,
    issues,
  };
}

async function main() {
  const [, , entryPath, fixtureRoot = "tests/fixtures"] = process.argv;
  if (!entryPath) throw new Error("Usage: node scripts/review-sample-intake.mjs <intake-entry.json> [fixture-root]");
  const entry = JSON.parse(await readFile(entryPath, "utf8"));
  const result = await reviewSampleIntakeEntry(entry, { fixtureRoot: path.resolve(fixtureRoot) });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
