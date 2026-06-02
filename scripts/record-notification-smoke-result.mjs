import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function notificationSmokeRecord(smokeResult, now = new Date()) {
  const publicSmoke = smokeResult?.publicSmoke || {};
  const providerResult = publicSmoke.result || {};
  return {
    schema: "return-warranty-guardian.notification-smoke-record.v1",
    generatedAt: now.toISOString(),
    privacyNote: "Sanitized smoke record. Raw endpoint URLs, topics, tokens, and reminder bodies are not stored.",
    loopback: {
      requestCount: Number(smokeResult?.requestCount || 0),
      ntfyStatus: Number(smokeResult?.ntfy?.status || 0),
      gotifyStatus: Number(smokeResult?.gotify?.status || 0),
      purchaseDataSentOnlyDuringExplicitSend: Boolean(smokeResult?.purchaseDataSentOnlyDuringExplicitSend),
    },
    publicSmoke: {
      skipped: publicSmoke.skipped !== false,
      provider: publicSmoke.provider || "",
      endpointHostHash: publicSmoke.endpointHost ? sha256(publicSmoke.endpointHost) : "",
      ok: Boolean(providerResult.ok),
      status: Number(providerResult.status || 0),
    },
  };
}

async function main() {
  const [, , inputPath] = process.argv;
  if (!inputPath) throw new Error("Usage: node scripts/record-notification-smoke-result.mjs <notify-smoke-output.json>");
  const raw = await readFile(inputPath, "utf8");
  const smokeResult = JSON.parse(raw);
  console.log(JSON.stringify(notificationSmokeRecord(smokeResult), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
