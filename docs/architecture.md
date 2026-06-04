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
    backup.js
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
- `src/backup.js`: encrypted `.rwgbackup` envelope creation, WebCrypto key derivation/encryption/decryption, backup payload construction, restore preview, and duplicate-aware merge.
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
  "priceProtectionDays": 30,
  "priceProtectionPolicyNote": "30-day price adjustment candidate. Verify merchant policy.",
  "lastSeenPrice": 119.99,
  "priceCheckUrl": "https://example.test/product",
  "priceCheckedAt": "2026-06-04",
  "recallReferenceUrl": "https://example.test/official-recall",
  "safetyNote": "Verify official recall and safety status before claim.",
  "safetyCheckedAt": "",
  "safetyRegion": "KR",
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
      "storage": "opfs",
      "opfsPath": "purchase-123/receipt.pdf",
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

Deadlines are derived, not stored. This keeps deadline math transparent and reproducible. Price-protection deadlines are also derived from `purchaseDate + priceProtectionDays`; a price adjustment candidate is shown only when the user-entered `lastSeenPrice` is lower than the purchase price and the price-protection deadline has not expired.

Recall and safety fields are manual notes, not an external lookup result. The app stores user-confirmed URLs, regions, notes, and checked-at dates so evidence exports can preserve what the user verified. It does not scrape retailer pages, sign in to accounts, or query recall databases.

Attachments are captured through `src/attachment-storage.js`. Browsers with Origin Private File System support store accepted attachment Blobs outside the purchase JSON and keep only local metadata plus `opfsPath`; browsers without OPFS fall back to the previous data URL record format. Claim exports and attachment downloads hydrate OPFS attachments back into data URLs only at export/download time, keeping the saved purchase record smaller while preserving the existing export surface.

Encrypted backup is a separate export surface from plain JSON. `backupPayloadFromState` builds a payload with purchase records, user CSV presets, self-hosted notification draft settings, snooze state, and attachment payloads hydrated from OPFS/data URLs. Attachments over 5 MB or hydration failures are retained as metadata and recorded in `backupManifest.skippedAttachments`. `encryptedBackupEnvelope` encrypts the payload with PBKDF2-SHA256 plus AES-GCM and writes `return-warranty-guardian-backup.rwgbackup`; the passphrase is used only for key derivation and is not saved in app state or storage. Restore reads the envelope, prompts for the passphrase, decrypts locally, shows a preview, and merges only non-duplicate purchases. Duplicate candidates are detected by `productName + merchant + purchaseDate`; destructive overwrite is intentionally out of scope.

CSV imports are staged in an in-memory preview before they are saved. The app imports selected valid rows, supports auto-detected, built-in preset, saved user preset, and manual field mapping, skips duplicates based on product name, merchant, and purchase date, and reports required-field errors without uploading the source file. Built-in presets cover generic card/order exports, Korean card statements, Korean shopping orders, Amazon-style order history, Shopify-style order exports, and Stripe-style receipt exports. User CSV presets and preset bundles are stored or imported through browser `localStorage` without purchase rows. `csvImportReviewChecklist` adds a local pre-import checklist for required mappings, duplicates, invalid rows, and missing proof markers. `csvImportReviewFilters` gives large imports a query/proof filter surface before confirmation. `validateCsvPresetBundle` rejects unsupported schema/version values and strips unsupported mapping fields with warnings; preset bundles carry trust model, signature status, source, review date, and fixture coverage metadata.

Local OCR/text extraction is handled in the browser. Text, CSV, HTML/email, and simple PDF text-operator paths are file reads; image OCR goes through `localOcrEnginePlan` and `textFromImageSource`, choosing the bundled PBM template worker, browser-local `TextDetector`, or manual fallback without cloud calls. `pdfExtractionDiagnostics` classifies PDFs as text-operator, scanned/compressed, or plain fallback and records image/compression/encryption signals; compressed or scanned PDFs that do not expose text operators first try `textFromScannedPdfWithBundledOcr` for embedded PBM template streams, then fall back to a no-upload notice instead of calling cloud OCR. Users can paste local OCR sidecar text, attach a local `.txt` sidecar file, or select a scanned PDF together with a matching `.ocr.txt` sidecar named after the PDF. The app pairs that sidecar locally, routes it through `textFromScannedPdfWithLocalOcr`, and then runs the receipt parser without uploading the PDF or OCR output.

Notification behavior stays serverless. Each purchase can store `reminderLeadDays`; `.ics` exports include repeated `VALARM` entries using that lead time and a one-day reminder, and browser notifications are only attempted while the app is open and the user grants notification permission. Reminder snooze state is stored separately in `localStorage` under `rwg:snoozed-reminders` and supports 3-hour, tomorrow, and 7-day snoozes.

Self-hosted notification support is export-only in the web app. Optional provider/endpoint/topic settings are stored locally under `rwg:self-hosted-alerts`; `selfHostedNotificationPayload` creates reviewed JSON/curl drafts for ntfy, Gotify, and Apprise, and `selfHostedDryRunReport` checks local settings and external-runner requirements. `scripts/self-hosted-notification-runner.mjs` can read the payload and print scheduler-ready dry-run commands plus macOS/Linux/Windows scheduler recipes. Its send mode is opt-in only, requiring `--send --yes` plus `RWG_NOTIFY_SEND=1`; provider tokens stay outside the app in runner environment variables. Provider fixture payloads under `tests/fixtures/notifications` verify ntfy, Gotify, and Apprise endpoint plans without sending purchase data.

Claim packet exports are generated locally from the selected purchase record. The HTML packet, JSON bundle, and ZIP bundle include browser-specific PDF save guidance, claim profile and jurisdiction hints, attachment export review, attachment manifests, price-protection details, recall/safety notes with official-source disclaimers, starter submission templates for merchant returns, warranty support, chargeback evidence summaries, and repair intake notes.

Tests use `tests/fixtures` as a synthetic corpus for CSV presets, HTML receipt extraction, PDF text-operator extraction, scanned/compressed PDF fallback behavior, self-hosted notification runner payloads, and user-confirmed policy template defaults. `scripts/validate-fixtures.mjs` checks fixture importability, PDF fallback coverage, provider endpoint plans, source/license metadata, and common private-data patterns. Private receipts or real card statements should not be committed.

`npm run fixture:anonymize -- <input-file>` writes a sanitized draft fixture. It is a helper, not a guarantee; generated samples still need manual review before commit.
