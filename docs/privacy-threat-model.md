# Privacy Threat Model

Purchase history can reveal sensitive information: household composition, income range, location, health products, family events, and lifestyle patterns. The first design rule is to avoid collecting what the app does not need.

## Current Protections

- No backend.
- No account.
- No cloud upload.
- No retailer login scraping.
- No automatic retailer price scraping.
- No automatic recall database lookup.
- Data stored in browser storage.
- Encrypted `.rwgbackup` export lets users back up purchase data, local CSV presets, self-hosted notification draft settings, snooze state, and hydrated attachment payloads without a server.
- Backup encryption uses WebCrypto PBKDF2-SHA256 plus AES-GCM. The passphrase is never stored by the app.

## Current Limits

- Browser storage can be deleted when users clear site data. Encrypted backup reduces the loss risk only if users export and retain the `.rwgbackup` file.
- Local device compromise can expose saved purchases.
- Evidence pack, JSON, CSV, ICS, and claim exports are plain files unless users encrypt or store them securely.
- If users lose an encrypted backup passphrase, the app cannot recover it.
- Attachments over 5 MB or attachments that fail local hydration are recorded in the backup manifest as skipped attachment payloads. The purchase record remains present, but the file payload may need to be reattached after restore.
- Pasted receipt parsing is deterministic and local, but it can make incorrect guesses.
- Price-protection candidates are only based on user-entered prices and dates. They do not prove eligibility for a price adjustment.
- Recall/safety notes are only user-confirmed references. Official recall or safety status must still be verified directly with the official source for the relevant country or region.

## Design Rules

- Never silently upload receipts.
- Show deadline assumptions instead of hiding them.
- Let users edit every parsed field before relying on it.
- Keep AI/OCR optional and local-first where possible.
- Treat merchant policy templates as hints, not guarantees.
- Treat price-protection status as a candidate, not a guarantee.
- Store recall/safety URLs and notes as evidence memory only; do not imply official verification by the app.
- Prefer merge-only restore. Do not overwrite or delete existing purchase records during backup recovery without a separate explicit destructive flow.
