# Fixture Corpus

These fixtures are synthetic examples for importer, receipt extraction, notification runner, and policy-template tests.

Do not commit private receipts, real card statements, real order IDs, names, phone numbers, addresses, serial numbers, or support tickets. When adding coverage, create fake merchant names, fake order IDs, and rounded example amounts that exercise the parser shape without exposing personal data.

Current fixture groups:

- `intake/`: sample intake manifests that document anonymization, parser review, and coverage targets before a fixture is accepted.
- `csv/`: card statement, marketplace order, Shopify-style order, and Stripe-style receipt exports for import preset coverage.
- `receipts/`: email-style receipt HTML for local text extraction and receipt parser coverage.
- `pdf/`: PDF source snippets with simple text operators, scanned/compressed fallback diagnostics, and local OCR sidecar manifests.
- `ocr/`: local OCR text result fixtures, engine manifest, and synthetic SVG bundled-worker fixtures for scanned receipt parser regression without committing private receipt images.
- `notifications/`: ntfy, Gotify, and Apprise payload fixtures plus sanitized smoke policy and result records for local runner dry-run and endpoint-plan coverage.
- `policies/`: expected defaults, evidence requirements, and country/jurisdiction metadata for user-confirmed policy templates.
- `presets/`: review manifests, trusted public key registry fixtures, key governance policy, and signed CSV preset bundles for fingerprint and detached signature coverage.

To create a sanitized draft from a local private sample:

```bash
npm run fixture:anonymize -- path/to/private-sample.csv
```

Then inspect the output manually before moving it into a fixture folder.

To summarize accepted fixture coverage:

```bash
npm run fixture:coverage -- tests/fixtures/intake/sample-intake.json
```

The current committed corpus is synthetic-only unless the coverage report shows accepted `anonymized-community` or `public-open-license` entries.
