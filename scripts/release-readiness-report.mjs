import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { sampleIntakeCoverageReport } from "./sample-intake-coverage-report.mjs";

function markdownTable(rows, columns) {
  if (!rows.length) return "| none |\n| --- |";
  const header = `| ${columns.map((column) => column.label).join(" | ")} |`;
  const divider = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${columns.map((column) => String(row[column.key] ?? "").replaceAll("|", "\\|")).join(" | ")} |`)
    .join("\n");
  return [header, divider, body].join("\n");
}

export function releaseReadinessReport(sampleManifest, now = new Date()) {
  const sampleCoverage = sampleIntakeCoverageReport(sampleManifest, now);
  const gates = [
    {
      area: "Core local-first app",
      status: "Ready for OSS review",
      evidence: "Static web app, PWA shell, local storage, exports, i18n, and browser QA checks are covered by the default validation commands.",
    },
    {
      area: "Fixture intake operations",
      status: sampleCoverage.communityReady ? "Community-ready" : "Needs accepted community/public sample",
      evidence: `Coverage ${sampleCoverage.ok ? "passes" : "fails"} with ${sampleCoverage.entryCount} accepted entries; community status is ${sampleCoverage.communityReady ? "READY" : "MISSING"}.`,
    },
    {
      area: "Local OCR path",
      status: "Partial",
      evidence: "Text, CSV, HTML/email, PDF text operators, scanned PDF diagnostics, local OCR sidecar paste/file/auto-pairing, and adapter fixtures exist.",
    },
    {
      area: "Notification operations",
      status: "Partial",
      evidence: "Calendar fallback, open-app notifications, self-hosted dry-runs, loopback smoke tests, sanitized records, and ops reports exist.",
    },
    {
      area: "Claim evidence export",
      status: "Ready for OSS review",
      evidence: "HTML/JSON/ZIP claim bundles include evidence pack, attachments, manifests, export review, profile, and submission templates.",
    },
  ];

  return {
    schema: "return-warranty-guardian.release-readiness-report.v1",
    generatedAt: now.toISOString(),
    gates,
    remainingItems: [
      "2. Actual anonymized-community or public-open-license user/community samples accepted into the fixture corpus.",
      "3. Actual bundled cross-browser OCR engine and automated scanned PDF OCR path beyond sidecars/adapters.",
      "4. Actual recurring public/self-hosted endpoint smoke records operated by the maintainer environment.",
    ],
    recommendedCommands: [
      "node --check src/*.js scripts/*.mjs tests/*.mjs",
      "npm test",
      "npm run build",
      "npm run fixture:validate",
      "npm run fixture:coverage -- tests/fixtures/intake/sample-intake.json",
      "npm run fixture:request-pack -- tests/fixtures/intake/sample-intake.json",
      "npm run release:readiness -- tests/fixtures/intake/sample-intake.json",
      "npm run qa:browser",
    ],
  };
}

export function releaseReadinessMarkdown(report) {
  return `# Release Readiness Report

Generated: ${report.generatedAt}

## Gates

${markdownTable(report.gates, [
  { key: "area", label: "Area" },
  { key: "status", label: "Status" },
  { key: "evidence", label: "Evidence" },
])}

## Recommended Verification

${report.recommendedCommands.map((command) => `- \`${command}\``).join("\n")}

## Remaining Items

${report.remainingItems.map((item) => `- ${item}`).join("\n")}

2, 3, 4 remain.
`;
}

async function main() {
  const manifestPath = process.argv.find((item, index) => index > 1 && !item.startsWith("--")) || "tests/fixtures/intake/sample-intake.json";
  const sampleManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  console.log(releaseReadinessMarkdown(releaseReadinessReport(sampleManifest)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
