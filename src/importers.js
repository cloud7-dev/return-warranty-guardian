function splitCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

export const CSV_IMPORT_FIELDS = [
  { key: "productName", label: "Product name", required: true },
  { key: "merchant", label: "Merchant", required: true },
  { key: "purchaseDate", label: "Purchase date", required: true },
  { key: "price", label: "Price", required: false },
  { key: "returnWindowDays", label: "Return days", required: false },
  { key: "refundWindowDays", label: "Refund days", required: false },
  { key: "warrantyMonths", label: "Warranty months", required: false },
  { key: "reminderLeadDays", label: "Reminder lead days", required: false },
  { key: "model", label: "Model", required: false },
  { key: "serial", label: "Serial", required: false },
  { key: "category", label: "Category", required: false },
  { key: "room", label: "Room or location", required: false },
  { key: "supportContact", label: "Support contact", required: false },
  { key: "documents", label: "Documents", required: false },
  { key: "serviceNotes", label: "Service notes", required: false },
  { key: "hasReceipt", label: "Has receipt", required: false },
  { key: "notes", label: "Notes", required: false },
  { key: "status", label: "Status", required: false },
];

const CSV_FIELD_ALIASES = {
  productName: ["product_name", "product", "name", "item", "description", "item_name", "title", "thing", "상품명", "품목", "제품명", "주문상품"],
  merchant: ["merchant", "merchant_name", "store", "vendor", "seller", "payee", "shop", "shop_name", "가맹점명", "상호", "판매자", "구매처", "사용처"],
  purchaseDate: ["purchase_date", "date", "order_date", "transaction_date", "purchased_at", "bought_on", "구매일", "주문일", "결제일", "승인일", "거래일", "사용일"],
  price: ["price", "amount", "total", "line_total", "transaction_amount", "cost", "item_subtotal", "금액", "결제금액", "승인금액", "이용금액", "주문금액", "합계"],
  returnWindowDays: ["return_days", "return_window_days", "return_policy_days", "반품가능일수", "반품일수"],
  refundWindowDays: ["refund_days", "refund_window_days", "refund_policy_days", "환불가능일수", "환불일수"],
  warrantyMonths: ["warranty_months", "warranty", "warranty_period_months", "보증개월", "보증기간"],
  reminderLeadDays: ["reminder_days", "reminder_lead_days", "alert_days", "알림일수", "사전알림일수"],
  model: ["model", "model_number", "모델", "모델명"],
  serial: ["serial", "serial_number", "serial_no", "시리얼", "일련번호"],
  category: ["category", "카테고리", "분류"],
  room: ["room", "location", "install_location", "방", "위치", "설치위치"],
  supportContact: ["support_contact", "support", "contact", "customer_service", "고객센터", "연락처"],
  documents: ["documents", "document_names", "receipt", "receipt_file", "docs", "invoice", "order_id", "order_number", "문서", "영수증", "증빙", "주문번호"],
  serviceNotes: ["service_notes", "service_history", "repair_notes", "수리이력", "서비스메모"],
  hasReceipt: ["has_receipt", "receipt_available", "proof", "영수증보유", "증빙보유"],
  notes: ["notes", "memo", "비고", "메모"],
  status: ["status"],
};

export const CSV_IMPORT_PRESETS = [
  { id: "auto", label: "Auto detect", aliases: {} },
  {
    id: "card-statement",
    label: "Card statement",
    aliases: {
      merchant: ["description", "merchant", "payee"],
      purchaseDate: ["transaction_date", "date"],
      price: ["amount", "transaction_amount"],
      productName: ["description", "merchant", "payee"],
      notes: ["memo", "notes"],
    },
  },
  {
    id: "korean-card-statement",
    label: "Korean card statement",
    aliases: {
      merchant: ["가맹점명", "사용처", "상호", "이용가맹점"],
      purchaseDate: ["승인일", "거래일", "사용일", "이용일"],
      price: ["승인금액", "이용금액", "결제금액", "금액"],
      productName: ["가맹점명", "사용처", "상호", "이용가맹점"],
      notes: ["비고", "메모", "승인번호"],
    },
  },
  {
    id: "order-export",
    label: "Order export",
    aliases: {
      productName: ["item_name", "product", "title", "description"],
      merchant: ["seller", "store", "merchant"],
      purchaseDate: ["order_date", "purchased_at", "date"],
      price: ["line_total", "total", "price"],
      documents: ["receipt", "receipt_file", "documents"],
    },
  },
  {
    id: "amazon-style-order",
    label: "Amazon-style order history",
    aliases: {
      productName: ["title", "item_name", "product_name", "description"],
      merchant: ["seller", "merchant", "ship_from", "vendor", "website"],
      purchaseDate: ["order_date", "purchase_date", "date"],
      price: ["item_subtotal", "total", "price", "item_total"],
      documents: ["order_id", "order_number", "invoice"],
      notes: ["order_id", "order_number", "asin/isbn"],
    },
  },
  {
    id: "korean-shopping-order",
    label: "Korean shopping order",
    aliases: {
      productName: ["상품명", "주문상품", "제품명", "품목"],
      merchant: ["판매자", "구매처", "상호", "스토어"],
      purchaseDate: ["주문일", "구매일", "결제일"],
      price: ["결제금액", "주문금액", "금액", "합계"],
      documents: ["주문번호", "영수증", "증빙"],
      notes: ["주문번호", "비고", "메모"],
    },
  },
  {
    id: "shopify-order-export",
    label: "Shopify-style order export",
    aliases: {
      productName: ["lineitem_name", "product_title", "name", "title"],
      merchant: ["vendor", "shop_name", "merchant", "store"],
      purchaseDate: ["created_at", "paid_at", "order_date", "date"],
      price: ["lineitem_price", "total", "subtotal", "amount"],
      documents: ["name", "order_name", "receipt_url"],
      notes: ["order_name", "financial_status", "fulfillment_status"],
    },
  },
  {
    id: "stripe-receipt-export",
    label: "Stripe-style receipt export",
    aliases: {
      productName: ["description", "product", "item_name"],
      merchant: ["merchant", "seller", "statement_descriptor", "business_name"],
      purchaseDate: ["created", "created_at", "date"],
      price: ["amount", "amount_paid", "total"],
      documents: ["receipt_url", "invoice", "payment_intent"],
      notes: ["payment_intent", "status"],
    },
  },
];

function normalizeHeader(header) {
  return String(header || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function parseCsv(text) {
  const rows = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])),
  );
}

export function csvHeaders(text) {
  const [firstLine] = String(text || "").split(/\r?\n/).filter(Boolean);
  return firstLine ? splitCsvLine(firstLine).map(normalizeHeader) : [];
}

function numberFrom(value, fallback = 0) {
  if (!String(value ?? "").trim()) return fallback;
  const parsed = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitList(value) {
  return String(value || "")
    .split(/;|\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function valueFrom(row, field, mapping = {}) {
  const mappedHeader = mapping[field];
  if (mappedHeader && row[mappedHeader]) return row[mappedHeader];
  return (CSV_FIELD_ALIASES[field] || []).map((alias) => row[alias]).find((value) => String(value || "").trim()) || "";
}

function importKey(purchase) {
  return [purchase.productName, purchase.merchant, purchase.purchaseDate]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}

export function csvMappingForPreset(headers, presetId = "auto") {
  const available = new Set(headers);
  const preset = CSV_IMPORT_PRESETS.find((item) => item.id === presetId) || CSV_IMPORT_PRESETS[0];
  return Object.fromEntries(
    CSV_IMPORT_FIELDS.map((field) => {
      const aliases = [...(preset.aliases[field.key] || []), ...(CSV_FIELD_ALIASES[field.key] || [])];
      const match = aliases.map(normalizeHeader).find((alias) => available.has(alias));
      return [field.key, match || ""];
    }),
  );
}

function normalizeCsvRow(row, index, now, mapping = {}) {
  const productName = valueFrom(row, "productName", mapping);
  const merchant = valueFrom(row, "merchant", mapping);
  const purchaseDate = valueFrom(row, "purchaseDate", mapping);
  const issues = [];
  if (!productName) issues.push("missing product_name");
  if (!merchant) issues.push("missing merchant");
  if (!purchaseDate) issues.push("missing purchase_date");
  if (issues.length) return { rowNumber: index + 2, issues, purchase: null };

  return {
    rowNumber: index + 2,
    issues: [],
    purchase: {
      id: `csv-${Date.now()}-${index}`,
      productName,
      merchant,
      purchaseDate,
      price: numberFrom(valueFrom(row, "price", mapping)),
      returnWindowDays: numberFrom(valueFrom(row, "returnWindowDays", mapping), 30),
      refundWindowDays: numberFrom(valueFrom(row, "refundWindowDays", mapping), 14),
      warrantyMonths: numberFrom(valueFrom(row, "warrantyMonths", mapping), 12),
      reminderLeadDays: numberFrom(valueFrom(row, "reminderLeadDays", mapping), 3),
      model: valueFrom(row, "model", mapping),
      serial: valueFrom(row, "serial", mapping),
      category: valueFrom(row, "category", mapping),
      room: valueFrom(row, "room", mapping),
      supportContact: valueFrom(row, "supportContact", mapping),
      documents: splitList(valueFrom(row, "documents", mapping)),
      attachments: [],
      serviceNotes: valueFrom(row, "serviceNotes", mapping),
      source: "csv-import",
      hasReceipt: /^(yes|true|1)$/i.test(valueFrom(row, "hasReceipt", mapping)),
      notes: valueFrom(row, "notes", mapping),
      status: valueFrom(row, "status", mapping) || "active",
      createdAt: now.toISOString(),
    },
  };
}

export function analyzeCsvImport(text, existingPurchases = [], now = new Date(), options = {}) {
  const rows = parseCsv(text);
  const headers = csvHeaders(text);
  const mapping = options.mapping || csvMappingForPreset(headers, options.presetId || "auto");
  const existingKeys = new Set(existingPurchases.map(importKey));
  const seenKeys = new Set();
  const valid = [];
  const duplicates = [];
  const invalid = [];

  rows.forEach((row, index) => {
    const result = normalizeCsvRow(row, index, now, mapping);
    if (!result.purchase) {
      invalid.push(result);
      return;
    }

    const key = importKey(result.purchase);
    if (existingKeys.has(key) || seenKeys.has(key)) {
      duplicates.push({ ...result, duplicateKey: key });
      return;
    }

    seenKeys.add(key);
    valid.push(result);
  });

  return {
    headers,
    mapping,
    presetId: options.presetId || "auto",
    rowCount: rows.length,
    valid,
    duplicates,
    invalid,
  };
}

export function csvImportReviewFilters(preview, options = {}) {
  const query = String(options.query || "").trim().toLowerCase();
  const proof = options.proof || "all";
  const sectionRows = {
    valid: preview?.valid || [],
    duplicate: preview?.duplicates || [],
    invalid: preview?.invalid || [],
  };
  const matchesQuery = (row) => {
    if (!query) return true;
    const purchase = row.purchase || {};
    return [purchase.productName, purchase.merchant, purchase.purchaseDate, purchase.notes, ...(purchase.documents || []), ...(row.issues || [])]
      .join(" ")
      .toLowerCase()
      .includes(query);
  };
  const matchesProof = (row) => {
    if (proof === "all") return true;
    const purchase = row.purchase || {};
    const hasProof = Boolean(purchase.hasReceipt || (purchase.documents || []).length);
    return proof === "with-proof" ? hasProof : !hasProof;
  };
  const filtered = Object.fromEntries(
    Object.entries(sectionRows).map(([section, rows]) => [section, rows.filter((row) => matchesQuery(row) && matchesProof(row))]),
  );
  return {
    schema: "return-warranty-guardian.csv-import-review-filters.v1",
    query,
    proof,
    totalCount: Object.values(sectionRows).reduce((sum, rows) => sum + rows.length, 0),
    filteredCount: Object.values(filtered).reduce((sum, rows) => sum + rows.length, 0),
    sections: filtered,
  };
}

export function csvImportReport(preview, now = new Date()) {
  const rowSummary = (row) => ({
    rowNumber: row.rowNumber,
    productName: row.purchase?.productName || "",
    merchant: row.purchase?.merchant || "",
    purchaseDate: row.purchase?.purchaseDate || "",
    issues: row.issues || [],
  });
  return JSON.stringify(
    {
      schema: "return-warranty-guardian.csv-import-report.v1",
      generatedAt: now.toISOString(),
      fileName: preview.fileName || "",
      presetId: preview.presetId || "auto",
      headers: preview.headers || [],
      mapping: preview.mapping || {},
      rowCount: preview.rowCount || 0,
      validCount: preview.valid?.length || 0,
      duplicateCount: preview.duplicates?.length || 0,
      invalidCount: preview.invalid?.length || 0,
      valid: (preview.valid || []).map(rowSummary),
      duplicates: (preview.duplicates || []).map((row) => ({ ...rowSummary(row), duplicateKey: row.duplicateKey || "" })),
      invalid: (preview.invalid || []).map(rowSummary),
    },
    null,
    2,
  );
}

export function csvImportReviewChecklist(preview) {
  const mapping = preview?.mapping || {};
  const requiredFields = CSV_IMPORT_FIELDS.filter((field) => field.required);
  const valid = preview?.valid || [];
  const duplicates = preview?.duplicates || [];
  const invalid = preview?.invalid || [];
  const missingRequiredMappings = requiredFields.filter((field) => !mapping[field.key]).map((field) => field.label);
  const missingProofRows = valid.filter((row) => {
    const purchase = row.purchase || {};
    return !purchase.hasReceipt && !(purchase.documents || []).length;
  });
  return [
    {
      id: "required-mapping",
      status: missingRequiredMappings.length ? "fail" : "pass",
      label: "Required fields mapped",
      detail: missingRequiredMappings.length
        ? `Map required columns before import: ${missingRequiredMappings.join(", ")}.`
        : "Product, merchant, and purchase date are mapped.",
    },
    {
      id: "duplicate-review",
      status: duplicates.length ? "warn" : "pass",
      label: "Duplicate rows reviewed",
      detail: duplicates.length
        ? `${duplicates.length} duplicate row(s) will be skipped. Confirm this is expected.`
        : "No duplicate rows detected.",
    },
    {
      id: "invalid-review",
      status: invalid.length ? "warn" : "pass",
      label: "Invalid rows reviewed",
      detail: invalid.length
        ? `${invalid.length} invalid row(s) are excluded. Export the report before confirming.`
        : "No invalid rows detected.",
    },
    {
      id: "proof-review",
      status: missingProofRows.length ? "warn" : "pass",
      label: "Receipt proof reviewed",
      detail: missingProofRows.length
        ? `${missingProofRows.length} importable row(s) have no receipt/document marker.`
        : "Importable rows include receipt or document markers.",
    },
  ];
}

export function csvPresetBundle(presets, now = new Date()) {
  return JSON.stringify(
    {
      schema: "return-warranty-guardian.csv-preset-bundle.v1",
      version: 1,
      generatedAt: now.toISOString(),
      privacyNote: "Preset bundles contain column mappings only. Do not include real receipts, card numbers, order IDs, or purchase rows.",
      trustModel: "community-reviewed-local-mapping",
      signatureStatus: "unsigned-local-draft",
      signatureAlgorithm: "sha256-fingerprint-detached-signature-ready",
      fingerprint: "",
      signatures: [],
      supportedFields: CSV_IMPORT_FIELDS.map((field) => field.key),
      presets: (presets || []).map((preset) => ({
        id: preset.id,
        label: preset.label,
        mapping: preset.mapping || {},
        source: preset.source || "local-user",
        reviewedAt: preset.reviewedAt || now.toISOString().slice(0, 10),
        fixtureCoverage: preset.fixtureCoverage || [],
      })),
    },
    null,
    2,
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function csvPresetBundleSigningPayload(bundle) {
  const unsigned = { ...(bundle || {}) };
  delete unsigned.fingerprint;
  delete unsigned.signatures;
  delete unsigned.signatureStatus;
  return canonicalize(unsigned);
}

async function sha256Hex(text, cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle) throw new Error("WebCrypto subtle digest is required for preset bundle fingerprints.");
  const digest = await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function csvPresetBundleFingerprint(bundle, cryptoProvider = globalThis.crypto) {
  return sha256Hex(csvPresetBundleSigningPayload(bundle), cryptoProvider);
}

function base64UrlToBytes(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  if (typeof atob === "function") {
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  }
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

export async function verifyCsvPresetBundleDetachedSignatures(bundle, trustedKeys = [], cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.subtle) throw new Error("WebCrypto subtle verify is required for preset bundle signatures.");
  const signatures = Array.isArray(bundle?.signatures) ? bundle.signatures : [];
  const trustedById = new Map((trustedKeys || []).map((key) => [key.keyId, key]));
  const payload = new TextEncoder().encode(csvPresetBundleSigningPayload(bundle));
  const results = [];
  for (const signature of signatures) {
    const trusted = trustedById.get(signature.keyId);
    if (!trusted) {
      results.push({ keyId: signature.keyId || "", ok: false, status: "unknown-key" });
      continue;
    }
    if (signature.algorithm !== "ECDSA-P256-SHA256") {
      results.push({ keyId: signature.keyId || "", ok: false, status: "unsupported-algorithm" });
      continue;
    }
    const key = await cryptoProvider.subtle.importKey(
      "jwk",
      trusted.publicKeyJwk,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await cryptoProvider.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      base64UrlToBytes(signature.signature),
      payload,
    );
    results.push({ keyId: signature.keyId || "", ok, status: ok ? "verified" : "invalid-signature" });
  }
  return {
    schema: "return-warranty-guardian.csv-preset-signature-verification.v1",
    ok: results.length > 0 && results.every((result) => result.ok),
    verifiedCount: results.filter((result) => result.ok).length,
    results,
  };
}

export async function verifyCsvPresetBundleFingerprint(bundle, cryptoProvider = globalThis.crypto) {
  const expected = String(bundle?.fingerprint || "");
  if (!expected) {
    return {
      ok: false,
      status: "unsigned-local-draft",
      fingerprint: await csvPresetBundleFingerprint(bundle, cryptoProvider),
      issues: ["missing fingerprint"],
    };
  }
  const actual = await csvPresetBundleFingerprint(bundle, cryptoProvider);
  return {
    ok: actual === expected,
    status: actual === expected ? "fingerprint-matched" : "fingerprint-mismatch",
    fingerprint: actual,
    issues: actual === expected ? [] : ["fingerprint mismatch"],
  };
}

export async function csvPresetBundleReviewSummary(bundle, reviewManifest = {}, cryptoProvider = globalThis.crypto) {
  const fingerprintCheck = await verifyCsvPresetBundleFingerprint(bundle, cryptoProvider);
  const reviewers = Array.isArray(reviewManifest.reviewers) ? reviewManifest.reviewers : [];
  const decisions = Array.isArray(reviewManifest.decisions) ? reviewManifest.decisions : [];
  const expectedFingerprint = String(reviewManifest.fingerprint || bundle?.fingerprint || "");
  const matchingFingerprint = expectedFingerprint ? fingerprintCheck.fingerprint === expectedFingerprint : fingerprintCheck.ok;
  const acceptedDecisions = decisions.filter((decision) => decision?.decision === "accept");
  const rejectedDecisions = decisions.filter((decision) => decision?.decision === "reject");
  const reviewerIds = new Set(reviewers.map((reviewer) => reviewer.id));
  const invalidDecision = decisions.find((decision) => !reviewerIds.has(decision.reviewerId));
  const coveredFixtures = new Set(
    (bundle?.presets || []).flatMap((preset) => (Array.isArray(preset.fixtureCoverage) ? preset.fixtureCoverage : [])),
  );
  const claimedFixtures = new Set(reviewManifest.fixtureCoverage || []);
  const missingClaimedFixture = [...claimedFixtures].find((fixture) => !coveredFixtures.has(fixture));
  const minimumReviewers = Number(reviewManifest.minimumReviewers || 2);
  const issues = [
    !matchingFingerprint && "review manifest fingerprint does not match bundle",
    invalidDecision && `review decision references unknown reviewer ${invalidDecision.reviewerId}`,
    missingClaimedFixture && `review manifest claims uncovered fixture ${missingClaimedFixture}`,
    acceptedDecisions.length < minimumReviewers && `requires at least ${minimumReviewers} accepted reviews`,
    rejectedDecisions.length > 0 && "review manifest contains rejection decisions",
  ].filter(Boolean);
  return {
    schema: "return-warranty-guardian.csv-preset-review-summary.v1",
    ok: issues.length === 0,
    status: issues.length === 0 ? "community-reviewed" : "needs-review",
    fingerprint: fingerprintCheck.fingerprint,
    reviewerCount: reviewers.length,
    acceptedCount: acceptedDecisions.length,
    rejectedCount: rejectedDecisions.length,
    fixtureCoverage: [...coveredFixtures],
    issues,
  };
}

export function validateCsvPresetBundle(bundle) {
  const issues = [];
  const warnings = [];
  if (bundle?.schema !== "return-warranty-guardian.csv-preset-bundle.v1") {
    issues.push("unsupported preset bundle schema");
  }
  if (Number(bundle?.version || 1) > 1) {
    issues.push(`unsupported preset bundle version ${bundle.version}`);
  }
  if (!bundle?.trustModel) warnings.push("preset bundle has no trust model metadata");
  if (!bundle?.signatureStatus) warnings.push("preset bundle has no signature status metadata");
  if (bundle?.signatureStatus && bundle.signatureStatus !== "unsigned-local-draft" && !bundle?.fingerprint) {
    issues.push("signed preset bundle is missing fingerprint");
  }
  if (bundle?.fingerprint && !/^[a-f0-9]{64}$/.test(String(bundle.fingerprint))) {
    issues.push("preset bundle fingerprint must be a SHA-256 hex digest");
  }
  if (bundle?.signatures && !Array.isArray(bundle.signatures)) {
    issues.push("preset bundle signatures must be an array");
  }
  if (Array.isArray(bundle?.signatures)) {
    bundle.signatures.forEach((signature, index) => {
      if (!signature?.keyId || !signature?.algorithm || !signature?.signature) {
        issues.push(`signature ${index + 1} is missing keyId, algorithm, or signature`);
      }
    });
  }
  const allowedFields = new Set(CSV_IMPORT_FIELDS.map((field) => field.key));
  const presets = Array.isArray(bundle?.presets) ? bundle.presets : [];
  const normalizedPresets = [];
  presets.forEach((preset, index) => {
    if (!preset?.id || !preset?.label || !preset?.mapping || typeof preset.mapping !== "object") {
      issues.push(`preset ${index + 1} is missing id, label, or mapping`);
      return;
    }
    const mappingEntries = Object.entries(preset.mapping).filter(([field, header]) => {
      if (!allowedFields.has(field)) {
        warnings.push(`preset ${preset.id} ignores unsupported field ${field}`);
        return false;
      }
      return String(header || "").trim();
    });
    normalizedPresets.push({
      id: String(preset.id),
      label: String(preset.label),
      mapping: Object.fromEntries(mappingEntries),
      source: String(preset.source || "unknown"),
      reviewedAt: String(preset.reviewedAt || ""),
      fixtureCoverage: Array.isArray(preset.fixtureCoverage) ? preset.fixtureCoverage.map(String) : [],
    });
    if (!preset.source) warnings.push(`preset ${preset.id} has no source metadata`);
    if (!preset.reviewedAt) warnings.push(`preset ${preset.id} has no reviewedAt metadata`);
  });
  return {
    ok: issues.length === 0,
    issues,
    warnings,
    presets: normalizedPresets,
  };
}

export function purchasesFromCsv(text, now = new Date()) {
  return analyzeCsvImport(text, [], now).valid.map((row) => row.purchase);
}
