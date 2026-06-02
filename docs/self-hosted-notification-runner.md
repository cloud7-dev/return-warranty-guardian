# Self-hosted Notification Runner

Return & Warranty Guardian does not run a server and does not upload purchase records. The web app only exports reviewed payloads and command drafts for user-managed notification tools.

## Dry-run first

```bash
npm run notify:dry-run -- path/to/payload.json --provider ntfy --limit 3 --json
```

Dry-run mode prints the provider, reminder count, endpoint-check plan, warnings, and command previews. Endpoint checks are metadata-only and must not send purchase details.

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

## Actual send guard

Actual sending is off by default. It requires all of the following:

- CLI flag: `--send`
- Confirmation flag: `--yes`
- Environment variable: `RWG_NOTIFY_SEND=1`
- Enabled payload settings
- No runner warnings

Gotify additionally requires `GOTIFY_TOKEN` in the runner environment. Tokens must not be stored in app state or fixture files.

Apprise send mode is intentionally command-preview-only in this runner. Users can copy the preview into their own Apprise installation if they accept that external tool's behavior.
