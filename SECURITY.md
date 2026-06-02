# Security Policy

Return & Warranty Guardian is designed to be local-first. The app has no backend and should not upload purchase, receipt, warranty, or claim data to a server.

## Reporting a Vulnerability

Please do not open a public issue with sensitive data. Instead, contact the repository maintainer privately through GitHub.

Include:

- A short description of the issue.
- A minimal reproduction using synthetic data.
- Browser and operating system details if relevant.
- Whether the issue affects storage, export/import, service worker caching, or user privacy.

Do not include:

- Real receipts.
- Real order numbers.
- Real serial numbers.
- Names, phone numbers, emails, addresses, or private support messages.

## Security Scope

In scope:

- Local storage or IndexedDB data handling.
- JSON/CSV/ICS/Markdown export behavior.
- Service worker caching behavior.
- Import parsing and validation.
- Privacy regressions that add or imply upload paths.

Out of scope:

- Merchant policy disputes.
- Retailer account automation.
- Browser extensions or third-party calendar apps.
- User device compromise unrelated to this app.

## Privacy Expectations

Tests, fixtures, screenshots, and issue reports must use synthetic data only. This project should remain safe for contributors to work on without handling private consumer records.
