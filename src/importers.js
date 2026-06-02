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
  const headers = rows[0].map((header) => header.trim().toLowerCase());
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

export function purchasesFromCsv(text, now = new Date()) {
  return parseCsv(text)
    .map((row, index) => {
      const productName = row.product_name || row.product || row.name || "";
      const merchant = row.merchant || row.merchant_name || row.store || "";
      const purchaseDate = row.purchase_date || row.date || "";
      if (!productName || !merchant || !purchaseDate) return null;
      return {
        id: `csv-${Date.now()}-${index}`,
        productName,
        merchant,
        purchaseDate,
        price: numberFrom(row.price || row.amount),
        returnWindowDays: numberFrom(row.return_days || row.return_window_days, 30),
        refundWindowDays: numberFrom(row.refund_days || row.refund_window_days, 14),
        warrantyMonths: numberFrom(row.warranty_months, 12),
        model: row.model || "",
        serial: row.serial || "",
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
      };
    })
    .filter(Boolean);
}
