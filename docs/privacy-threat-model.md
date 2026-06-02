# Privacy Threat Model

Purchase history can reveal sensitive information: household composition, income range, location, health products, family events, and lifestyle patterns. The first design rule is to avoid collecting what the app does not need.

## Current Protections

- No backend.
- No account.
- No cloud upload.
- No retailer login scraping.
- Data stored in browser storage.
- JSON export lets users move or back up their own data.

## Current Limits

- Browser storage can be deleted when users clear site data.
- Local device compromise can expose saved purchases.
- Evidence pack and JSON exports are plain files unless users encrypt or store them securely.
- Pasted receipt parsing is deterministic and local, but it can make incorrect guesses.

## Design Rules

- Never silently upload receipts.
- Show deadline assumptions instead of hiding them.
- Let users edit every parsed field before relying on it.
- Keep AI/OCR optional and local-first where possible.
- Treat merchant policy templates as hints, not guarantees.
