# Sample Intake

Community samples must be synthetic or anonymized before they enter the repository. Raw receipts, order exports, OCR images, support messages, card statements, addresses, phone numbers, emails, card numbers, and real order IDs must not be committed.

## Intake Flow

1. Run the local anonymizer for text-like samples:

```bash
npm run fixture:anonymize -- path/to/private-sample.csv
```

2. Manually inspect the generated draft.
3. Move only the anonymized fixture into `tests/fixtures`.
4. Add an entry to `tests/fixtures/intake/sample-intake.json`.
5. Run:

```bash
npm run fixture:validate
```

The validator checks the intake manifest, PII patterns, coverage targets, parser importability, OCR text result expectations, policy metadata, notification payloads, and smoke records.

## Coverage Targets

`tests/fixtures/intake/sample-intake.json` defines fixture coverage targets for the importer and local OCR regression set. Keep these targets strict enough that a new card statement, marketplace order, merchant order, payment receipt, local OCR text sample, or bundled OCR image fixture cannot be added without review metadata and parser validation.

Required intake entries must include:

- `sourceKind`: the anonymized sample shape being covered.
- `review.piiChecked`: confirms raw private data was removed before commit.
- `review.parserChecked`: confirms the CSV importer or receipt parser was run.
- `review.reviewedAt`: review date in `YYYY-MM-DD` format.
- `review.reviewer`: a non-sensitive reviewer handle, not an email address.

## OCR Samples

Do not commit scanned receipt images by default. Commit only local OCR text output that has been anonymized and reviewed. Keep the original image as local evidence outside the repo.

The repo also includes synthetic SVG OCR fixtures for the bundled no-cloud worker path. These SVG files must contain only fake receipt text in `data-rwg-ocr-text` metadata and must pass `npm run fixture:validate`.

Scanned PDF fixtures may be paired with anonymized local OCR text through `tests/fixtures/pdf/scanned-sidecars.json`. The sidecar text must come from a local/no-cloud process and must be parser-checked before commit.

## Real Endpoint Smoke Records

Do not commit raw notification smoke output. Convert it first:

```bash
npm run notify:record -- smoke-output.json
```

Commit only sanitized records that store provider/status and an endpoint host hash.
