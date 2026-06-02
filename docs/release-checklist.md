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
- Browser QA confirms default Korean language, eight language options, local attachment save/skipped status and download visibility, local HTML/PDF receipt extraction, user-confirmed policy templates, calendar import guide visibility, in-app reminder snooze controls, self-hosted notification payload export, CSV import preview with built-in/manual column mapping plus saved preset, duplicate/invalid row counts, CSV import report export, receipt parsing, search, evidence pack export, claim packet HTML download with PDF save guidance, attachment manifest, attachment evidence, and submission templates, claim bundle JSON/ZIP download, ICS export with repeated alarms, local alert status, CSV export, mobile layout, and no console errors.

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
- Fixture anonymizer or reminder snooze changes.
- Migration or compatibility notes.
- Test evidence.
- Known limitations and V2 backlog items.
