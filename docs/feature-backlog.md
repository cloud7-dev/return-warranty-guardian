# Feature Backlog Review

This list separates high-leverage additions from features that could distract the MVP.

## V2: Still Underserved User Pain

1. **Reliable notifications without a server**
   - Users want mobile and PC reminders even when the web app is closed.
   - Calendar export now includes repeated `VALARM` reminders, open-app browser notifications are available after user permission, the app shows a mobile/PC calendar import guide, and in-app reminders can be snoozed for 3 hours, tomorrow, or 7 days.
   - Self-hosted notification settings can be stored locally and exported as JSON/curl drafts plus dry-run reports for ntfy, Gotify, and Apprise. A local runner CLI can read the payload, print scheduler-ready dry-run commands, and only send when explicitly guarded by `--send --yes` plus `RWG_NOTIFY_SEND=1`. True automatic background push still conflicts with the no-server promise unless it is explicitly opt-in and self-hosted.

2. **More durable local attachments**
   - Receipt images, PDFs, manuals, and warranty cards can now be stored in the browser record.
   - Current flow stores local attachment Blobs in OPFS when supported, falls back to data URLs otherwise, shows save/skipped status for files over 5 MB, hydrates OPFS files for download/export, and includes attachments plus a manifest in claim bundles.
   - Remaining pain: attachments still depend on browser site data. Encrypted export bundles, recovery UX, or a desktop wrapper are stronger V2 candidates than a hosted file vault.

3. **Messy receipt and policy extraction**
   - Real receipts arrive as screenshots, email HTML, PDFs, Kakao/DM screenshots, and retailer order pages.
   - Local text/PDF text-operator/HTML extraction is now connected to the parser, scanned/compressed PDFs show a no-upload fallback notice, and image OCR works when the browser exposes local `TextDetector` support.
   - User-confirmed policy templates can fill common return/refund/warranty assumptions with evidence requirements, source/version metadata, and jurisdiction disclaimers, and synthetic fixtures cover CSV/HTML/PDF/local OCR text/policy regression cases. A bundled cross-browser OCR engine and real anonymized policy fixture corpus are still needed before the app can reduce manual entry enough.

4. **Warranty claim packet quality**
   - Users need a clean support packet with receipt, serial/model, photos, repair history, manuals, and merchant conversation notes.
   - Printable HTML claim packets now include local attachment links, image previews, browser-specific PDF save guidance, claim profile/jurisdiction hints, attachment export review, attachment manifests, and starter submission templates for merchant return, warranty support, chargeback evidence, and repair intake.
   - Claim bundle JSON/ZIP preserves the generated packet, claim profile, attachment export review, submission templates, attachment manifests, and local attachment evidence.

5. **Home appliance and repair history**
   - Warranty issues often depend on where an item is installed, who repaired it, which manual applies, and what service happened before.
   - V2 should absorb the useful parts of Home Memory Ledger without becoming a generic home ERP.

6. **Cross-device continuity without cloud lock-in**
   - Users buy on mobile, search on desktop, and need the same records later.
   - JSON export is safe but manual. V2 needs encrypted backup, local network sync, or self-hosted sync options.

## High-Leverage Next Features

1. **Synthetic receipt fixture corpus**
   - Initial synthetic CSV, HTML receipt, PDF text-operator, and policy-template fixtures exist under `tests/fixtures`.
   - A local anonymizer script helps turn private samples into reviewable fixture drafts before contribution, `npm run fixture:review` / `npm run fixture:review-batch` check incoming sample candidates before merge, and sample intake now requires provenance, reuse permission, raw-sample non-retention, non-sensitive contributor handles, PII review, and parser review before a fixture can pass validation.
   - Sample intake manifests now record anonymization and parser-review status before accepting community-shaped CSV/OCR fixtures, and `npm run fixture:coverage` reports whether accepted entries are still synthetic-only or include reviewed community/public-open-license samples.
   - `npm run fixture:request-pack` now generates a privacy-safe contributor request pack with requested sample shapes, maintainer gates, and an intake entry template.
   - Good for GitHub stars because it makes the project hackable.

2. **Merchant policy templates**
   - Community-editable return/refund defaults by merchant and country.
   - Must stay user-confirmed because policies vary by item and season.

3. **Attachment handling**
   - Receipt image/PDF storage, manuals, warranty cards, image compression, and warning for large files.
   - Claim bundle exports now include evidence pack, attachment manifest, attachment export review, and attached local files.

4. **Encrypted backup**
   - User-chosen passphrase for JSON export.
   - Keeps local-first story while reducing data-loss risk.

5. **Importers**
   - CSV import now covers preview, duplicate detection, row-level error reporting, built-in/user preset mapping, user-editable field mapping, selected-row import, import report export, review checklist generation, large-import review filters, preset bundle export/import with compatibility validation, SHA-256 fingerprint-ready signing payloads, ECDSA P-256 detached signature verification, trust metadata, fixture validation, Korean card statements, Korean shopping orders, Amazon-style order history, Shopify-style order exports, and Stripe-style receipt exports.
   - Synthetic fixture corpus covers the current built-in presets.
   - Local fixture anonymization exists for draft samples, and fixture coverage reports expose the current accepted community-sample gap.
   - Release readiness reporting keeps the accepted-sample gap visible instead of letting synthetic-only coverage look like production breadth.
   - Remaining work: broader anonymized real card-statement/retailer fixture expansion, signed maintainer key registry operations, and community preset review at scale.

6. **Optional OCR**
   - Text, CSV, HTML/email, simple PDF text-operator extraction, scanned/compressed PDF fallback diagnostics/notices, local OCR text sidecar paste/file input and matching `.ocr.txt` auto-pairing for scanned PDFs, local OCR text result fixtures, and supported browser-local image OCR now run locally in the browser. Image OCR now has an adapter boundary for a future bundled worker, browser TextDetector, or manual fallback.
   - A bundled cross-browser image OCR engine and real scan/bitmap PDF OCR are still needed if practical.
   - Cloud OCR should be explicitly opt-in and disabled by default.

7. **Local notification upgrade**
   - Per-purchase lead days, repeated `.ics` `VALARM`, open-app browser notifications, calendar import guidance, 3-hour/tomorrow/7-day in-app snooze, local self-hosted settings, self-hosted notification payload exports, dry-run reports, a runner CLI, and guarded opt-in send mode are implemented.
   - Provider-specific endpoint fixtures, scheduler recipes, platform fallback guidance, an operating guide, local loopback smoke tests, opt-in public endpoint smoke mode, public smoke readiness reports, scheduled/manual GitHub Actions smoke workflow, sanitized smoke result records, smoke record audits, and Markdown operations reports now cover ntfy and Gotify send paths plus Apprise dry-run plans.
   - A real ntfy public endpoint smoke has been run, sanitized into the fixture record, and configured through GitHub repository variables so the weekly workflow can keep operating without raw endpoint URLs, topics, tokens, or reminder bodies in the repo.
   - Remaining work: review the weekly smoke artifact after each release cycle and rotate the public topic if it receives unrelated traffic.

8. **Claim packet HTML/PDF**
   - Printable HTML claim packet exists with attachment links, image previews, browser-specific PDF save guidance, claim profile/jurisdiction hints, attachment export review, attachment manifests, and starter submission templates, can be saved as PDF from the browser print dialog, and can be exported as claim bundle JSON/ZIP.
   - Remaining work: richer merchant/country templates and localized template text.

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
