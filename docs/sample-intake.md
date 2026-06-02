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

The validator checks the intake manifest, PII patterns, parser importability, OCR text result expectations, policy metadata, notification payloads, and smoke records.

## OCR Samples

Do not commit scanned receipt images by default. Commit only local OCR text output that has been anonymized and reviewed. Keep the original image as local evidence outside the repo.

## Real Endpoint Smoke Records

Do not commit raw notification smoke output. Convert it first:

```bash
npm run notify:record -- smoke-output.json
```

Commit only sanitized records that store provider/status and an endpoint host hash.
