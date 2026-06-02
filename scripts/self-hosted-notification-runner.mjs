import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SUPPORTED_SCHEMA = "return-warranty-guardian.self-hosted-notifications.v1";

function parseArgs(argv) {
  const options = {
    payloadPath: "",
    provider: "",
    limit: 5,
    checkEndpoint: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--provider") {
      options.provider = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--limit") {
      options.limit = Number(argv[index + 1] || 5);
      index += 1;
    } else if (arg === "--check-endpoint") {
      options.checkEndpoint = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (!arg.startsWith("-") && !options.payloadPath) {
      options.payloadPath = arg;
    }
  }
  return options;
}

function shellSingleQuote(value) {
  return `'${String(value || "").replaceAll("'", "'\\''")}'`;
}

function fillCommand(template, reminder) {
  return String(template || "")
    .replaceAll("'<title>'", shellSingleQuote(reminder.title))
    .replaceAll("'<message>'", shellSingleQuote(reminder.message))
    .replaceAll("<title>", reminder.title)
    .replaceAll("<message>", reminder.message);
}

function endpointForProvider(payload, provider) {
  const endpoint = String(payload.settings?.endpoint || "").replace(/\/+$/, "");
  const topic = String(payload.settings?.topic || "").replace(/^\/+/, "");
  if (!endpoint) return "";
  if (provider === "ntfy" && topic) return `${endpoint}/${topic}`;
  if (provider === "gotify") return `${endpoint}/message`;
  return endpoint;
}

export function buildRunnerPlan(payload, options = {}) {
  const warnings = [];
  if (payload?.schema !== SUPPORTED_SCHEMA) warnings.push("Unsupported payload schema.");
  const provider = options.provider || payload?.settings?.provider || "ntfy";
  const providerDraft = payload?.providers?.[provider];
  if (!providerDraft) warnings.push(`Unsupported provider: ${provider}.`);
  if (payload?.settings?.tokenStored) warnings.push("Payload claims a token is stored; this runner expects tokens outside the app.");
  if (!payload?.settings?.enabled) warnings.push("Self-hosted delivery is not enabled in the exported settings.");
  const reminders = Array.isArray(payload?.reminders) ? payload.reminders : [];
  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 5;
  const selected = reminders.slice(0, Math.max(0, limit));
  const endpoint = endpointForProvider(payload, provider);
  if (options.checkEndpoint && !endpoint) warnings.push("Endpoint check requested but no endpoint is configured.");

  return {
    schema: "return-warranty-guardian.self-hosted-runner-plan.v1",
    provider,
    dryRunOnly: true,
    appSendsNetworkRequests: false,
    endpointCheck: {
      requested: Boolean(options.checkEndpoint),
      method: provider === "gotify" ? "GET" : "HEAD",
      url: endpoint,
      sendsPurchaseData: false,
    },
    reminderCount: reminders.length,
    plannedCount: selected.length,
    commands: selected.map((reminder) => ({
      title: reminder.title,
      deadlineDate: reminder.deadlineDate,
      command: fillCommand(providerDraft?.curl || "", reminder),
    })),
    warnings,
    runnerNote:
      "This CLI prepares local dry-run commands only. Use your own scheduler and secret store if you choose to send notifications.",
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.payloadPath) {
    throw new Error("Usage: node scripts/self-hosted-notification-runner.mjs <payload.json> [--provider ntfy|gotify|apprise] [--limit 5] [--check-endpoint] [--json]");
  }
  const payload = JSON.parse(await readFile(options.payloadPath, "utf8"));
  const plan = buildRunnerPlan(payload, options);
  if (options.json) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  console.log(`Return & Warranty Guardian self-hosted runner dry-run`);
  console.log(`Provider: ${plan.provider}`);
  console.log(`Planned reminders: ${plan.plannedCount}/${plan.reminderCount}`);
  plan.warnings.forEach((warning) => console.log(`Warning: ${warning}`));
  plan.commands.forEach((item, index) => {
    console.log(`\n# ${index + 1}. ${item.title} (${item.deadlineDate})`);
    console.log(item.command);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
