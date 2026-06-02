import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SUPPORTED_SCHEMA = "return-warranty-guardian.self-hosted-notifications.v1";

function parseArgs(argv) {
  const options = {
    payloadPath: "",
    provider: "",
    limit: 5,
    checkEndpoint: false,
    send: false,
    yes: false,
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
    } else if (arg === "--send") {
      options.send = true;
    } else if (arg === "--yes") {
      options.yes = true;
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

export function schedulerRecipes(payload, options = {}) {
  const provider = options.provider || payload?.settings?.provider || "ntfy";
  const payloadPath = options.payloadPath || "/path/to/return-warranty-guardian-self-hosted-alerts.json";
  const nodePath = options.nodePath || "node";
  const runnerPath = options.runnerPath || "scripts/self-hosted-notification-runner.mjs";
  const command = `${nodePath} ${runnerPath} ${shellSingleQuote(payloadPath)} --provider ${provider} --limit ${Number(options.limit || 5)}`;
  return {
    schema: "return-warranty-guardian.scheduler-recipes.v1",
    provider,
    sendsPurchaseDataDuringEndpointCheck: false,
    macosLaunchd: `0 9 * * * ${command}`,
    linuxCron: `0 9 * * * ${command}`,
    windowsTaskScheduler: `schtasks /Create /SC DAILY /TN ReturnWarrantyGuardianNotify /TR "${command}" /ST 09:00`,
    note: "Recipes default to dry-run command previews. Add --send --yes and RWG_NOTIFY_SEND=1 only after reviewing the payload and provider endpoint.",
  };
}

function sendPreconditions(payload, options) {
  const issues = [];
  if (!options.send) return issues;
  if (!options.yes) issues.push("Sending requires --yes.");
  if (process.env.RWG_NOTIFY_SEND !== "1") issues.push("Sending requires RWG_NOTIFY_SEND=1.");
  if (!payload?.settings?.enabled) issues.push("Payload settings are not enabled.");
  return issues;
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
  const sendIssues = sendPreconditions(payload, options);

  return {
    schema: "return-warranty-guardian.self-hosted-runner-plan.v1",
    provider,
    dryRunOnly: !options.send,
    sendRequested: Boolean(options.send),
    sendAllowed: options.send && sendIssues.length === 0 && warnings.length === 0,
    appSendsNetworkRequests: Boolean(options.send),
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
      message: reminder.message,
    })),
    schedulerRecipes: schedulerRecipes(payload, { provider, limit, payloadPath: options.payloadPath }),
    warnings: [...warnings, ...sendIssues],
    runnerNote:
      "Dry-run is the default. Sending requires --send --yes and RWG_NOTIFY_SEND=1; keep provider tokens outside this app.",
  };
}

async function checkEndpoint(plan) {
  if (!plan.endpointCheck.requested || !plan.endpointCheck.url) return { skipped: true };
  const response = await fetch(plan.endpointCheck.url, { method: plan.endpointCheck.method });
  return {
    skipped: false,
    ok: response.ok,
    status: response.status,
    url: plan.endpointCheck.url,
    sentPurchaseData: false,
  };
}

async function sendReminder(provider, endpoint, reminder, command) {
  if (provider === "ntfy") {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Title: "Return & Warranty Guardian" },
      body: reminder.message,
    });
    return { ok: response.ok, status: response.status, title: reminder.title };
  }
  if (provider === "gotify") {
    const token = process.env.GOTIFY_TOKEN || "";
    if (!token) return { ok: false, status: 0, title: reminder.title, error: "GOTIFY_TOKEN is required for gotify send mode." };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title: reminder.title, message: reminder.message, priority: 5 }),
    });
    return { ok: response.ok, status: response.status, title: reminder.title };
  }
  return {
    ok: false,
    status: 0,
    title: reminder.title,
    error: `Send mode is not implemented for ${provider}. Use the command preview manually: ${command}`,
  };
}

async function executeSend(plan, payload) {
  if (!plan.sendRequested) return [];
  if (!plan.sendAllowed) throw new Error(`Refusing to send: ${plan.warnings.join("; ")}`);
  const endpoint = endpointForProvider(payload, plan.provider);
  const reminders = (payload.reminders || []).slice(0, plan.plannedCount);
  const results = [];
  for (let index = 0; index < reminders.length; index += 1) {
    results.push(await sendReminder(plan.provider, endpoint, reminders[index], plan.commands[index]?.command || ""));
  }
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.payloadPath) {
    throw new Error("Usage: node scripts/self-hosted-notification-runner.mjs <payload.json> [--provider ntfy|gotify|apprise] [--limit 5] [--check-endpoint] [--send --yes] [--json]");
  }
  const payload = JSON.parse(await readFile(options.payloadPath, "utf8"));
  const plan = buildRunnerPlan(payload, options);
  const endpointResult = options.checkEndpoint ? await checkEndpoint(plan) : null;
  const sendResults = await executeSend(plan, payload);
  if (options.json) {
    console.log(JSON.stringify({ ...plan, endpointResult, sendResults }, null, 2));
    return;
  }
  console.log(`Return & Warranty Guardian self-hosted runner dry-run`);
  console.log(`Provider: ${plan.provider}`);
  console.log(`Planned reminders: ${plan.plannedCount}/${plan.reminderCount}`);
  if (endpointResult) console.log(`Endpoint check: ${endpointResult.skipped ? "skipped" : `${endpointResult.status} ${endpointResult.ok ? "ok" : "failed"}`}`);
  plan.warnings.forEach((warning) => console.log(`Warning: ${warning}`));
  sendResults.forEach((result) => console.log(`Send result: ${result.status} ${result.ok ? "ok" : "failed"} ${result.title}`));
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
