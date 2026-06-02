# Fixture Corpus

These fixtures are synthetic examples for importer, receipt extraction, notification runner, and policy-template tests.

Do not commit private receipts, real card statements, real order IDs, names, phone numbers, addresses, serial numbers, or support tickets. When adding coverage, create fake merchant names, fake order IDs, and rounded example amounts that exercise the parser shape without exposing personal data.

Current fixture groups:

- `csv/`: card statement, marketplace order, Shopify-style order, and Stripe-style receipt exports for import preset coverage.
- `receipts/`: email-style receipt HTML for local text extraction and receipt parser coverage.
- `pdf/`: PDF source snippets with simple text operators plus scanned/compressed fallback diagnostics.
- `notifications/`: ntfy, Gotify, and Apprise payload fixtures for local runner dry-run and endpoint-plan coverage.
- `policies/`: expected defaults, evidence requirements, and country/jurisdiction metadata for user-confirmed policy templates.

To create a sanitized draft from a local private sample:

```bash
npm run fixture:anonymize -- path/to/private-sample.csv
```

Then inspect the output manually before moving it into a fixture folder.
