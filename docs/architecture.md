# Architecture

Return & Warranty Guardian is currently a static local web app.

## Runtime Shape

```text
Browser
  index.html
  styles.css
  src/app.js
    deadline-engine.js
    receipt-parser.js
    importers.js
    storage.js
    exporters.js
IndexedDB or localStorage fallback
```

There is no API server and no account system. All purchase data remains in browser storage unless the user exports it.

## Core Modules

- `src/deadline-engine.js`: date math, deadline status, dashboard summaries.
- `src/receipt-parser.js`: deterministic pasted-text parser for receipts and invoices.
- `src/importers.js`: CSV parsing, preset/manual field mapping, purchase-row normalization, duplicate detection, invalid-row reporting, and import report generation.
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
  "source": "manual",
  "hasReceipt": true,
  "notes": "Box and accessories required for return.",
  "status": "active",
  "createdAt": "2026-06-02T00:00:00.000Z"
}
```

Deadlines are derived, not stored. This keeps deadline math transparent and reproducible.

CSV imports are staged in an in-memory preview before they are saved. The app imports valid new rows, supports auto-detected, built-in preset, saved user preset, and manual field mapping, skips duplicates based on product name, merchant, and purchase date, and reports required-field errors without uploading the source file. User CSV presets are stored in browser `localStorage`.

Local OCR/text extraction is handled in the browser. Text, CSV, HTML/email, and simple PDF text paths are file reads; image OCR uses browser-local `TextDetector` only when the current browser supports it.

Claim packet exports are generated locally from the selected purchase record. The HTML packet, JSON bundle, and ZIP bundle include starter submission templates for merchant returns, warranty support, chargeback evidence summaries, and repair intake notes.
