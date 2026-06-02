# Notification Fallback Guide

Return & Warranty Guardian stays local-first and serverless. Notification behavior is therefore layered by reliability and user control.

## Mobile

1. Export `.ics` deadlines and import them into iOS Calendar, Google Calendar, or Samsung Calendar.
2. Keep browser-local alerts as an in-app convenience only; they require the app to be open.
3. Use self-hosted ntfy/Gotify only when you control the endpoint and accept sending reviewed reminder text to that service.

## Desktop

1. Export `.ics` deadlines to macOS Calendar, Outlook, Google Calendar, or Windows Calendar.
2. Use browser-local alerts while the app is open for same-session reminders.
3. Use `npm run notify:dry-run` to inspect a payload before scheduling.
4. Use `npm run notify:smoke` for loopback verification before trying a real endpoint.

## Self-hosted Endpoint Smoke

Loopback smoke is safe for CI and local development because it does not contact public services:

```bash
npm run notify:smoke
```

Public/self-hosted endpoint smoke is opt-in only:

```bash
RWG_NOTIFY_PUBLIC_SMOKE=1 \
RWG_NOTIFY_PUBLIC_PROVIDER=ntfy \
RWG_NOTIFY_PUBLIC_ENDPOINT=https://ntfy.example.test \
RWG_NOTIFY_PUBLIC_TOPIC=returns \
npm run notify:smoke
```

For Gotify, set `RWG_NOTIFY_PUBLIC_PROVIDER=gotify`, `RWG_NOTIFY_PUBLIC_ENDPOINT`, and `GOTIFY_TOKEN`. Do not store tokens in app data, fixtures, or preset bundles.

Repository maintainers can trigger the manual GitHub Actions workflow `Notification Smoke` for a real endpoint they control. This workflow is intentionally `workflow_dispatch` only.

After a real endpoint run, convert the raw smoke output into a sanitized record before sharing or committing evidence:

```bash
npm run notify:record -- smoke-output.json
```

## OCR Fallback

Image OCR is local only. The app tries a bundled local worker if one exists, then browser `TextDetector`, then manual paste/attachment fallback. Scanned PDFs without text operators stay as local claim evidence unless the user supplies local OCR text.
