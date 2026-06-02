# Architecture

Return & Warranty Guardian is currently a static local web app.

## Runtime Shape

```text
Browser
  index.html
  styles.css
  src/app.js
    deadline-engine.js
    fixture-sanitizer.js
    receipt-parser.js
    importers.js
    local-extraction.js
    policy-templates.js
    storage.js
    exporters.js
IndexedDB or localStorage fallback
```

There is no API server and no account system. All purchase data remains in browser storage unless the user exports it.

## Core Modules

- `src/deadline-engine.js`: date math, deadline status, dashboard summaries.
- `src/fixture-sanitizer.js`: local text/filename sanitizers for privacy-safe fixture drafts.
- `src/receipt-parser.js`: deterministic pasted-text parser for receipts and invoices.
- `src/importers.js`: CSV parsing, preset/manual field mapping, purchase-row normalization, duplicate detection, invalid-row reporting, and import report generation.
- `src/local-extraction.js`: local PDF text operator extraction helpers used before the receipt parser.
- `src/policy-templates.js`: user-confirmed return/refund/warranty policy helper templates.
- `src/storage.js`: IndexedDB persistence with localStorage fallback.
- `src/exporters.js`: Markdown evidence pack, printable claim packet HTML with attachment evidence and submission templates, claim bundle JSON/ZIP, CSV export, and `.ics` calendar export.
- `src/app.js`: UI composition, local state, event handling, import/export.
- `src/i18n.js`: Korean-default multilingual UI dictionary.

## Data Model

```json
{
  "id": "purchase-...",
  "productName": "Wireless Headset",
  "merchant": "Example Electronics",
  "purchaseDate": "2026-06-02",
  "price": 129.99,
  "returnWindowDays": 30,
  "refundWindowDays": 14,
  "warrantyMonths": 12,
  "reminderLeadDays": 5,
  "model": "HX-220",
  "serial": "DEMO-HX220-001",
  "category": "Electronics",
  "room": "Home office",
  "supportContact": "support@example.test",
  "documents": ["receipt.pdf", "manual.pdf"],
  "attachments": [
    {
      "name": "warranty-card.pdf",
      "type": "application/pdf",
      "size": 128,
      "dataUrl": "data:application/pdf;base64,...",
      "createdAt": "2026-06-02T00:00:00.000Z"
    }
  ],
  "serviceNotes": "No repairs yet.",
  "policyTemplateId": "standard-30-day-return",
  "source": "manual",
  "hasReceipt": true,
  "notes": "Box and accessories required for return.",
  "status": "active",
  "createdAt": "2026-06-02T00:00:00.000Z"
}
```

Deadlines are derived, not stored. This keeps deadline math transparent and reproducible.

CSV imports are staged in an in-memory preview before they are saved. The app imports selected valid rows, supports auto-detected, built-in preset, saved user preset, and manual field mapping, skips duplicates based on product name, merchant, and purchase date, and reports required-field errors without uploading the source file. Built-in presets cover generic card/order exports, Korean card statements, Korean shopping orders, and Amazon-style order history. User CSV presets and preset bundles are stored or imported through browser `localStorage` without purchase rows. `csvImportReviewChecklist` adds a local pre-import checklist for required mappings, duplicates, invalid rows, and missing proof markers. `validateCsvPresetBundle` rejects unsupported schema/version values and strips unsupported mapping fields with warnings.

Local OCR/text extraction is handled in the browser. Text, CSV, HTML/email, and simple PDF text-operator paths are file reads; image OCR uses browser-local `TextDetector` only when the current browser supports it. `pdfExtractionStatus` classifies PDFs as text-operator, scanned/compressed, or plain fallback; compressed or scanned PDFs that do not expose text operators produce a no-upload fallback notice instead of calling cloud OCR.

Notification behavior stays serverless. Each purchase can store `reminderLeadDays`; `.ics` exports include repeated `VALARM` entries using that lead time and a one-day reminder, and browser notifications are only attempted while the app is open and the user grants notification permission. Reminder snooze state is stored separately in `localStorage` under `rwg:snoozed-reminders` and supports 3-hour, tomorrow, and 7-day snoozes.

Self-hosted notification support is export-only in the web app. Optional provider/endpoint/topic settings are stored locally under `rwg:self-hosted-alerts`; `selfHostedNotificationPayload` creates reviewed JSON/curl drafts for ntfy, Gotify, and Apprise, and `selfHostedDryRunReport` checks local settings and external-runner requirements. `scripts/self-hosted-notification-runner.mjs` can read the payload and print scheduler-ready dry-run commands, but it does not store tokens or send notification requests.

Claim packet exports are generated locally from the selected purchase record. The HTML packet, JSON bundle, and ZIP bundle include PDF save guidance, attachment manifests, starter submission templates for merchant returns, warranty support, chargeback evidence summaries, and repair intake notes.

Tests use `tests/fixtures` as a synthetic corpus for CSV presets, HTML receipt extraction, PDF text-operator extraction, scanned/compressed PDF fallback behavior, and user-confirmed policy template defaults. Private receipts or real card statements should not be committed.

`npm run fixture:anonymize -- <input-file>` writes a sanitized draft fixture. It is a helper, not a guarantee; generated samples still need manual review before commit.
