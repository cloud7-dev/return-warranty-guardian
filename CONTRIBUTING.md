# Contributing

Thanks for helping improve Return & Warranty Guardian.

This project is a local-first, privacy-friendly web app for purchase memory, return windows, refund deadlines, warranties, and claim evidence. Keep contributions focused on that job.

## Development

```bash
npm run dev
npm test
npm run build
```

Open the local app at:

```text
http://127.0.0.1:4180
```

The app has no runtime dependencies. It stores demo and user records in browser storage.

## Pull Request Expectations

- Keep purchase, receipt, warranty, return, refund, and claim workflows central.
- Do not add server upload paths for user purchase or receipt data.
- Do not include real receipts, order numbers, serial numbers, phone numbers, addresses, or private support messages in tests, screenshots, fixtures, issues, or pull requests.
- Run `npm test` and `npm run build` before opening a pull request.
- If the change affects UI behavior, run `npm run qa:browser` and update screenshots only when the UI intentionally changes.
- If the change affects text, navigation, exports, or user-facing controls, note the i18n impact in the pull request.
- If the change affects storage, export, import, or evidence packs, note the compatibility and privacy impact.

## Good First Contributions

- Synthetic receipt parser fixtures.
- Small accessibility fixes.
- Localized copy improvements.
- Documentation improvements.
- Deterministic tests for deadline and export behavior.

## Product Boundary

Emergency binders, medical/legal/family vaults, and full home ERP workflows are intentionally out of scope for this repository. See [docs/product-boundaries.md](docs/product-boundaries.md).
