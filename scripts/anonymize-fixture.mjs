import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sanitizeFixtureFilename, sanitizeFixtureText } from "../src/fixture-sanitizer.js";

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
await writeFile(outputPath, sanitizeFixtureText(raw), "utf8");
console.log(outputPath);
