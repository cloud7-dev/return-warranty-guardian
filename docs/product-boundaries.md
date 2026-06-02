# Product Boundaries

Return & Warranty Guardian is a focused consumer tool for purchase memory and claim evidence.

## In Scope

- Receipts and order proof.
- Return windows.
- Refund deadlines.
- Warranty expiration.
- Claim evidence packs.
- Product model and serial numbers.
- Merchant support or contractor contact notes tied to a purchase.
- Document names for receipts, manuals, warranty cards, and service records.
- Room or location context when it helps warranty or claim work.

## Borrowed From Home Memory Ledger

The project intentionally absorbed a narrow slice of Home Memory Ledger:

- Room or location.
- Service notes.
- Support or contractor contact.
- Document names.

These fields help warranty claims without turning the app into a full home-history database.

## Out Of Scope

- Family emergency binders.
- Medical, legal, financial, or family vaults.
- Emergency contact workflows.
- Full home ERP or household operations management.
- Insurance binder management beyond purchase/warranty claim evidence.
- Retailer login automation.
- Cloud document vaults.

## Why This Boundary Exists

The first screen should stay deadline-first. Users should immediately understand that the app prevents missed return, refund, and warranty windows. Broader binder or home ERP features would weaken that message, expand privacy risk, and make the open source maintenance surface harder to reason about.

Related products can share local-first storage, export, i18n, and PWA patterns later, but they should remain separate apps unless the shared engine becomes explicit.
