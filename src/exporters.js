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
- Receipt/proof attached: ${item.hasReceipt ? "Yes" : "No"}
- Source: ${item.source || "manual"}

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
