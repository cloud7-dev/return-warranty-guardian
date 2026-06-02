# Release Checklist

Use this checklist before tagging or announcing a release.

## Local Verification

```bash
npm test
npm run build
npm run qa:browser
```

Expected result:

- Logic tests pass.
- Static file and PWA checks pass.
- Browser QA confirms default Korean language, eight language options, local attachment save/skipped status, OPFS metadata when supported, and download visibility, local HTML/PDF receipt extraction, scanned PDF fallback notice, scanned PDF local OCR sidecar paste/file/auto-pair parsing, user-confirmed policy templates with structured review notes, calendar import guide visibility, in-app 3-hour/tomorrow/7-day reminder snooze controls, self-hosted notification settings, payload export, and dry-run report export, CSV import preview with built-in/manual column mapping plus saved preset, duplicate/invalid row counts, selected-row import behavior, CSV review checklist, CSV import report export, CSV preset bundle export/import, receipt parsing, search, evidence pack export, claim packet HTML download with PDF save guidance, claim profile, attachment export review, attachment manifest, attachment evidence, and submission templates, claim bundle JSON/ZIP download, ICS export with repeated alarms, local alert status, CSV export, mobile layout, and no console errors.
- Logic tests confirm `npm run notify:dry-run` runner planning output without sending network requests.
- Logic tests confirm fixture validation, large CSV review filters, preset trust metadata, fingerprints, detached signature verification, review manifests, local OCR text result parsing, local OCR engine planning, provider payload fixture coverage, scheduler recipes, PDF fallback diagnostics, public smoke readiness reports, sanitized smoke records, smoke record audits, smoke operations reports, and self-hosted send guard behavior. `npm run notify:smoke` confirms loopback ntfy/Gotify send behavior; opt-in public endpoint smoke requires environment variables or the manual `Notification Smoke` workflow and is not part of default CI.
- `npm run fixture:coverage -- tests/fixtures/intake/sample-intake.json` reports fixture coverage and whether reviewed community/public-open-license samples are still missing.
- `npm run fixture:request-pack -- tests/fixtures/intake/sample-intake.json` generates the privacy-safe contributor request pack when new real-world shaped samples are needed.
- `npm run release:readiness -- tests/fixtures/intake/sample-intake.json` summarizes release gates and keeps the remaining numbered work explicit.

## Screenshots

Update `docs/assets/desktop.png` and `docs/assets/mobile.png` only when the UI intentionally changes.

Screenshots should show:

- Korean default UI.
- Deadline queue.
- Purchase form.
- Evidence desk.
- No overlapping text on desktop or mobile.

## Documentation

Check:

- README quick start and verification commands.
- Product boundary wording.
- V2 implementation checklist status.
- Notification strategy.
- Sample intake manifest status.
- Privacy threat model.
- Architecture data model when storage fields change.
- V2 checklist when a backlog item moves from "remaining" to "implemented".

## GitHub Metadata

Confirm:

- Repository description stays focused on local-first receipts, returns, refunds, and warranties.
- Topics include `local-first`, `privacy-tools`, `receipt-tracker`, `warranty-tracker`, `return-tracker`, `consumer-tools`, `pwa`, `offline-first`, `i18n`, `multilingual`, `document-management`, `csv-export`, `home-inventory`, and `home-maintenance`.
- Consolidated historical repositories still point to this repository.
- GitHub Pages points to `https://cloud7-dev.github.io/return-warranty-guardian/`.

## Release Notes

Release notes should include:

- User-facing changes.
- Privacy/storage/export changes.
- Import/OCR/claim packet behavior changes.
- Claim submission template changes.
- Notification, calendar alarm, or policy template changes.
- Fixture corpus additions and privacy-safe sample notes.
- Fixture coverage report status, especially whether accepted samples are synthetic-only.
- Fixture request pack status when asking for new anonymized-community or public-open-license samples.
- Release readiness report status and the still-open numbered items.
- Sample intake or sanitized smoke record additions.
- Notification smoke operations report changes.
- Fixture anonymizer or reminder snooze changes.
- Migration or compatibility notes.
- Test evidence.
- Known limitations and V2 backlog items.
