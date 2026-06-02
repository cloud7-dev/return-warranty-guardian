# Sample Intake

Community samples must be synthetic or anonymized before they enter the repository. Raw receipts, order exports, OCR images, support messages, card statements, addresses, phone numbers, emails, card numbers, and real order IDs must not be committed.

## Intake Flow

1. Run the local anonymizer for text-like samples:

```bash
npm run fixture:anonymize -- path/to/private-sample.csv
```

The command writes three local review artifacts: a sanitized fixture draft, an anonymization report, and an intake entry draft. The report and draft are review aids; do not commit them until paths and review flags are finalized.

2. Manually inspect the generated sanitized fixture and report.
3. Edit the generated intake entry draft with final `fixturePath`, `sourceKind`, provenance, permission, and review fields.
4. Review the single candidate before adding it to the full manifest:

```bash
npm run fixture:review -- path/to/intake-entry.json path/to/fixture-root
```

For multiple candidates, review a directory of intake entries:

```bash
npm run fixture:review-batch -- path/to/intake-entry-dir path/to/fixture-root
```

5. Move only the reviewed anonymized fixtures into `tests/fixtures`.
6. Copy the finalized accepted entries into `tests/fixtures/intake/sample-intake.json` and set `piiChecked` / `parserChecked` to `true` only after review.
7. Run:

```bash
npm run fixture:validate
```

The single-entry and batch reviewers check metadata, provenance, PII patterns, and parser importability before a fixture is merged into the corpus. The batch reviewer also prints `acceptedEntries`, which can be copied into the manifest after manual review. The full validator checks the intake manifest, coverage targets, parser importability, OCR text result expectations, policy metadata, notification payloads, and smoke records.

To produce a maintainer-facing coverage report:

```bash
npm run fixture:coverage -- tests/fixtures/intake/sample-intake.json
```

The report summarizes accepted entries by type, source kind, and provenance origin. It also makes any community-sample gap explicit. Use `--strict-community` when a release gate should fail unless at least one `anonymized-community` or `public-open-license` sample has been accepted.

To produce a privacy-safe contributor request pack:

```bash
npm run fixture:request-pack -- tests/fixtures/intake/sample-intake.json
```

The request pack is meant for issue comments, maintainer notes, or release planning. It lists requested sample shapes, contributor commands, maintainer gate commands, and an intake entry template without asking anyone to share raw receipts, account screenshots, order IDs, addresses, or card statements.

## Coverage Targets

`tests/fixtures/intake/sample-intake.json` defines fixture coverage targets for the importer and local OCR regression set. Keep these targets strict enough that a new card statement, marketplace order, merchant order, payment receipt, local OCR text sample, or bundled OCR image fixture cannot be added without review metadata and parser validation.

Required intake entries must include:

- `sourceKind`: the anonymized sample shape being covered.
- `provenance.origin`: one of `synthetic-fixture`, `anonymized-community`, or `public-open-license`.
- `provenance.license`: one of the repository-approved fixture licenses or permission labels.
- `provenance.permission`: a short non-sensitive note explaining why this fixture can be committed.
- `provenance.rawSampleRetained`: must be `false`; raw private samples stay outside the repository and should not be retained by maintainers.
- `provenance.contributorHandle`: a non-sensitive handle, not an email address or real order/customer identifier.
- `review.piiChecked`: confirms raw private data was removed before commit.
- `review.parserChecked`: confirms the CSV importer or receipt parser was run.
- `review.reviewedAt`: review date in `YYYY-MM-DD` format.
- `review.reviewer`: a non-sensitive reviewer handle, not an email address.

CSV preset bundle fixtures also use `tests/fixtures/presets/key-governance.json` to document active, retired, and revoked signing keys. A signed preset bundle must use an active review key and an allowed algorithm.

Current fixture coverage includes synthetic samples and a reviewed public-open-license OCR text sample. That proves the intake path can accept non-synthetic public samples, but the app still should not claim broad real-world parser coverage until more card-statement, marketplace, merchant, and OCR shapes are accepted.

## OCR Samples

Do not commit scanned receipt images by default. Commit only local OCR text output that has been anonymized and reviewed. Keep the original image as local evidence outside the repo.

The repo also includes synthetic SVG OCR fixtures for legacy metadata extraction and PBM template OCR fixtures for the bundled no-cloud worker path. SVG files must contain only fake receipt text in `data-rwg-ocr-text` metadata. PBM fixtures must be generated from non-sensitive receipt text and pass `npm run fixture:validate`.

Scanned PDF fixtures may be paired with anonymized local OCR text through `tests/fixtures/pdf/scanned-sidecars.json`. The sidecar text must come from a local/no-cloud process and must be parser-checked before commit. The app parser also exposes a local OCR sidecar text box and `.txt` file input so a user can paste or attach local OCR output for an image-based PDF without committing or uploading the raw scan.

OCR engine coverage is documented in `tests/fixtures/ocr/engine-manifest.json`. Every listed engine must declare supported MIME types, no network access, no input storage, license scope, and fixture coverage when applicable. The bundled PBM template OCR worker is intentionally narrow and deterministic; it proves no-cloud bundled OCR and scanned PDF automation without claiming general Tesseract-like OCR breadth.

## Real Endpoint Smoke Records

Do not commit raw notification smoke output. Convert it first:

```bash
npm run notify:record -- smoke-output.json
```

Commit only sanitized records that store provider/status and an endpoint host hash.
