import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { CSV_IMPORT_PRESETS, analyzeCsvImport, csvMappingForPreset } from "../src/importers.js";
import { policyTemplateById } from "../src/policy-templates.js";

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
  if (files.length < 3) throw new Error("Expected at least three CSV fixtures.");
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

async function main() {
  const files = await listFiles(root);
  for (const file of files) {
    assertNoPrivateData(file, await readFile(file, "utf8"));
  }
  await validateCsvFixtures();
  await validatePolicyFixtures();
  console.log("Fixture validation passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
