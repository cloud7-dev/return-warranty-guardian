import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { reviewSampleIntakeEntry } from "./review-sample-intake.mjs";

async function listJsonFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? listJsonFiles(fullPath) : entry.name.endsWith(".json") ? [fullPath] : [];
    }),
  );
  return nested.flat();
}

export async function reviewSampleBatch(entryDir, options = {}) {
  const files = await listJsonFiles(entryDir);
  const results = [];
  const acceptedEntries = [];
  for (const file of files) {
    const entry = JSON.parse(await readFile(file, "utf8"));
    const review = await reviewSampleIntakeEntry(entry, { fixtureRoot: options.fixtureRoot });
    results.push({ file: path.relative(entryDir, file), ...review });
    if (review.ok) acceptedEntries.push(entry);
  }
  const issues = results.flatMap((result) => result.issues.map((issue) => `${result.file}: ${issue}`));
  return {
    schema: "return-warranty-guardian.sample-intake-batch-review.v1",
    ok: issues.length === 0,
    entryCount: results.length,
    acceptedCount: acceptedEntries.length,
    rejectedCount: results.length - acceptedEntries.length,
    acceptedEntries,
    results: results.sort((a, b) => a.file.localeCompare(b.file)),
    issues,
  };
}

async function main() {
  const [, , entryDir, fixtureRoot = "tests/fixtures"] = process.argv;
  if (!entryDir) throw new Error("Usage: node scripts/review-sample-batch.mjs <entry-dir> [fixture-root]");
  const result = await reviewSampleBatch(path.resolve(entryDir), { fixtureRoot: path.resolve(fixtureRoot) });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
