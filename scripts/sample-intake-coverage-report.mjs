import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

function countBy(items, selector) {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function markdownTable(rows, columns) {
  if (!rows.length) return "| none |\n| --- |";
  const header = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${columns.map((column) => String(row[column.key] ?? "").replaceAll("|", "\\|")).join(" | ")} |`)
    .join("\n");
  return [header, divider, body].join("\n");
}

export function sampleIntakeCoverageReport(manifest, now = new Date()) {
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  const targets = manifest?.coverageTargets || {};
  const countsByType = countBy(entries, (entry) => entry.type);
  const countsByOrigin = countBy(entries, (entry) => entry.provenance?.origin);
  const countsBySourceKind = countBy(entries, (entry) => entry.sourceKind);
  const fixturePaths = new Set(entries.map((entry) => entry.fixturePath).filter(Boolean));
  const sourceKinds = new Set(entries.map((entry) => entry.sourceKind).filter(Boolean));
  const targetIssues = [];

  for (const [type, minimum] of Object.entries(targets.minByType || {})) {
    if ((countsByType[type] || 0) < Number(minimum)) {
      targetIssues.push(`needs at least ${minimum} ${type} fixture(s)`);
    }
  }
  for (const sourceKind of targets.requiredSourceKinds || []) {
    if (!sourceKinds.has(sourceKind)) targetIssues.push(`missing sourceKind ${sourceKind}`);
  }
  for (const fixturePath of targets.requiredFixturePaths || []) {
    if (!fixturePaths.has(fixturePath)) targetIssues.push(`missing fixturePath ${fixturePath}`);
  }

  const communityCount = (countsByOrigin["anonymized-community"] || 0) + (countsByOrigin["public-open-license"] || 0);
  const communityIssues = [];
  if (communityCount < 1) communityIssues.push("no anonymized-community or public-open-license sample has been accepted yet");

  return {
    schema: "return-warranty-guardian.sample-intake-coverage-report.v1",
    generatedAt: now.toISOString(),
    ok: targetIssues.length === 0,
    communityReady: communityIssues.length === 0,
    entryCount: entries.length,
    countsByType,
    countsByOrigin,
    countsBySourceKind,
    targetIssues,
    communityIssues,
    entries: entries.map((entry) => ({
      id: entry.id || "",
      type: entry.type || "",
      sourceKind: entry.sourceKind || "",
      origin: entry.provenance?.origin || "",
      fixturePath: entry.fixturePath || "",
      reviewedAt: entry.review?.reviewedAt || "",
    })),
  };
}

export function sampleIntakeCoverageMarkdown(report) {
  const countRows = (counts) => Object.entries(counts).map(([name, count]) => ({ name, count }));
  return `# Sample Intake Coverage Report

Generated: ${report.generatedAt}

Coverage status: ${report.ok ? "PASS" : "FAIL"}

Community sample status: ${report.communityReady ? "READY" : "MISSING"}

Accepted entries: ${report.entryCount}

## Counts By Type

${markdownTable(countRows(report.countsByType), [
  { key: "name", label: "Type" },
  { key: "count", label: "Count" },
])}

## Counts By Provenance Origin

${markdownTable(countRows(report.countsByOrigin), [
  { key: "name", label: "Origin" },
  { key: "count", label: "Count" },
])}

## Counts By Source Kind

${markdownTable(countRows(report.countsBySourceKind), [
  { key: "name", label: "Source Kind" },
  { key: "count", label: "Count" },
])}

## Accepted Entries

${markdownTable(report.entries, [
  { key: "id", label: "ID" },
  { key: "type", label: "Type" },
  { key: "sourceKind", label: "Source Kind" },
  { key: "origin", label: "Origin" },
  { key: "fixturePath", label: "Fixture" },
  { key: "reviewedAt", label: "Reviewed" },
])}

## Coverage Issues

${report.targetIssues.length ? report.targetIssues.map((issue) => `- ${issue}`).join("\n") : "- None"}

## Community Sample Gaps

${report.communityIssues.length ? report.communityIssues.map((issue) => `- ${issue}`).join("\n") : "- None"}
`;
}

async function main() {
  const strictCommunity = process.argv.includes("--strict-community");
  const manifestPath = process.argv.find((item, index) => index > 1 && !item.startsWith("--")) || "tests/fixtures/intake/sample-intake.json";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const report = sampleIntakeCoverageReport(manifest);
  console.log(sampleIntakeCoverageMarkdown(report));
  if (!report.ok || (strictCommunity && !report.communityReady)) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
