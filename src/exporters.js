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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function attachmentEvidenceHtml(attachment) {
  const name = escapeHtml(attachment.name);
  const type = escapeHtml(attachment.type || "file");
  const href = escapeHtml(attachment.dataUrl || "");
  const size = Number(attachment.size || 0);
  const sizeLabel = size ? `${size} bytes` : "size not recorded";
  if (String(attachment.type || "").startsWith("image/") && attachment.dataUrl) {
    return `<figure class="attachment-card"><img src="${href}" alt="${name}" /><figcaption>${name} · ${type} · ${escapeHtml(sizeLabel)}</figcaption></figure>`;
  }
  if (attachment.dataUrl) {
    return `<li><a href="${href}" download="${name}">${name}</a> (${type}, ${escapeHtml(sizeLabel)})</li>`;
  }
  return `<li>${name} (${type}, ${escapeHtml(sizeLabel)})</li>`;
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

export function claimPacketHtml(purchase, now = new Date()) {
  const item = computeDeadlines(purchase, now);
  const documents = Array.isArray(item.documents) ? item.documents : [];
  const attachments = Array.isArray(item.attachments) ? item.attachments.filter((attachment) => attachment?.name) : [];
  const deadlineRows = item.deadlines
    .map(
      (deadline) => `
        <tr>
          <td>${escapeHtml(deadline.label)}</td>
          <td>${escapeHtml(deadline.date)}</td>
          <td>${escapeHtml(deadline.daysLeft)}</td>
          <td>${escapeHtml(deadline.status)}</td>
        </tr>
      `,
    )
    .join("");
  const imageAttachments = attachments.filter((attachment) => String(attachment.type || "").startsWith("image/"));
  const fileAttachments = attachments.filter((attachment) => !String(attachment.type || "").startsWith("image/"));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Claim Packet - ${escapeHtml(item.productName)}</title>
  <style>
    body{font-family:Inter,Arial,sans-serif;margin:32px;color:#14211f;line-height:1.5}
    h1{font-size:26px;margin:0 0 6px} h2{font-size:17px;margin:24px 0 8px}
    .meta{color:#64716d;margin:0 0 20px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .box{border:1px solid #dfe6e1;border-radius:8px;padding:12px;background:#f9faf7}
    table{width:100%;border-collapse:collapse}td,th{border:1px solid #dfe6e1;padding:8px;text-align:left}
    ul{padding-left:20px}.print{margin-bottom:18px}
    .attachment-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
    .attachment-card{margin:0;border:1px solid #dfe6e1;border-radius:8px;padding:10px;background:#f9faf7}
    .attachment-card img{max-width:100%;max-height:260px;object-fit:contain;display:block;margin:auto}
    .attachment-card figcaption{margin-top:8px;color:#64716d;font-size:12px}
    .submission-note{border-left:4px solid #0f766e;background:#e6f4ef;padding:12px}
    @media print{.print{display:none}body{margin:18px}a{color:#14211f}}
  </style>
</head>
<body>
  <button class="print" onclick="window.print()">Print or save PDF</button>
  <h1>Claim Packet: ${escapeHtml(item.productName)}</h1>
  <p class="meta">Generated ${escapeHtml(now.toISOString())}</p>
  <section class="grid">
    <div class="box"><strong>Merchant</strong><br>${escapeHtml(item.merchant)}</div>
    <div class="box"><strong>Purchase date</strong><br>${escapeHtml(item.purchaseDate)}</div>
    <div class="box"><strong>Price</strong><br>${escapeHtml(Number(item.price || 0).toFixed(2))}</div>
    <div class="box"><strong>Model / serial</strong><br>${escapeHtml(item.model || "Not recorded")} / ${escapeHtml(item.serial || "Not recorded")}</div>
    <div class="box"><strong>Category / location</strong><br>${escapeHtml(item.category || "Not recorded")} / ${escapeHtml(item.room || "Not recorded")}</div>
    <div class="box"><strong>Support contact</strong><br>${escapeHtml(item.supportContact || "Not recorded")}</div>
  </section>
  <h2>Deadline Math</h2>
  <table><thead><tr><th>Type</th><th>Date</th><th>Days left</th><th>Status</th></tr></thead><tbody>${deadlineRows}</tbody></table>
  <h2>Documents</h2>
  <ul>${documents.length ? documents.map((name) => `<li>${escapeHtml(name)}</li>`).join("") : "<li>No document names recorded.</li>"}</ul>
  <h2>Local Attachments</h2>
  ${
    attachments.length
      ? `<ul>${fileAttachments.map(attachmentEvidenceHtml).join("")}</ul>
         ${imageAttachments.length ? `<div class="attachment-grid">${imageAttachments.map(attachmentEvidenceHtml).join("")}</div>` : ""}`
      : "<ul><li>No local files attached.</li></ul>"
  }
  <h2>Service History</h2>
  <p>${escapeHtml(item.serviceNotes || "No service history recorded.")}</p>
  <h2>Notes</h2>
  <p>${escapeHtml(item.notes || "No notes recorded.")}</p>
  <h2>Claim Checklist</h2>
  <ul>
    <li>Receipt or order confirmation</li>
    <li>Product photos</li>
    <li>Box and accessories</li>
    <li>Serial/model number</li>
    <li>Merchant support contact</li>
    <li>Return label or RMA number</li>
  </ul>
  <h2>Submission Note</h2>
  <p class="submission-note">This packet is generated locally from browser storage. Review deadlines, merchant policy, and attachment contents before submitting a return, warranty, chargeback, or repair claim.</p>
</body>
</html>`;
}

export function claimPacketBundleJson(purchase, now = new Date()) {
  const item = computeDeadlines(purchase, now);
  const attachments = Array.isArray(item.attachments) ? item.attachments.filter((attachment) => attachment?.name) : [];
  return JSON.stringify(
    {
      schema: "return-warranty-guardian.claim-bundle.v1",
      generatedAt: now.toISOString(),
      productName: item.productName,
      merchant: item.merchant,
      purchase,
      deadlines: item.deadlines,
      evidencePackMarkdown: evidencePackMarkdown(purchase, now),
      claimPacketHtml: claimPacketHtml(purchase, now),
      attachments: attachments.map((attachment) => ({
        name: attachment.name,
        type: attachment.type || "application/octet-stream",
        size: attachment.size || 0,
        createdAt: attachment.createdAt || "",
        dataUrl: attachment.dataUrl || "",
      })),
    },
    null,
    2,
  );
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
