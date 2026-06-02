# Return & Warranty Guardian

Return & Warranty Guardian helps people avoid losing money because a return window, refund period, warranty date, or receipt location slipped past them. It is a local-first purchase memory that runs in your browser, keeps purchase records on your device, and makes deadlines, proof, and claim evidence exportable. No account, no server upload, no cloud vault required.

> Never miss a return window or warranty again.
> 기본 언어는 한국어이며, 영어, 일본어, 중국어, 독일어, 프랑스어, 이탈리아어, 힌디어 UI로 전환할 수 있습니다.

## Why It Exists

![Return & Warranty Guardian desktop dashboard](docs/assets/desktop.png)

Buying things creates a scattered trail: receipts in email, model numbers on boxes, warranty cards in drawers, service notes in messages, and return policies that expire quietly. This app turns that trail into a private local deadline desk.

Core values:

- **Local-first:** records stay in browser storage unless you export them.
- **Privacy-friendly:** no backend, no account, no upload path.
- **Exportable:** JSON backup, CSV review, `.ics` calendar reminders, and Markdown evidence packs.

## Live Demo

Try the static demo on GitHub Pages:

https://cloud7-dev.github.io/return-warranty-guardian/

## What It Does

- Tracks return, refund, and warranty deadlines from one local dashboard.
- Stores purchases in browser storage with JSON export/import.
- Stores local receipt, PDF, manual, and warranty-card attachments in the browser record, with save/skipped status for over-size files.
- Previews CSV purchase rows before import, supports built-in presets for card/order exports including Korean card statements, Korean shopping orders, and Amazon-style order history, plus saved user presets, manual column mapping, duplicate skipping, and invalid row reporting locally.
- Shows a local CSV import review checklist, lets users exclude individual importable rows before confirm, filters staged import rows for review, validates CSV preset bundle compatibility, and exports/imports preset bundles with trust metadata for sharing column mappings without purchase rows.
- Exports a local CSV import report for audit/debugging before the import is confirmed.
- Extracts local text, CSV, HTML/email receipts, simple PDF text operators, scanned/compressed PDF fallback diagnostics, and supported browser-local image OCR into the receipt parser without upload.
- Applies user-confirmed policy templates with evidence requirements, source/version metadata, and country/jurisdiction disclaimers without fetching merchant data.
- Includes a synthetic fixture corpus for CSV presets, email receipt extraction, PDF text extraction/scanned fallback diagnostics, local OCR text results, notification runner payloads, and policy-template coverage.
- Provides a local fixture anonymizer for turning private examples into privacy-safe test fixtures before contribution.
- Parses pasted receipt or invoice text into candidate line items.
- Splits one receipt into multiple tracked purchase records.
- Exports claim-ready evidence packs as Markdown.
- Exports printable HTML claim packets with local attachment links/previews, PDF save guidance, attachment manifests, and submission templates that can be saved as PDF from the browser print dialog.
- Exports claim bundle JSON with the purchase record, deadline math, evidence pack Markdown, claim HTML, submission templates, and local attachment data URLs.
- Exports a ZIP claim bundle with HTML, Markdown, JSON, submission template files, and attached local files.
- Exports `.ics` calendar reminders with per-purchase lead-day alarms for purchase deadlines.
- Supports browser notifications and 3-hour/tomorrow/7-day reminder snooze controls while the app is open, with `.ics` export as the no-server mobile/desktop fallback.
- Stores optional self-hosted notification draft settings locally and exports payload/dry-run drafts for ntfy, Gotify, or Apprise without sending data from the app.
- Includes a local self-hosted notification runner dry-run CLI for scheduler planning without storing tokens or sending requests.
- Exports CSV records for spreadsheet review.
- Tracks category, room/location, support contact, document names, and service notes for warranty claims and home-history context.
- Switches the interface between Korean, English, Japanese, Chinese, German, French, Italian, and Hindi.
- Works as a static web app with a PWA manifest and service worker.

## Product Boundary

Return & Warranty Guardian focuses on receipts, returns, refunds, warranties, and claim evidence. Emergency or family binder workflows are intentionally separate so the first screen stays deadline-first. See [docs/product-boundaries.md](docs/product-boundaries.md).

## Quick Start

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:4180
```

No install step is required. The app has no runtime dependencies.

## Verification

```bash
npm test
npm run build
npm run qa:browser
```

`npm test` covers the deadline engine, receipt text parser, CSV import analysis, mapping presets, preset bundle export/validation/trust metadata, review checklist/filter generation, fixture corpus coverage, local HTML/PDF text extraction, scanned/compressed PDF fallback diagnostics, local OCR text result parsing, local OCR engine planning, policy templates with source/version metadata, import reports, evidence pack export, claim packet HTML/JSON/ZIP bundle export, claim submission templates, self-hosted notification payload, provider fixture plans, scheduler recipes, dry-run settings, and runner CLI output, CSV export, and calendar export with alarms. `npm run build` verifies static file references, PWA manifest basics, service worker cache entries, responsive CSS, and required UI copy. `npm run qa:browser` runs browser interaction checks for language switching, local attachments, local HTML/PDF receipt extraction, scanned PDF fallback, policy templates, calendar guide visibility, CSV preview/presets/manual mapping/deduplication/row selection/report/preset-bundle export and import, claim packet template/JSON/ZIP bundle download, local alert status, self-hosted settings and dry-run export, exports, search, and mobile screenshots.

To prepare a privacy-safe fixture from a local sample:

```bash
npm run fixture:anonymize -- path/to/private-sample.csv
```

Review the generated file before committing it. Do not commit private receipts or real card statements.
Accepted sample intake entries are tracked in `tests/fixtures/intake/sample-intake.json`; see `docs/sample-intake.md`.

To verify the synthetic fixture corpus:

```bash
npm run fixture:validate
```

Preset bundles include a SHA-256 fingerprint-ready signing payload and ECDSA P-256 detached signature verification helpers so community mappings can move from local drafts toward reviewed signatures without embedding purchase rows.

To inspect a self-hosted notification payload without sending anything:

```bash
npm run notify:dry-run -- return-warranty-guardian-self-hosted-alerts.json --json
```

The runner prints command previews only. Keep provider tokens outside this app and use your own scheduler if you decide to send notifications.
Actual sending is opt-in and requires `--send --yes` plus `RWG_NOTIFY_SEND=1`; Gotify also requires `GOTIFY_TOKEN` in the runner environment.
Provider-specific fixture payloads live in `tests/fixtures/notifications`, and the operating guide is in `docs/self-hosted-notification-runner.md`.
Platform fallback guidance is in `docs/notification-fallback-guide.md`.

To run the local loopback endpoint smoke test for ntfy/Gotify send mode:

```bash
npm run notify:smoke
```

To convert a smoke output JSON into a sanitized record without raw endpoint URLs or tokens:

```bash
npm run notify:record -- smoke-output.json
```

## Privacy Model

Return & Warranty Guardian does not include a backend. Purchases are stored in browser storage on the current device. Clearing site data can delete purchases, so use JSON export for backups.

Local OCR/text extraction is intentionally no-upload. The current implementation handles text, CSV, HTML/email receipts, simple PDF text operators, scanned/compressed PDF fallback diagnostics, and image OCR through a local OCR adapter when the browser exposes `TextDetector` or a future bundled worker. If image OCR is not available in the current browser, the app keeps the flow local and asks the user to paste receipt text instead of calling a cloud OCR service.

This project is a tracking and evidence-organization tool. It does not guarantee that a merchant will accept a return, refund, or warranty claim.

## Notifications

The current no-server notification path is `.ics` calendar export with `VALARM` lead-day reminders. Mobile users can import deadlines into iOS, Google, or Samsung Calendar; desktop users can import them into macOS Calendar, Outlook, Google Calendar, or Windows Calendar. The app can also show local browser notifications while it is open, snooze reminders for 3 hours/tomorrow/7 days, and store optional self-hosted draft settings locally. See [docs/notification-strategy.ko.md](docs/notification-strategy.ko.md) for the Korean notification plan.
See [docs/notification-fallback-guide.md](docs/notification-fallback-guide.md) for mobile/desktop fallback choices and opt-in public endpoint smoke testing.

## Consolidation

This repository is the consolidation target for the overlapping `return-guardian` and `home-memory-ledger` experiments. See [docs/consolidation-review.ko.md](docs/consolidation-review.ko.md) for the GitHub comparison and V2 merge direction.

## MVP Workflow

1. Add a purchase manually or paste receipt text.
2. Confirm product, merchant, purchase date, return window, refund window, and warranty duration.
3. Watch the deadline queue for due-soon or expired items.
4. Export an evidence pack before contacting the merchant.
5. Export `.ics` reminders, CSV review files, or a JSON backup when needed.

## Repository Topics

Recommended GitHub topics:

`local-first`, `privacy`, `privacy-tools`, `receipt-tracker`, `warranty-tracker`, `return-tracker`, `purchase-tracker`, `home-inventory`, `home-maintenance`, `personal-finance`, `pwa`, `offline-first`, `indexeddb`, `self-hosted`, `document-management`, `consumer-tools`, `i18n`, `multilingual`, `open-source`.

## Roadmap

See [docs/feature-backlog.md](docs/feature-backlog.md).

V2 open pain has been reflected into the product direction, but not all V2 features are implemented yet. See [docs/v2-implementation-checklist.ko.md](docs/v2-implementation-checklist.ko.md) for the implementation status.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [docs/release-checklist.md](docs/release-checklist.md).

## License

Apache-2.0
