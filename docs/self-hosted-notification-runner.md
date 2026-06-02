# Self-hosted Notification Runner

Return & Warranty Guardian does not run a server and does not upload purchase records. The web app only exports reviewed payloads and command drafts for user-managed notification tools.

## Dry-run first

```bash
npm run notify:dry-run -- path/to/payload.json --provider ntfy --limit 3 --json
```

Dry-run mode prints the provider, reminder count, endpoint-check plan, warnings, command previews, and scheduler recipes. Endpoint checks are metadata-only and must not send purchase details.

## Provider fixtures

Synthetic payload fixtures live in `tests/fixtures/notifications`:

- `ntfy-payload.json`: topic URL plan such as `https://alerts.example.test/returns`
- `gotify-payload.json`: `/message` endpoint plan with token kept outside the payload
- `apprise-payload.json`: command-preview-only flow for an external Apprise installation

Run this before accepting new payload examples:

```bash
npm run fixture:validate
```

The validator checks provider coverage, `example.test` endpoints, planned reminder counts, and that dry-run endpoint checks do not send purchase data.

## Loopback smoke test

The repo includes a local endpoint smoke test for explicit send mode:

```bash
npm run notify:smoke
```

The script starts a loopback HTTP server, rewrites the ntfy/Gotify fixture payloads to that local endpoint, runs the real runner with `--send --yes`, and verifies the received POST body/headers. It does not contact public notification services. Apprise remains command-preview-only because the runner intentionally does not own an Apprise installation.

To smoke-test a real endpoint you control, set `RWG_NOTIFY_PUBLIC_SMOKE=1` plus provider-specific endpoint variables. This is deliberately excluded by default so CI and local tests do not contact public services.

Maintainers can also run the manual GitHub Actions workflow `Notification Smoke` with provider, endpoint, and topic inputs. Gotify runs require the repository secret `GOTIFY_TOKEN`.
The same workflow is scheduled weekly and skips safely unless `RWG_NOTIFY_PUBLIC_ENDPOINT` is configured as a repository variable.

To keep an auditable result without leaking endpoint URLs or tokens, save the smoke JSON output and convert it to a sanitized record:

```bash
npm run notify:record -- smoke-output.json
```

Sanitized records keep status codes, provider names, loopback counts, and a SHA-256 hash of the endpoint host only.

To turn downloaded sanitized records into a human-readable operations summary:

```bash
npm run notify:ops-report -- path/to/smoke-records tests/fixtures/notifications/smoke-policy.json
```

The report is Markdown and should remain free of raw endpoint URLs, topics, tokens, authorization headers, and reminder bodies. The GitHub Actions smoke workflow uploads `ops-report.md` with the sanitized JSON artifact after a successful public endpoint smoke.

## Actual send guard

Actual sending is off by default. It requires all of the following:

- CLI flag: `--send`
- Confirmation flag: `--yes`
- Environment variable: `RWG_NOTIFY_SEND=1`
- Enabled payload settings
- No runner warnings

Gotify additionally requires `GOTIFY_TOKEN` in the runner environment. Tokens must not be stored in app state or fixture files.

Apprise send mode is intentionally command-preview-only in this runner. Users can copy the preview into their own Apprise installation if they accept that external tool's behavior.

## Scheduler recipes

The runner exposes recipe text in JSON output:

```bash
npm run notify:dry-run -- path/to/payload.json --provider ntfy --limit 3 --json
```

Use the recipe as a starting point only. The default command remains a dry-run. Add real send flags only after reviewing the payload, endpoint, and local secret handling.
