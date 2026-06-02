import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { sampleIntakeCoverageReport } from "./sample-intake-coverage-report.mjs";

function sourceKindType(entries, sourceKind) {
  return entries.find((entry) => entry.sourceKind === sourceKind)?.type || "csv";
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

export function sampleRequestPack(manifest, now = new Date()) {
  const entries = Array.isArray(manifest?.entries) ? manifest.entries : [];
  const coverage = sampleIntakeCoverageReport(manifest, now);
  const requestedSourceKinds = manifest?.coverageTargets?.requiredSourceKinds?.length
    ? manifest.coverageTargets.requiredSourceKinds
    : [...new Set(entries.map((entry) => entry.sourceKind).filter(Boolean))];

  const requests = requestedSourceKinds.map((sourceKind) => ({
    sourceKind,
    preferredType: sourceKindType(entries, sourceKind),
    requestedOrigin: "anonymized-community or public-open-license",
    privacyGate: "rawSampleRetained=false, piiChecked=true, parserChecked=true",
  }));

  return {
    schema: "return-warranty-guardian.sample-request-pack.v1",
    generatedAt: now.toISOString(),
    communitySampleStatus: coverage.communityReady ? "READY" : "MISSING",
    coverageStatus: coverage.ok ? "PASS" : "FAIL",
    acceptedEntries: coverage.entryCount,
    requests,
    intakeEntryTemplate: {
      id: "reviewed-community-sample-id",
      type: requests[0]?.preferredType || "csv",
      sourceKind: requests[0]?.sourceKind || "payment-receipt-shape",
      fixturePath: "csv/reviewed-community-sample.csv",
      anonymized: true,
      provenance: {
        origin: "anonymized-community",
        permission: "sanitized sample shared for parser regression",
        contributorHandle: "github-handle-without-personal-data",
        rawSampleRetained: false,
      },
      review: {
        piiChecked: true,
        parserChecked: true,
        reviewedAt: "YYYY-MM-DD",
        reviewer: "maintainer-handle",
      },
    },
    contributorCommands: [
      "npm run fixture:anonymize -- path/to/private-sample.csv",
      "npm run fixture:review -- path/to/intake-entry.json path/to/fixture-root",
    ],
    maintainerCommands: [
      "npm run fixture:review-batch -- path/to/intake-entries path/to/fixture-root",
      "npm run fixture:coverage -- tests/fixtures/intake/sample-intake.json",
      "npm run fixture:coverage -- --strict-community tests/fixtures/intake/sample-intake.json",
      "npm run fixture:validate",
    ],
  };
}

export function sampleRequestPackMarkdown(pack) {
  return `# Sample Request Pack

Generated: ${pack.generatedAt}

Coverage status: ${pack.coverageStatus}

Community sample status: ${pack.communitySampleStatus}

Accepted entries: ${pack.acceptedEntries}

## Privacy Rules

- Do not submit raw receipts, card statements, order IDs, addresses, emails, phone numbers, card numbers, support messages, or account screenshots.
- Submit only synthetic, anonymized-community, or public-open-license samples.
- Maintainers must not retain the raw private sample after producing the sanitized fixture.
- Every accepted entry must keep \`rawSampleRetained=false\`, \`piiChecked=true\`, and \`parserChecked=true\`.

## Requested Sample Shapes

${markdownTable(pack.requests, [
  { key: "sourceKind", label: "Source Kind" },
  { key: "preferredType", label: "Preferred Type" },
  { key: "requestedOrigin", label: "Requested Origin" },
  { key: "privacyGate", label: "Acceptance Gate" },
])}

## Contributor Commands

${pack.contributorCommands.map((command) => `- \`${command}\``).join("\n")}

## Maintainer Gate

${pack.maintainerCommands.map((command) => `- \`${command}\``).join("\n")}

## Intake Entry Template

\`\`\`json
${JSON.stringify(pack.intakeEntryTemplate, null, 2)}
\`\`\`
`;
}

async function main() {
  const manifestPath = process.argv.find((item, index) => index > 1 && !item.startsWith("--")) || "tests/fixtures/intake/sample-intake.json";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const pack = sampleRequestPack(manifest);
  console.log(sampleRequestPackMarkdown(pack));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
