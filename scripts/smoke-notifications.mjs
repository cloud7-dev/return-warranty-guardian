import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function bodyFrom(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function runRunner(payloadPath, provider, env = {}) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/self-hosted-notification-runner.mjs", payloadPath, "--provider", provider, "--limit", "1", "--send", "--yes", "--json"],
    {
      env: { ...process.env, RWG_NOTIFY_SEND: "1", ...env },
    },
  );
  return JSON.parse(stdout);
}

async function main() {
  const requests = [];
  const server = createServer(async (request, response) => {
    const body = await bodyFrom(request);
    requests.push({ method: request.method, url: request.url, headers: request.headers, body });
    response.writeHead(204).end();
  });
  const address = await listen(server);
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const tempDir = await mkdtemp(join(tmpdir(), "rwg-notify-smoke-"));

  try {
    const ntfyPayload = JSON.parse(await readFile("tests/fixtures/notifications/ntfy-payload.json", "utf8"));
    ntfyPayload.settings.endpoint = baseUrl;
    ntfyPayload.providers.ntfy.curl = `curl -H 'Title: Return & Warranty Guardian' -d '<message>' ${baseUrl}/returns`;
    const ntfyPath = join(tempDir, "ntfy.json");
    await writeFile(ntfyPath, JSON.stringify(ntfyPayload, null, 2));
    const ntfyResult = await runRunner(ntfyPath, "ntfy");

    const gotifyPayload = JSON.parse(await readFile("tests/fixtures/notifications/gotify-payload.json", "utf8"));
    gotifyPayload.settings.endpoint = baseUrl;
    gotifyPayload.providers.gotify.curl = `curl -H 'Content-Type: application/json' -H 'Authorization: Bearer <token-not-stored>' -d '{"title":"<title>","message":"<message>","priority":5}' ${baseUrl}/message`;
    const gotifyPath = join(tempDir, "gotify.json");
    await writeFile(gotifyPath, JSON.stringify(gotifyPayload, null, 2));
    const gotifyResult = await runRunner(gotifyPath, "gotify", { GOTIFY_TOKEN: "fixture-token" });

    const ntfyPost = requests.find((item) => item.method === "POST" && item.url === "/returns");
    const gotifyPost = requests.find((item) => item.method === "POST" && item.url === "/message");
    if (!ntfyPost?.body.includes("Fixture Audio Store")) throw new Error("ntfy smoke request did not include expected reminder body.");
    if (!gotifyPost?.headers.authorization?.includes("fixture-token")) throw new Error("Gotify smoke request did not include bearer token header.");
    if (!gotifyPost?.body.includes("Fixture Router")) throw new Error("Gotify smoke request did not include expected JSON body.");

    console.log(
      JSON.stringify(
        {
          schema: "return-warranty-guardian.notification-smoke.v1",
          endpoint: baseUrl,
          ntfy: ntfyResult.sendResults[0],
          gotify: gotifyResult.sendResults[0],
          requestCount: requests.length,
          purchaseDataSentOnlyDuringExplicitSend: true,
        },
        null,
        2,
      ),
    );
  } finally {
    await close(server);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
