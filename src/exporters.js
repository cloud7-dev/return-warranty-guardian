import { computeDeadlines } from "./deadline-engine.js";

export function downloadText(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(filename, blob);
}

export function downloadBlob(filename, blob) {
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

function attachmentManifest(attachments) {
  return attachments.map((attachment, index) => ({
    index: index + 1,
    name: attachment.name,
    type: attachment.type || "application/octet-stream",
    size: attachment.size || 0,
    included: Boolean(attachment.dataUrl),
    storage: attachment.storage || (attachment.dataUrl ? "data-url" : "local-reference"),
    exportPath: `attachments/${String(index + 1).padStart(2, "0")}-${safePathSegment(attachment.name)}`,
  }));
}

export function claimPacketProfile(purchase = {}) {
  const policyTemplateId = String(purchase.policyTemplateId || "custom");
  const jurisdiction =
    policyTemplateId.includes("korean") || /korea|korean|한국|대한민국/i.test(`${purchase.notes || ""} ${purchase.merchant || ""}`)
      ? "KR"
      : "general";
  return {
    policyTemplateId,
    jurisdiction,
    templateProfile:
      policyTemplateId === "custom"
        ? "custom-user-reviewed"
        : `policy-template:${policyTemplateId}`,
    reviewNote: "Confirm merchant policy, product exceptions, and country rules before submitting.",
  };
}

export function browserPdfSaveGuide(userAgent = "") {
  const agent = String(userAgent || "").toLowerCase();
  if (agent.includes("firefox")) {
    return "Firefox: choose Print, select Save to PDF, then enable background graphics if attachment previews matter.";
  }
  if (agent.includes("safari") && !agent.includes("chrome") && !agent.includes("chromium")) {
    return "Safari: choose File > Print, open the PDF menu, then choose Save as PDF. Review attachment links after saving.";
  }
  if (agent.includes("edg/")) {
    return "Edge: choose Print, select Save as PDF, keep headers/footers off if you need a cleaner claim packet.";
  }
  return "Chrome/Chromium: choose Print, select Save as PDF, keep background graphics enabled for image evidence previews.";
}

export function attachmentExportReview(attachments = []) {
  const totalBytes = attachments.reduce((sum, attachment) => sum + Number(attachment.size || 0), 0);
  const largeFiles = attachments.filter((attachment) => Number(attachment.size || 0) > 2 * 1024 * 1024).map((attachment) => attachment.name);
  return {
    totalFiles: attachments.length,
    totalBytes,
    largeFileCount: largeFiles.length,
    largeFiles,
    guidance:
      largeFiles.length > 0
        ? "Large attachments may make email or support forms fail. Compress images or send the ZIP bundle through the merchant upload portal when possible."
        : "Attachment size is within the lightweight claim-packet range.",
  };
}

export function claimSubmissionTemplates(purchase, now = new Date()) {
  const item = computeDeadlines(purchase, now);
  const profile = claimPacketProfile(item);
  const deadlineSummary = item.deadlines.map((deadline) => `${deadline.label}: ${deadline.date} (${deadline.status})`).join("; ");
  const identity = `${item.productName} purchased from ${item.merchant} on ${item.purchaseDate}`;
  const documents = Array.isArray(item.documents) && item.documents.length ? item.documents.join(", ") : "No document names recorded";
  const support = item.supportContact || "Not recorded";
  return [
    {
      id: "merchant-return",
      title: "Merchant Return Request",
      body: `Hello,\n\nI would like to request return support for ${identity}.\n\nOrder/product details:\n- Product: ${item.productName}\n- Purchase date: ${item.purchaseDate}\n- Price: ${Number(item.price || 0).toFixed(2)}\n- Model/serial: ${item.model || "Not recorded"} / ${item.serial || "Not recorded"}\n- Deadline summary: ${deadlineSummary || "No deadlines recorded"}\n- Documents included: ${documents}\n- Claim profile: ${profile.templateProfile} / ${profile.jurisdiction}\n\nI have included the receipt/order proof and supporting documents in this packet. Please confirm the next return step, RMA number, or label instructions.\n\nThank you.`,
    },
    {
      id: "warranty-support",
      title: "Warranty Support Request",
      body: `Hello,\n\nI am requesting warranty support for ${identity}.\n\nWarranty evidence:\n- Product: ${item.productName}\n- Model: ${item.model || "Not recorded"}\n- Serial: ${item.serial || "Not recorded"}\n- Warranty deadline: ${item.warrantyDeadline || "Not calculated"}\n- Support/contact: ${support}\n- Service history: ${item.serviceNotes || "No service history recorded"}\n- Documents included: ${documents}\n- Claim profile: ${profile.templateProfile} / ${profile.jurisdiction}\n\nPlease review the attached proof and advise the repair, replacement, or claim process.`,
    },
    {
      id: "chargeback-summary",
      title: "Chargeback Evidence Summary",
      body: `Transaction evidence summary:\n\n${identity}\nAmount: ${Number(item.price || 0).toFixed(2)}\nSupport/contact: ${support}\nDeadline summary: ${deadlineSummary || "No deadlines recorded"}\nDocuments included: ${documents}\n\nEvidence included:\n- Receipt or order confirmation\n- Deadline math\n- Local documents and attachments listed in this packet\n- Service or support notes when recorded\n\nReview merchant policy and dispute requirements before submitting this summary.`,
    },
    {
      id: "repair-intake",
      title: "Repair Intake Note",
      body: `Repair intake note:\n\nProduct: ${item.productName}\nLocation/category: ${item.room || "Not recorded"} / ${item.category || "Not recorded"}\nModel/serial: ${item.model || "Not recorded"} / ${item.serial || "Not recorded"}\nPurchase date: ${item.purchaseDate}\nWarranty deadline: ${item.warrantyDeadline || "Not calculated"}\nSupport/contact: ${support}\nPrevious service notes: ${item.serviceNotes || "No service history recorded"}\nDocuments included: ${documents}\n\nUse this note when contacting a repair desk, contractor, or manufacturer support team.`,
    },
  ];
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

function reminderLeadDays(purchase) {
  const value = Number(purchase.reminderLeadDays ?? 3);
  return Number.isFinite(value) && value >= 0 ? value : 3;
}

export function reminderAlarmOffsets(purchase) {
  const leadDays = reminderLeadDays(purchase);
  const offsets = new Set();
  if (leadDays > 0) offsets.add(`-P${leadDays}D`);
  if (leadDays > 1) offsets.add("-P1D");
  if (leadDays === 0) offsets.add("PT0M");
  return [...offsets];
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
    "reminder_lead_days",
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
      reminderLeadDays(item),
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

export function claimPacketHtml(purchase, now = new Date(), options = {}) {
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
  const manifest = attachmentManifest(attachments);
  const attachmentSize = attachments.reduce((sum, attachment) => sum + Number(attachment.size || 0), 0);
  const templates = claimSubmissionTemplates(purchase, now);
  const profile = claimPacketProfile(item);
  const pdfGuide = browserPdfSaveGuide(options.userAgent);
  const attachmentReview = attachmentExportReview(attachments);

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
    .guide{border:1px solid #b9d7cf;background:#eef8f5;border-radius:8px;padding:12px;margin:16px 0}
    .submission-note{border-left:4px solid #0f766e;background:#e6f4ef;padding:12px}
    pre{white-space:pre-wrap;font-family:inherit;font-size:13px;margin:0;color:#14211f}
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
  <h2>PDF Save Guide</h2>
  <div class="guide">
    <p>Use the print button, choose Save as PDF in the browser print dialog, then review every local attachment before sending the packet.</p>
    <p>${escapeHtml(pdfGuide)}</p>
    <p>Attachment manifest: ${escapeHtml(String(attachments.length))} file(s), ${escapeHtml(String(attachmentSize))} bytes total.</p>
  </div>
  <h2>Claim Profile</h2>
  <div class="guide">
    <p>Template profile: ${escapeHtml(profile.templateProfile)} · Jurisdiction hint: ${escapeHtml(profile.jurisdiction)}</p>
    <p>${escapeHtml(profile.reviewNote)}</p>
  </div>
  <h2>Documents</h2>
  <ul>${documents.length ? documents.map((name) => `<li>${escapeHtml(name)}</li>`).join("") : "<li>No document names recorded.</li>"}</ul>
  <h2>Local Attachments</h2>
  ${
    attachments.length
      ? `<ul>${fileAttachments.map(attachmentEvidenceHtml).join("")}</ul>
         ${imageAttachments.length ? `<div class="attachment-grid">${imageAttachments.map(attachmentEvidenceHtml).join("")}</div>` : ""}`
      : "<ul><li>No local files attached.</li></ul>"
  }
  <h2>Attachment Manifest</h2>
  ${
    manifest.length
      ? `<table><thead><tr><th>#</th><th>Name</th><th>Type</th><th>Size</th><th>Included</th></tr></thead><tbody>${manifest
          .map(
            (attachment) =>
              `<tr><td>${attachment.index}</td><td>${escapeHtml(attachment.name)}</td><td>${escapeHtml(attachment.type)}</td><td>${escapeHtml(String(attachment.size))}</td><td>${attachment.included ? "yes" : "no"}</td></tr>`,
          )
          .join("")}</tbody></table>`
      : "<p>No local attachment manifest.</p>"
  }
  <h2>Attachment Export Review</h2>
  <div class="guide">
    <p>${escapeHtml(String(attachmentReview.totalFiles))} file(s), ${escapeHtml(String(attachmentReview.totalBytes))} bytes, ${escapeHtml(String(attachmentReview.largeFileCount))} large file(s).</p>
    <p>${escapeHtml(attachmentReview.guidance)}</p>
  </div>
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
  <h2>Submission Templates</h2>
  ${templates
    .map(
      (template) => `
        <section class="box">
          <h3>${escapeHtml(template.title)}</h3>
          <pre>${escapeHtml(template.body)}</pre>
        </section>
      `,
    )
    .join("")}
</body>
</html>`;
}

export function claimPacketBundleJson(purchase, now = new Date(), options = {}) {
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
      claimPacketHtml: claimPacketHtml(purchase, now, options),
      submissionTemplates: claimSubmissionTemplates(purchase, now),
      claimProfile: claimPacketProfile(item),
      pdfSaveGuide: browserPdfSaveGuide(options.userAgent),
      attachmentManifest: attachmentManifest(attachments),
      attachmentExportReview: attachmentExportReview(attachments),
      attachments: attachments.map((attachment) => ({
        name: attachment.name,
        type: attachment.type || "application/octet-stream",
        size: attachment.size || 0,
        createdAt: attachment.createdAt || "",
        storage: attachment.storage || (attachment.dataUrl ? "data-url" : "local-reference"),
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
      const alarmOffsets = reminderAlarmOffsets(purchase);
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${stamp}Z`,
        `DTSTART;VALUE=DATE:${date}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        ...alarmOffsets.flatMap((offset) => [
              "BEGIN:VALARM",
              "ACTION:DISPLAY",
              `DESCRIPTION:${summary}`,
              `TRIGGER:${offset}`,
              "END:VALARM",
            ]),
        "END:VEVENT",
      ].join("\r\n");
    });
  });

  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Return Warranty Guardian//EN", ...events, "END:VCALENDAR"].join(
    "\r\n",
  );
}

function selfHostedProviderDrafts(settings = {}) {
  const endpoint = String(settings.endpoint || "").replace(/\/+$/, "") || "https://ntfy.example.test";
  const topic = String(settings.topic || "").replace(/^\/+/, "") || "topic";
  return {
    ntfy: {
      curl: `curl -H 'Title: Return & Warranty Guardian' -d '<message>' ${endpoint}/${topic}`,
    },
    gotify: {
      curl: `curl -H 'Content-Type: application/json' -H 'Authorization: Bearer <token-not-stored>' -d '{"title":"<title>","message":"<message>","priority":5}' ${endpoint}/message`,
    },
    apprise: {
      curl: `apprise -vv -t '<title>' -b '<message>' '${endpoint}'`,
    },
  };
}

function selfHostedDryRun(settings = {}, providers = selfHostedProviderDrafts(settings)) {
  const warnings = [];
  const provider = settings.provider || "ntfy";
  if (!settings.enabled) warnings.push("Self-hosted delivery is not enabled in local settings.");
  if (!settings.endpoint) warnings.push("Endpoint is empty. Add a self-hosted endpoint before using the draft.");
  if (provider === "ntfy" && !settings.topic) warnings.push("ntfy topic is empty. Add a topic before using the draft.");
  if (provider === "gotify") warnings.push("Gotify tokens are not stored by this app. Add a token manually in your self-hosted runner.");
  if (!providers[provider]) warnings.push(`Provider ${provider} is not supported.`);
  return {
    mode: "local-dry-run",
    provider,
    endpointConfigured: Boolean(settings.endpoint),
    topicConfigured: Boolean(settings.topic),
    tokenStored: false,
    appSendsNetworkRequests: false,
    requiresExternalRunner: true,
    commandPreview: providers[provider]?.curl || "",
    warnings,
  };
}

export function selfHostedNotificationPayload(purchases, now = new Date(), settings = {}) {
  const reminders = purchases
    .filter((purchase) => purchase.status !== "resolved")
    .flatMap((purchase) => {
      const item = computeDeadlines(purchase, now);
      return item.deadlines
        .filter((deadline) => deadline.daysLeft !== null && deadline.daysLeft >= 0)
        .map((deadline) => ({
          productName: item.productName,
          merchant: item.merchant,
          deadlineType: deadline.type,
          deadlineLabel: deadline.label,
          deadlineDate: deadline.date,
          daysLeft: deadline.daysLeft,
          reminderLeadDays: reminderLeadDays(item),
          title: `${deadline.label}: ${item.productName}`,
          message: `${item.merchant} | ${deadline.date} | ${deadline.daysLeft} days left`,
        }));
    });
  return JSON.stringify(
    {
      schema: "return-warranty-guardian.self-hosted-notifications.v1",
      generatedAt: now.toISOString(),
      privacyNote: "Review payloads before sending them to a self-hosted notification service. No data is sent by this app.",
      settings: {
        enabled: Boolean(settings.enabled),
        provider: settings.provider || "ntfy",
        endpoint: settings.endpoint || "",
        topic: settings.topic || "",
        tokenStored: false,
      },
      providers: selfHostedProviderDrafts(settings),
      dryRun: selfHostedDryRun(settings, selfHostedProviderDrafts(settings)),
      reminders,
    },
    null,
    2,
  );
}

export function selfHostedDryRunReport(purchases, now = new Date(), settings = {}) {
  const payload = JSON.parse(selfHostedNotificationPayload(purchases, now, settings));
  return JSON.stringify(
    {
      schema: "return-warranty-guardian.self-hosted-dry-run.v1",
      generatedAt: now.toISOString(),
      privacyNote: "This is a local dry-run report. The app does not store tokens and does not send notification requests.",
      dryRun: payload.dryRun,
      reminderCount: payload.reminders.length,
      sampleReminder: payload.reminders[0] || null,
      externalRunnerPlan: {
        mode: "user-managed",
        suggestedCadence: "Run daily or hourly from a user-controlled scheduler if background delivery is needed.",
        secretHandling: "Keep provider tokens outside this app, for example in an environment variable or password manager.",
      },
    },
    null,
    2,
  );
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function uint16(value) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function uint32(value) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function bytesFromText(text) {
  return new TextEncoder().encode(text);
}

function bytesFromDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^,]*),(.*)$/);
  if (!match) return new Uint8Array();
  const [, meta, payload] = match;
  if (meta.includes(";base64")) {
    const binary =
      typeof atob === "function"
        ? atob(payload)
        : Buffer.from(payload, "base64").toString("binary");
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return bytesFromText(decodeURIComponent(payload));
}

function safePathSegment(value) {
  return String(value || "file")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "file";
}

function dosDateTime(date) {
  const value = new Date(date);
  const year = Math.max(1980, value.getFullYear());
  return {
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
  };
}

export function zipFiles(files, now = new Date()) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime(now);

  for (const file of files) {
    const name = bytesFromText(file.name);
    const data = file.bytes instanceof Uint8Array ? file.bytes : bytesFromText(file.content || "");
    const crc = crc32(data);
    const localHeader = Uint8Array.from([
      ...uint32(0x04034b50),
      ...uint16(20),
      ...uint16(0),
      ...uint16(0),
      ...uint16(stamp.time),
      ...uint16(stamp.date),
      ...uint32(crc),
      ...uint32(data.length),
      ...uint32(data.length),
      ...uint16(name.length),
      ...uint16(0),
    ]);
    localParts.push(localHeader, name, data);

    const centralHeader = Uint8Array.from([
      ...uint32(0x02014b50),
      ...uint16(20),
      ...uint16(20),
      ...uint16(0),
      ...uint16(0),
      ...uint16(stamp.time),
      ...uint16(stamp.date),
      ...uint32(crc),
      ...uint32(data.length),
      ...uint32(data.length),
      ...uint16(name.length),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint16(0),
      ...uint32(0),
      ...uint32(offset),
    ]);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Uint8Array.from([
    ...uint32(0x06054b50),
    ...uint16(0),
    ...uint16(0),
    ...uint16(files.length),
    ...uint16(files.length),
    ...uint32(centralSize),
    ...uint32(offset),
    ...uint16(0),
  ]);
  const size = localParts.reduce((sum, part) => sum + part.length, 0) + centralSize + end.length;
  const output = new Uint8Array(size);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

export function claimPacketZipBytes(purchase, now = new Date(), options = {}) {
  const item = computeDeadlines(purchase, now);
  const root = safePathSegment(item.productName || "claim");
  const attachments = Array.isArray(item.attachments) ? item.attachments.filter((attachment) => attachment?.name) : [];
  const files = [
    { name: `${root}/claim-packet.html`, content: claimPacketHtml(purchase, now, options) },
    { name: `${root}/evidence-pack.md`, content: evidencePackMarkdown(purchase, now) },
    { name: `${root}/claim-bundle.json`, content: claimPacketBundleJson(purchase, now, options) },
    { name: `${root}/attachment-manifest.json`, content: JSON.stringify(attachmentManifest(attachments), null, 2) },
    { name: `${root}/attachment-export-review.json`, content: JSON.stringify(attachmentExportReview(attachments), null, 2) },
    ...claimSubmissionTemplates(purchase, now).map((template) => ({
      name: `${root}/templates/${safePathSegment(template.id)}.txt`,
      content: template.body,
    })),
  ];
  attachments.forEach((attachment, index) => {
    files.push({
      name: `${root}/attachments/${String(index + 1).padStart(2, "0")}-${safePathSegment(attachment.name)}`,
      bytes: bytesFromDataUrl(attachment.dataUrl),
    });
  });
  return zipFiles(files, now);
}
