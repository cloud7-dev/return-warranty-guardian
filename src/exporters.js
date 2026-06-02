import { computeDeadlines } from "./deadline-engine.js";

export function downloadText(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function evidencePackMarkdown(purchase, now = new Date()) {
  const item = computeDeadlines(purchase, now);
  const documents = Array.isArray(item.documents) ? item.documents : [];
  const attachments = Array.isArray(item.attachments) ? item.attachments.filter((attachment) => attachment?.name) : [];
  const deadlineRows = item.deadlines
    .map(
      (deadline) =>
        `| ${deadline.label} | ${deadline.date} | ${deadline.daysLeft} | ${deadline.status} |`,
    )
    .join("\n");

  return `# Evidence Pack: ${item.productName}

Generated: ${now.toISOString()}

## Purchase

- Product: ${item.productName}
- Merchant: ${item.merchant}
- Purchase date: ${item.purchaseDate}
- Price: ${Number(item.price || 0).toFixed(2)}
- Model: ${item.model || "Not recorded"}
- Serial: ${item.serial || "Not recorded"}
- Category: ${item.category || "Not recorded"}
- Room/location: ${item.room || "Not recorded"}
- Support/contact: ${item.supportContact || "Not recorded"}
- Receipt/proof attached: ${item.hasReceipt ? "Yes" : "No"}
- Source: ${item.source || "manual"}

## Local Documents

${documents.length ? documents.map((name) => `- ${name}`).join("\n") : "- No document names recorded."}

## Local Attachments

${attachments.length ? attachments.map((attachment) => `- ${attachment.name} (${attachment.type || "file"}, ${attachment.size || 0} bytes)`).join("\n") : "- No local files attached."}

## Service History

${item.serviceNotes || "No service history recorded."}

## Deadline Math

| Type | Date | Days left | Status |
| --- | --- | ---: | --- |
${deadlineRows || "| None | - | - | missing |"}

## Notes

${item.notes || "No notes recorded."}

## Claim Checklist

- Receipt or order confirmation
- Product photos
- Box and accessories
- Serial/model number
- Merchant support contact
- Return label or RMA number
`;
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function purchasesToCsv(purchases, now = new Date()) {
  const columns = [
    "product_name",
    "merchant",
    "purchase_date",
    "price",
    "return_deadline",
    "refund_deadline",
    "warranty_deadline",
    "category",
    "room",
    "model",
    "serial",
    "support_contact",
    "documents",
    "has_receipt",
    "status",
    "notes",
    "service_notes",
  ];
  const rows = purchases.map((purchase) => {
    const item = computeDeadlines(purchase, now);
    const attachments = Array.isArray(item.attachments) ? item.attachments.filter((attachment) => attachment?.name) : [];
    return [
      item.productName,
      item.merchant,
      item.purchaseDate,
      item.price,
      item.returnDeadline,
      item.refundDeadline,
      item.warrantyDeadline,
      item.category,
      item.room,
      item.model,
      item.serial,
      item.supportContact,
      [...(item.documents || []), ...attachments.map((attachment) => attachment.name)],
      item.hasReceipt ? "yes" : "no",
      item.status,
      item.notes,
      item.serviceNotes,
    ].map(csvCell);
  });
  return [columns.map(csvCell), ...rows].map((row) => row.join(",")).join("\n");
}

export function purchasesToIcs(purchases, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = purchases.flatMap((purchase) => {
    const item = computeDeadlines(purchase, now);
    return item.deadlines.map((deadline) => {
      const date = deadline.date.replace(/-/g, "");
      const uid = `${purchase.id}-${deadline.type}@return-warranty-guardian`;
      const summary = `${deadline.label} deadline: ${purchase.productName}`;
      const description = `${purchase.merchant} | Purchase date ${purchase.purchaseDate} | ${deadline.daysLeft} days left`;
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${stamp}Z`,
        `DTSTART;VALUE=DATE:${date}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        "END:VEVENT",
      ].join("\r\n");
    });
  });

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Return Warranty Guardian//EN", ...events, "END:VCALENDAR"].join(
    "\r\n",
  );
}
