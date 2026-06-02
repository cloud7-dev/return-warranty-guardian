import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function safeUrlParts(endpoint) {
  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    return { protocol: url.protocol.replace(/:$/, ""), host: url.host };
  } catch {
    return null;
  }
}

export function notificationSmokeReadiness({
  env = process.env,
  workflowText = "",
  policy = {},
  now = new Date(),
} = {}) {
  const provider = env.RWG_NOTIFY_PUBLIC_PROVIDER || "ntfy";
  const endpoint = String(env.RWG_NOTIFY_PUBLIC_ENDPOINT || "").trim();
  const topic = env.RWG_NOTIFY_PUBLIC_TOPIC || "returns";
  const publicSmokeEnabled = env.RWG_NOTIFY_PUBLIC_SMOKE === "1";
  const issues = [];
  const warnings = [];
  const url = safeUrlParts(endpoint);

  if (!["ntfy", "gotify"].includes(provider)) issues.push("RWG_NOTIFY_PUBLIC_PROVIDER must be ntfy or gotify.");
  if (!endpoint) issues.push("RWG_NOTIFY_PUBLIC_ENDPOINT is required for public/self-hosted smoke.");
  if (endpoint && !url) issues.push("RWG_NOTIFY_PUBLIC_ENDPOINT must be a valid URL.");
  if (url && url.protocol !== "https" && !/^127\.0\.0\.1(?::\d+)?$|^localhost(?::\d+)?$/i.test(url.host)) {
    warnings.push("Use HTTPS for real public/self-hosted smoke endpoints.");
  }
  if (provider === "ntfy" && !String(topic || "").trim()) issues.push("RWG_NOTIFY_PUBLIC_TOPIC is required for ntfy smoke.");
  if (provider === "gotify" && !env.GOTIFY_TOKEN) issues.push("GOTIFY_TOKEN is required for Gotify smoke.");
  if (!publicSmokeEnabled) warnings.push("Set RWG_NOTIFY_PUBLIC_SMOKE=1 before running a real endpoint smoke locally.");

  const workflowHasSchedule = /schedule:\s*\n\s*-\s*cron:/m.test(workflowText);
  const workflowHasManualDispatch = /workflow_dispatch:/m.test(workflowText);
  const workflowUsesRepoVars = /vars\.RWG_NOTIFY_PUBLIC_ENDPOINT/.test(workflowText);
  const workflowUploadsSanitizedArtifact = /sanitized-smoke-record\.json/.test(workflowText) && /upload-artifact/.test(workflowText);
  const workflowValidatesArtifact = /notify:validate-record/.test(workflowText);
  if (!workflowHasSchedule) issues.push("Notification Smoke workflow must include a schedule.");
  if (!workflowHasManualDispatch) issues.push("Notification Smoke workflow must allow manual dispatch.");
  if (!workflowUsesRepoVars) issues.push("Notification Smoke workflow must read repository variables for scheduled runs.");
  if (!workflowUploadsSanitizedArtifact) issues.push("Notification Smoke workflow must upload only a sanitized smoke record artifact.");
  if (!workflowValidatesArtifact) issues.push("Notification Smoke workflow must validate the sanitized smoke record before upload.");

  if (policy.schema !== "return-warranty-guardian.notification-smoke-policy.v1") {
    issues.push("Smoke policy schema is missing or unsupported.");
  }
  if (!Number.isFinite(Number(policy.maxRecordAgeDays || 0)) || Number(policy.maxRecordAgeDays || 0) < 1) {
    issues.push("Smoke policy must set maxRecordAgeDays.");
  }
  if (!Array.isArray(policy.requiredProviders) || !policy.requiredProviders.includes("ntfy")) {
    issues.push("Smoke policy must require at least ntfy provider coverage.");
  }

  return {
    schema: "return-warranty-guardian.notification-smoke-readiness.v1",
    generatedAt: now.toISOString(),
    ok: issues.length === 0,
    provider,
    publicSmokeEnabled,
    endpoint: {
      configured: Boolean(endpoint),
      protocol: url?.protocol || "",
      hostHash: url?.host ? sha256(url.host) : "",
      rawEndpointStored: false,
    },
    topicConfigured: provider === "ntfy" ? Boolean(String(topic || "").trim()) : false,
    gotifyTokenConfigured: provider === "gotify" ? Boolean(env.GOTIFY_TOKEN) : false,
    workflow: {
      hasSchedule: workflowHasSchedule,
      hasManualDispatch: workflowHasManualDispatch,
      usesRepositoryVariables: workflowUsesRepoVars,
      uploadsSanitizedArtifact: workflowUploadsSanitizedArtifact,
      validatesSanitizedArtifact: workflowValidatesArtifact,
    },
    policy: {
      maxRecordAgeDays: Number(policy.maxRecordAgeDays || 0),
      requiredProviders: Array.isArray(policy.requiredProviders) ? policy.requiredProviders : [],
    },
    issues,
    warnings,
  };
}

async function main() {
  const strict = process.argv.includes("--strict");
  const workflowText = await readFile(".github/workflows/notification-smoke.yml", "utf8");
  const policy = JSON.parse(await readFile("tests/fixtures/notifications/smoke-policy.json", "utf8"));
  const result = notificationSmokeReadiness({ workflowText, policy });
  console.log(JSON.stringify(result, null, 2));
  if (strict && !result.ok) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
