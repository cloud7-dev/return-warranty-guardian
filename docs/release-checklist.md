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
- Browser QA confirms default Korean language, eight language options, receipt parsing, search, evidence pack export, ICS export, CSV export, mobile layout, and no console errors.

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

## GitHub Metadata

Confirm:

- Repository description stays focused on local-first receipts, returns, refunds, and warranties.
- Topics include `local-first`, `privacy-tools`, `receipt-tracker`, `warranty-tracker`, `return-tracker`, `consumer-tools`, `pwa`, `offline-first`, `i18n`, `multilingual`, `document-management`, `csv-export`, `home-inventory`, and `home-maintenance`.
- Consolidated historical repositories still point to this repository.

## Release Notes

Release notes should include:

- User-facing changes.
- Privacy/storage/export changes.
- Migration or compatibility notes.
- Test evidence.
- Known limitations and V2 backlog items.
