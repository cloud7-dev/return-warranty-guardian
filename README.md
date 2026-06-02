# Return & Warranty Guardian

Return & Warranty Guardian is a local-first purchase memory for receipts, return windows, refund deadlines, and warranties. It runs in your browser, stores your purchase data on your device, and helps you see what needs action before money is lost. No account, no server upload, no cloud vault required: just a private deadline desk for the things you buy.

> Never miss a return window or warranty again.
> 기본 언어는 한국어이며, 영어, 일본어, 중국어, 독일어, 프랑스어, 이탈리아어, 힌디어 UI로 전환할 수 있습니다.

## What It Does

![Return & Warranty Guardian desktop dashboard](docs/assets/desktop.png)

- Tracks return, refund, and warranty deadlines from one local dashboard.
- Stores purchases in browser storage with JSON export/import.
- Parses pasted receipt or invoice text into candidate line items.
- Splits one receipt into multiple tracked purchase records.
- Exports claim-ready evidence packs as Markdown.
- Exports `.ics` calendar reminders for purchase deadlines.
- Exports CSV records for spreadsheet review.
- Tracks category, room/location, support contact, document names, and service notes for warranty claims and home-history context.
- Switches the interface between Korean, English, Japanese, Chinese, German, French, Italian, and Hindi.
- Works as a static web app with a PWA manifest and service worker.

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
```

`npm test` covers the deadline engine, receipt text parser, evidence pack export, and calendar export. `npm run build` verifies static file references, PWA manifest basics, service worker cache entries, responsive CSS, and required UI copy.

## Privacy Model

Return & Warranty Guardian does not include a backend. Purchases are stored in browser storage on the current device. Clearing site data can delete purchases, so use JSON export for backups.

This project is a tracking and evidence-organization tool. It does not guarantee that a merchant will accept a return, refund, or warranty claim.

## Notifications

The current no-server notification path is `.ics` calendar export. Mobile users can import deadlines into iOS, Google, or Samsung Calendar; desktop users can import them into macOS Calendar, Outlook, Google Calendar, or Windows Calendar. See [docs/notification-strategy.ko.md](docs/notification-strategy.ko.md) for the Korean notification plan.

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

## License

Apache-2.0
