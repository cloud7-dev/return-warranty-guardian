# Feature Backlog Review

This list separates high-leverage additions from features that could distract the MVP.

## High-Leverage Next Features

1. **Synthetic receipt fixture corpus**
   - Lets contributors improve parsing without sharing private receipts.
   - Good for GitHub stars because it makes the project hackable.

2. **Merchant policy templates**
   - Community-editable return/refund defaults by merchant and country.
   - Must stay user-confirmed because policies vary by item and season.

3. **Attachment handling**
   - Receipt image/PDF storage, image compression, and warning for large files.
   - Export bundle should include evidence pack plus attachments.

4. **Encrypted backup**
   - User-chosen passphrase for JSON export.
   - Keeps local-first story while reducing data-loss risk.

5. **Importers**
   - CSV import for card statements or order exports.
   - Gmail/Outlook instructions should stay manual unless a privacy-safe connector exists.

6. **Optional OCR**
   - Browser-based OCR with no upload if practical.
   - Cloud OCR should be explicitly opt-in and disabled by default.

7. **Local notification upgrade**
   - Better reminder scheduling, repeated alerts, and platform-specific fallback copy.
   - Calendar export should remain available because browser notifications are inconsistent.

8. **Claim packet HTML/PDF**
   - Printable evidence pack with receipt, photos, serial/model, deadlines, and checklist.
   - Useful for customer support, warranty claims, and chargeback preparation.

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
