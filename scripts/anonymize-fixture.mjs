import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeFixtureFilename, sanitizeFixtureReport } from "../src/fixture-sanitizer.js";

const [, , inputPath, outputDir = "tests/fixtures/sanitized"] = process.argv;

if (!inputPath) {
  console.error("Usage: node scripts/anonymize-fixture.mjs <input-file> [output-dir]");
  process.exit(1);
}

const raw = await readFile(inputPath, "utf8");
const safeName = sanitizeFixtureFilename(path.basename(inputPath));
const ext = path.extname(inputPath) || ".txt";
await mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `${safeName}.sanitized${ext}`);
const report = sanitizeFixtureReport(raw);
await writeFile(outputPath, report.sanitizedText, "utf8");
const reportPath = path.join(outputDir, `${safeName}.anonymize-report.json`);
await writeFile(
  reportPath,
  JSON.stringify(
    {
      schema: report.schema,
      generatedAt: new Date().toISOString(),
      sourceFileName: path.basename(inputPath),
      sanitizedFixturePath: outputPath,
      redacted: report.redacted,
      replacements: report.replacements,
      nextReview: {
        piiChecked: false,
        parserChecked: false,
        moveIntoTestsFixturesBeforeCommit: true,
      },
    },
    null,
    2,
  ),
  "utf8",
);
const intakeDraftPath = path.join(outputDir, `${safeName}.intake-entry-draft.json`);
await writeFile(
  intakeDraftPath,
  JSON.stringify(
    {
      id: `${safeName}-${new Date().toISOString().slice(0, 10)}`,
      type: ext.toLowerCase() === ".csv" ? "csv" : "ocr-text",
      fixturePath: `REPLACE-WITH-FINAL-FIXTURE-PATH/${path.basename(outputPath)}`,
      sourceKind: "REPLACE-WITH-SOURCE-KIND",
      provenance: {
        origin: "anonymized-community",
        license: "permission-to-include-fixture",
        permission: "REPLACE-WITH-PERMISSION-NOTE",
        rawSampleRetained: false,
        contributorHandle: "REPLACE-WITH-NON-SENSITIVE-HANDLE",
      },
      anonymized: true,
      review: {
        piiChecked: false,
        parserChecked: false,
        reviewedAt: new Date().toISOString().slice(0, 10),
        reviewer: "REPLACE-WITH-REVIEWER-HANDLE",
      },
    },
    null,
    2,
  ),
  "utf8",
);
console.log(JSON.stringify({ sanitizedFixturePath: outputPath, reportPath, intakeDraftPath }, null, 2));
