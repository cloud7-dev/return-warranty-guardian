import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function validateNotificationSmokeRecord(record, policy = {}, options = {}) {
  const issues = [];
  const serialized = JSON.stringify(record || {});
  if (/https?:\/\//i.test(serialized)) issues.push("record must not store raw endpoint URLs");
  if (/token|bearer|authorization/i.test(serialized.replace(/"privacyNote"\s*:\s*"[^"]+"/g, ""))) {
    issues.push("record must not store token or authorization data");
  }
  if (record?.schema !== "return-warranty-guardian.notification-smoke-record.v1") {
    issues.push("unsupported smoke record schema");
  }
  const generatedAt = new Date(record?.generatedAt || "");
  if (Number.isNaN(generatedAt.getTime())) {
    issues.push("record must include a valid generatedAt timestamp");
  } else {
    const maxRecordAgeDays = Number(policy.maxRecordAgeDays || 45);
    const now = options.now || new Date();
    const ageDays = (now.getTime() - generatedAt.getTime()) / 86_400_000;
    if (ageDays > maxRecordAgeDays) issues.push(`record is stale; refresh within ${maxRecordAgeDays} days`);
  }
  const expectedLoopback = policy.requiredLoopbackStatuses || {};
  for (const [provider, status] of Object.entries(expectedLoopback)) {
    const actual = record?.loopback?.[`${provider}Status`];
    if (actual !== Number(status)) issues.push(`${provider} loopback status must be ${status}`);
  }
  if (!record?.loopback?.purchaseDataSentOnlyDuringExplicitSend) {
    issues.push("record must confirm purchase data is only sent during explicit send");
  }
  if (!record?.publicSmoke?.skipped) {
    const statusRange = Array.isArray(policy.acceptedPublicStatusRange) ? policy.acceptedPublicStatusRange : [200, 299];
    const status = Number(record?.publicSmoke?.status || 0);
    if (!record?.publicSmoke?.provider) issues.push("public smoke record must include provider");
    if (!/^[a-f0-9]{64}$/.test(record?.publicSmoke?.endpointHostHash || "")) {
      issues.push("public smoke record must include endpoint host SHA-256 hash");
    }
    if (!record?.publicSmoke?.ok || status < Number(statusRange[0]) || status > Number(statusRange[1])) {
      issues.push("public smoke status must be successful");
    }
  } else if (!options.allowSkipped) {
    issues.push("public smoke record must not be skipped");
  }
  return {
    schema: "return-warranty-guardian.notification-smoke-record-validation.v1",
    ok: issues.length === 0,
    issues,
  };
}

async function main() {
  const [, , recordPath, policyPath = "tests/fixtures/notifications/smoke-policy.json"] = process.argv;
  if (!recordPath) throw new Error("Usage: node scripts/validate-notification-smoke-record.mjs <record.json> [policy.json]");
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const result = validateNotificationSmokeRecord(record, policy);
  if (!result.ok) throw new Error(result.issues.join("; "));
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
