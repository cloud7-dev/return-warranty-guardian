import { readFile } from "node:fs/promises";
import { auditNotificationSmokeRecords } from "./audit-notification-smoke-records.mjs";

function escapeTableCell(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
}

export function notificationSmokeOpsReportMarkdown(audit) {
  const requiredProviders = Array.isArray(audit.requiredProviders) ? audit.requiredProviders : [];
  const freshProviders = Array.isArray(audit.freshSuccessfulProviders) ? audit.freshSuccessfulProviders : [];
  const records = Array.isArray(audit.records) ? audit.records : [];
  const issues = Array.isArray(audit.issues) ? audit.issues : [];
  const rows = records.length
    ? records
        .map(
          (record) =>
            `| ${escapeTableCell(record.file)} | ${record.ok ? "yes" : "no"} | ${escapeTableCell(record.generatedAt)} | ${escapeTableCell(record.publicProvider || "none")} | ${escapeTableCell(record.publicStatus)} | ${escapeTableCell(record.endpointHostHash)} |`,
        )
        .join("\n")
    : "| none | no |  | none |  |  |";

  return `# Notification Smoke Operations Report

Generated: ${audit.generatedAt}

Status: ${audit.ok ? "PASS" : "FAIL"}

Required providers: ${requiredProviders.length ? requiredProviders.join(", ") : "none"}

Fresh successful providers: ${freshProviders.length ? freshProviders.join(", ") : "none"}

This report is generated from sanitized smoke records only. It must not contain raw endpoint URLs, topics, tokens, authorization headers, or reminder bodies.

| Record | OK | Generated At | Public Provider | Public Status | Endpoint Host Hash |
| --- | --- | --- | --- | --- | --- |
${rows}

## Issues

${issues.length ? issues.map((issue) => `- ${issue}`).join("\n") : "- None"}
`;
}

async function main() {
  const [, , recordDir = "tests/fixtures/notifications/smoke-records", policyPath = "tests/fixtures/notifications/smoke-policy.json"] =
    process.argv;
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const audit = await auditNotificationSmokeRecords(recordDir, policy);
  const markdown = notificationSmokeOpsReportMarkdown(audit);
  console.log(markdown);
  if (!audit.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
