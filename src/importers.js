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

export function parseCsv(text) {
  const rows = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(splitCsvLine);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])),
  );
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

function valueFrom(row, aliases) {
  return aliases.map((alias) => row[alias]).find((value) => String(value || "").trim()) || "";
}

function importKey(purchase) {
  return [purchase.productName, purchase.merchant, purchase.purchaseDate]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}

function normalizeCsvRow(row, index, now) {
  const productName = valueFrom(row, ["product_name", "product", "name", "item", "description"]);
  const merchant = valueFrom(row, ["merchant", "merchant_name", "store", "vendor", "seller"]);
  const purchaseDate = valueFrom(row, ["purchase_date", "date", "order_date", "transaction_date"]);
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
      price: numberFrom(valueFrom(row, ["price", "amount", "total"])),
      returnWindowDays: numberFrom(valueFrom(row, ["return_days", "return_window_days"]), 30),
      refundWindowDays: numberFrom(valueFrom(row, ["refund_days", "refund_window_days"]), 14),
      warrantyMonths: numberFrom(valueFrom(row, ["warranty_months", "warranty"]), 12),
      model: valueFrom(row, ["model", "model_number"]),
      serial: valueFrom(row, ["serial", "serial_number"]),
      category: row.category || "",
      room: row.room || row.location || "",
      supportContact: row.support_contact || row.support || "",
      documents: splitList(row.documents),
      attachments: [],
      serviceNotes: row.service_notes || "",
      source: "csv-import",
      hasReceipt: /^(yes|true|1)$/i.test(row.has_receipt || row.receipt || ""),
      notes: row.notes || "",
      status: row.status || "active",
      createdAt: now.toISOString(),
    },
  };
}

export function analyzeCsvImport(text, existingPurchases = [], now = new Date()) {
  const rows = parseCsv(text);
  const existingKeys = new Set(existingPurchases.map(importKey));
  const seenKeys = new Set();
  const valid = [];
  const duplicates = [];
  const invalid = [];

  rows.forEach((row, index) => {
    const result = normalizeCsvRow(row, index, now);
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
    rowCount: rows.length,
    valid,
    duplicates,
    invalid,
  };
}

export function purchasesFromCsv(text, now = new Date()) {
  return analyzeCsvImport(text, [], now).valid.map((row) => row.purchase);
}
