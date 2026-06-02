import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { validateNotificationSmokeRecord } from "./validate-notification-smoke-record.mjs";

async function listJsonFiles(targetPath) {
  const entries = await readdir(targetPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(targetPath, entry.name);
      return entry.isDirectory() ? listJsonFiles(fullPath) : fullPath.endsWith(".json") ? [fullPath] : [];
    }),
  );
  return nested.flat();
}

export async function auditNotificationSmokeRecords(recordDir, policy, options = {}) {
  const files = await listJsonFiles(recordDir);
  const now = options.now || new Date();
  const records = [];
  const issues = [];
  const freshSuccessfulProviders = new Set();
  for (const file of files) {
    const record = JSON.parse(await readFile(file, "utf8"));
    const validation = validateNotificationSmokeRecord(record, policy, { now });
    const generatedAt = new Date(record.generatedAt || "");
    const publicProvider = record.publicSmoke?.skipped ? "" : record.publicSmoke?.provider || "";
    if (!validation.ok) issues.push(`${path.relative(recordDir, file)}: ${validation.issues.join("; ")}`);
    if (validation.ok && publicProvider) freshSuccessfulProviders.add(publicProvider);
    records.push({
      file: path.relative(recordDir, file),
      ok: validation.ok,
      generatedAt: Number.isNaN(generatedAt.getTime()) ? "" : generatedAt.toISOString(),
      publicProvider,
      publicStatus: record.publicSmoke?.skipped ? "skipped" : String(record.publicSmoke?.status || ""),
      endpointHostHash: record.publicSmoke?.endpointHostHash || "",
      issues: validation.issues,
    });
  }
  for (const provider of policy.requiredProviders || []) {
    if (!freshSuccessfulProviders.has(provider)) issues.push(`missing fresh successful public smoke record for ${provider}`);
  }
  return {
    schema: "return-warranty-guardian.notification-smoke-record-audit.v1",
    ok: issues.length === 0,
    generatedAt: now.toISOString(),
    recordCount: records.length,
    requiredProviders: policy.requiredProviders || [],
    freshSuccessfulProviders: [...freshSuccessfulProviders].sort(),
    records: records.sort((a, b) => a.file.localeCompare(b.file)),
    issues,
  };
}

async function main() {
  const [, , recordDir = "tests/fixtures/notifications/smoke-records", policyPath = "tests/fixtures/notifications/smoke-policy.json"] =
    process.argv;
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const result = await auditNotificationSmokeRecords(recordDir, policy);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
