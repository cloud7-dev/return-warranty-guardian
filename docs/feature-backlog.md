# Feature Backlog Review

This list separates high-leverage additions from features that could distract the MVP.

## V2: Still Underserved User Pain

1. **Reliable notifications without a server**
   - Users want mobile and PC reminders even when the web app is closed.
   - Calendar export works today, but true background push conflicts with the no-server promise unless it is opt-in or self-hosted.

2. **More durable local attachments**
   - Receipt images, PDFs, manuals, and warranty cards can now be stored in the browser record.
   - Remaining pain: attachments still depend on browser site data. OPFS, encrypted export bundles, or a desktop wrapper are stronger V2 candidates than a hosted file vault.

3. **Messy receipt and policy extraction**
   - Real receipts arrive as screenshots, email HTML, PDFs, Kakao/DM screenshots, and retailer order pages.
   - Local text/PDF extraction is now connected to the parser, and image OCR works when the browser exposes local `TextDetector` support. A bundled cross-browser OCR engine and user-confirmed merchant policy templates are still needed before the app can reduce manual entry enough.

4. **Warranty claim packet quality**
   - Users need a clean support packet with receipt, serial/model, photos, repair history, manuals, and merchant conversation notes.
   - Printable HTML claim packets now include local attachment links and image previews. V2 still needs export bundles and merchant-specific submission templates.

5. **Home appliance and repair history**
   - Warranty issues often depend on where an item is installed, who repaired it, which manual applies, and what service happened before.
   - V2 should absorb the useful parts of Home Memory Ledger without becoming a generic home ERP.

6. **Cross-device continuity without cloud lock-in**
   - Users buy on mobile, search on desktop, and need the same records later.
   - JSON export is safe but manual. V2 needs encrypted backup, local network sync, or self-hosted sync options.

## High-Leverage Next Features

1. **Synthetic receipt fixture corpus**
   - Lets contributors improve parsing without sharing private receipts.
   - Good for GitHub stars because it makes the project hackable.

2. **Merchant policy templates**
   - Community-editable return/refund defaults by merchant and country.
   - Must stay user-confirmed because policies vary by item and season.

3. **Attachment handling**
   - Receipt image/PDF storage, manuals, warranty cards, image compression, and warning for large files.
   - Export bundle should include evidence pack plus attachments.

4. **Encrypted backup**
   - User-chosen passphrase for JSON export.
   - Keeps local-first story while reducing data-loss risk.

5. **Importers**
   - CSV import now covers a basic purchase-row format with preview, duplicate detection, and row-level error reporting.
   - Remaining work: card statement presets, retailer order export presets, user-editable field mapping, and import report export.

6. **Optional OCR**
   - Text, CSV, simple PDF text extraction, and supported browser-local image OCR now run locally in the browser.
   - A bundled cross-browser image OCR engine is still needed if practical.
   - Cloud OCR should be explicitly opt-in and disabled by default.

7. **Local notification upgrade**
   - Better reminder scheduling, repeated alerts, and platform-specific fallback copy.
   - Calendar export should remain available because browser notifications are inconsistent.

8. **Claim packet HTML/PDF**
   - Printable HTML claim packet exists with attachment links and image previews, and can be saved as PDF from the browser print dialog.
   - Remaining work: ZIP/HTML export bundles, richer merchant templates, and chargeback-oriented variants.

9. **Price-protection watcher**
   - Manual or optional watch entries for price drops within refund/price-adjustment periods.
   - Must avoid retailer scraping by default.

10. **Recall and safety notes**
    - Optional product recall references by model/serial.
    - Needs careful source attribution and country-specific disclaimers.

## Lower Priority

- Full account sync.
- Retailer login automation.
- AI-generated complaint letters as the primary feature.
- Complex inventory management.
- Team or household collaboration.

## Differentiation Guardrails

- Keep the first screen deadline-first.
- Keep no-server architecture verifiable.
- Keep parsed fields editable.
- Prefer exportable data over lock-in.
- Do not compete as a generic document archive.
