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
  productName: ["product_name", "product", "name", "item", "description", "item_name", "title"],
  merchant: ["merchant", "merchant_name", "store", "vendor", "seller", "payee", "shop"],
  purchaseDate: ["purchase_date", "date", "order_date", "transaction_date", "purchased_at"],
  price: ["price", "amount", "total", "line_total", "transaction_amount"],
  returnWindowDays: ["return_days", "return_window_days"],
  refundWindowDays: ["refund_days", "refund_window_days"],
  warrantyMonths: ["warranty_months", "warranty"],
  model: ["model", "model_number"],
  serial: ["serial", "serial_number"],
  category: ["category"],
  room: ["room", "location"],
  supportContact: ["support_contact", "support", "contact"],
  documents: ["documents", "document_names", "receipt", "receipt_file"],
  serviceNotes: ["service_notes", "service_history"],
  hasReceipt: ["has_receipt", "receipt_available", "proof"],
  notes: ["notes", "memo"],
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

export function purchasesFromCsv(text, now = new Date()) {
  return analyzeCsvImport(text, [], now).valid.map((row) => row.purchase);
}
