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
      supportedFields: CSV_IMPORT_FIELDS.map((field) => field.key),
      presets: (presets || []).map((preset) => ({
        id: preset.id,
        label: preset.label,
        mapping: preset.mapping || {},
      })),
    },
    null,
    2,
  );
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
    });
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
