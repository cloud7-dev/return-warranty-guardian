import { computeDeadlines, formatDate, summarizePurchases } from "./deadline-engine.js";
import {
  claimPacketBundleJson,
  claimPacketHtml,
  claimPacketZipBytes,
  downloadBlob,
  downloadText,
  evidencePackMarkdown,
  purchasesToCsv,
  purchasesToIcs,
} from "./exporters.js";
import { CSV_IMPORT_FIELDS, CSV_IMPORT_PRESETS, analyzeCsvImport, csvImportReport, csvMappingForPreset } from "./importers.js";
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, languageMeta, languages, normalizeLanguage, translate } from "./i18n.js";
import { textFromHtmlSource, textFromPdfSource } from "./local-extraction.js";
import { POLICY_TEMPLATES, policyTemplateById } from "./policy-templates.js";
import { parseReceiptText } from "./receipt-parser.js";
import { samplePurchases } from "./sample-data.js";
import { loadPurchases, savePurchases } from "./storage.js";

const app = document.querySelector("#app");
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const CSV_PRESETS_STORAGE_KEY = "rwg:csv-import-presets";

const state = {
  purchases: [],
  search: "",
  filter: "all",
  language: normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || DEFAULT_LANGUAGE),
  selectedId: "",
  parsedReceipt: null,
  ocrStatus: "",
  importPreview: null,
  userCsvPresets: [],
  notificationStatus: "",
};

const today = () => new Date();
const t = (key, values) => translate(state.language, key, values);
const notifiedReminderKeys = new Set();
const h = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function linesFromText(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function fileSizeLabel(size) {
  const amount = Number(size || 0);
  if (amount < 1024) return `${amount} B`;
  if (amount < 1024 * 1024) return `${(amount / 1024).toFixed(1)} KB`;
  return `${(amount / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: reader.result,
        createdAt: new Date().toISOString(),
      });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function extractLocalText(file) {
  if (!file) return "";
  if (file.type === "text/html" || /\.html?$/i.test(file.name)) {
    return textFromHtmlSource(await file.text());
  }
  if (/^text\//.test(file.type) || /\.txt$|\.csv$/i.test(file.name)) return file.text();
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return textFromPdfSource(await file.text());
  }
  if (/^image\//.test(file.type)) {
    if (typeof TextDetector !== "function") {
      throw new Error("Image OCR is not available in this browser. Paste receipt text or use a browser with local TextDetector support.");
    }
    const bitmap = await createImageBitmap(file);
    try {
      const detector = new TextDetector();
      const detections = await detector.detect(bitmap);
      return detections.map((item) => item.rawValue || "").filter(Boolean).join("\n");
    } finally {
      bitmap.close?.();
    }
  }
  throw new Error("Unsupported local file type.");
}

async function attachmentsFromForm(formData) {
  const files = formData.getAll("attachments").filter((file) => file instanceof File && file.name);
  const accepted = files.filter((file) => file.size <= MAX_ATTACHMENT_BYTES);
  return Promise.all(accepted.map(fileToAttachment));
}

function purchaseAttachments(purchase) {
  return Array.isArray(purchase.attachments) ? purchase.attachments.filter((item) => item?.name && item?.dataUrl) : [];
}

function reminderLeadDays(purchase) {
  const value = Number(purchase.reminderLeadDays ?? 3);
  return Number.isFinite(value) && value >= 0 ? value : 3;
}

const filterKeys = {
  all: "filterAll",
  "due-soon": "filterDueSoon",
  return: "filterReturn",
  refund: "filterRefund",
  warranty: "filterWarranty",
  "missing-proof": "filterMissingProof",
  expired: "filterExpired",
  resolved: "filterResolved",
};

const deadlineLabelKeys = {
  return: "deadlineReturn",
  refund: "deadlineRefund",
  warranty: "deadlineWarranty",
};

const statusLabelKeys = {
  active: "statusActive",
  "due-soon": "statusDueSoon",
  expired: "statusExpired",
  missing: "statusMissing",
  resolved: "statusResolved",
};

const confidenceLabelKeys = {
  low: "confidenceLow",
  medium: "confidenceMedium",
};

const icons = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  export: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0-12 4 4m-4-4-4 4M5 14v5h14v-5"/></svg>',
  import: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V9m0 12 4-4m-4 4-4-4M5 10V5h14v5"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4M17 3v4M4 9h16M5 5h14v16H5z"/></svg>',
  pack: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h8l4 4v14H7z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></svg>',
};

function money(value) {
  const locales = { ko: "ko-KR", en: "en-US", ja: "ja-JP", zh: "zh-CN", de: "de-DE", fr: "fr-FR", it: "it-IT", hi: "hi-IN" };
  return Number(value || 0).toLocaleString(locales[state.language] || "ko-KR", {
    style: "currency",
    currency: "USD",
  });
}

function deadlineLabel(deadline) {
  return t(deadlineLabelKeys[deadline.type] || deadline.label);
}

function statusLabel(status) {
  return t(statusLabelKeys[status] || status);
}

function makeId() {
  return `purchase-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadUserCsvPresets() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CSV_PRESETS_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((preset) => preset?.id && preset?.label && preset?.mapping)
      : [];
  } catch {
    return [];
  }
}

function saveUserCsvPresets(presets) {
  state.userCsvPresets = presets;
  localStorage.setItem(CSV_PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

function csvPresetOptions() {
  return [...CSV_IMPORT_PRESETS, ...state.userCsvPresets];
}

async function normalizePurchase(formData) {
  const template = policyTemplateById(formData.get("policyTemplate"));
  const notes = String(formData.get("notes") || "").trim();
  const serviceNotes = String(formData.get("serviceNotes") || "").trim();
  return {
    id: makeId(),
    productName: String(formData.get("productName") || "").trim(),
    merchant: String(formData.get("merchant") || "").trim(),
    purchaseDate: String(formData.get("purchaseDate") || "").trim(),
    price: Number(formData.get("price") || 0),
    returnWindowDays: Number(formData.get("returnWindowDays") || 0),
    refundWindowDays: Number(formData.get("refundWindowDays") || 0),
    warrantyMonths: Number(formData.get("warrantyMonths") || 0),
    reminderLeadDays: Number(formData.get("reminderLeadDays") || 3),
    model: String(formData.get("model") || "").trim(),
    serial: String(formData.get("serial") || "").trim(),
    category: String(formData.get("category") || "").trim(),
    room: String(formData.get("room") || "").trim(),
    supportContact: String(formData.get("supportContact") || "").trim(),
    documents: linesFromText(formData.get("documents")),
    attachments: await attachmentsFromForm(formData),
    policyTemplateId: template?.id || "",
    serviceNotes,
    source: String(formData.get("source") || "manual"),
    hasReceipt: formData.get("hasReceipt") === "on",
    notes: [notes, template?.note && !notes.includes(template.note) ? template.note : ""].filter(Boolean).join("\n"),
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

function getFilteredPurchases() {
  const query = state.search.trim().toLowerCase();
  return state.purchases
    .map((purchase) => computeDeadlines(purchase, today()))
    .filter((purchase) => {
      if (!query) return true;
      return [
        purchase.productName,
        purchase.merchant,
        purchase.model,
        purchase.serial,
        purchase.category,
        purchase.room,
        purchase.supportContact,
        purchase.notes,
        purchase.serviceNotes,
        ...(purchase.documents || []),
        ...purchaseAttachments(purchase).map((attachment) => attachment.name),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .filter((purchase) => {
      if (state.filter === "all") return true;
      if (state.filter === "due-soon") {
        return purchase.deadlines.some((deadline) => deadline.status === "due-soon");
      }
      if (state.filter === "expired") {
        return purchase.deadlines.some((deadline) => deadline.status === "expired");
      }
      if (state.filter === "missing-proof") return !purchase.hasReceipt;
      if (state.filter === "resolved") return purchase.status === "resolved";
      return purchase.deadlines.some((deadline) => deadline.type === state.filter);
    })
    .sort((a, b) => {
      const aDays = a.nextDeadline?.daysLeft ?? 99999;
      const bDays = b.nextDeadline?.daysLeft ?? 99999;
      return aDays - bDays;
    });
}

async function persistAndRender() {
  await savePurchases(state.purchases);
  notifyOpenAppReminders();
  render();
}

function reminderCandidates() {
  return state.purchases
    .filter((purchase) => purchase.status !== "resolved")
    .flatMap((purchase) => {
      const item = computeDeadlines(purchase, today());
      const lead = reminderLeadDays(item);
      return item.deadlines
        .filter((deadline) => deadline.daysLeft !== null && deadline.daysLeft >= 0 && deadline.daysLeft <= lead)
        .map((deadline) => ({ purchase: item, deadline, lead }));
    });
}

function notifyOpenAppReminders() {
  if (typeof Notification !== "function" || Notification.permission !== "granted") return;
  for (const { purchase, deadline } of reminderCandidates().slice(0, 5)) {
    const key = `${purchase.id}:${deadline.type}:${deadline.date}`;
    if (notifiedReminderKeys.has(key)) continue;
    notifiedReminderKeys.add(key);
    try {
      new Notification(`${deadline.label}: ${purchase.productName}`, {
        body: `${purchase.merchant} · ${deadline.date} · ${t("daysLeft", { count: deadline.daysLeft })}`,
        tag: key,
      });
    } catch {
      return;
    }
  }
}

async function enableLocalAlerts() {
  if (typeof Notification !== "function") {
    state.notificationStatus = t("localAlertsUnsupported");
    render();
    return;
  }
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission === "granted") {
    const count = reminderCandidates().length;
    state.notificationStatus = t("localAlertsEnabled", { count });
    notifyOpenAppReminders();
  } else {
    state.notificationStatus = t("localAlertsDenied");
  }
  render();
}

function summaryCard(label, value, detail, tone) {
  return `
    <section class="summary-card ${tone || ""}">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${detail}</small>
    </section>
  `;
}

function renderDashboard() {
  const summary = summarizePurchases(state.purchases, today());
  return `
    <section class="summary-grid" aria-label="${t("queueTitle")}">
      ${summaryCard(t("dueSoon"), summary.dueSoon, t("dueSoonDetail"), "warning")}
      ${summaryCard(t("openItems"), summary.open, t("totalRecords", { count: summary.total }), "")}
      ${summaryCard(t("missingProof"), summary.missingProof, t("missingProofDetail"), "risk")}
      ${summaryCard(t("returnValue"), money(summary.returnValueAtRisk), t("returnValueDetail"), "money")}
    </section>
  `;
}

function renderReminderGuide() {
  return `
    <section class="panel reminder-guide" id="calendar-guide">
      <div class="panel-heading">
        <div>
          <h2>${t("calendarGuideTitle")}</h2>
          <p>${t("calendarGuideSubtitle")}</p>
        </div>
        <button class="secondary-action" id="export-ics-guide" type="button">${icons.calendar} ${t("ics")}</button>
      </div>
      <div class="guide-steps">
        <div>
          <strong>${t("calendarGuideStepExportTitle")}</strong>
          <span>${t("calendarGuideStepExportBody")}</span>
        </div>
        <div>
          <strong>${t("calendarGuideStepMobileTitle")}</strong>
          <span>${t("calendarGuideStepMobileBody")}</span>
        </div>
        <div>
          <strong>${t("calendarGuideStepDesktopTitle")}</strong>
          <span>${t("calendarGuideStepDesktopBody")}</span>
        </div>
      </div>
    </section>
  `;
}

function renderImportPreview() {
  const preview = state.importPreview;
  if (!preview) return "";
  const valid = preview.valid || [];
  const duplicates = preview.duplicates || [];
  const invalid = preview.invalid || [];
  const previewRows = valid.slice(0, 4);
  const headers = preview.headers || [];
  const mapping = preview.mapping || {};

  return `
    <section class="panel import-preview" aria-live="polite">
      <div class="panel-heading">
        <div>
          <h2>${t("importPreviewTitle")}</h2>
          <p>${h(t("importPreviewSubtitle", { file: preview.fileName }))}</p>
        </div>
        <div class="detail-actions">
          <button class="secondary-action" id="confirm-import" type="button" ${valid.length ? "" : "disabled"}>${t("confirmImport")}</button>
          <button class="secondary-action" id="export-import-report" type="button">${t("exportImportReport")}</button>
          <button class="ghost-action" id="cancel-import" type="button">${t("cancelImport")}</button>
        </div>
      </div>
      <div class="import-stats">
        <span>${t("importValidCount", { count: valid.length })}</span>
        <span>${t("importDuplicateCount", { count: duplicates.length })}</span>
        <span>${t("importInvalidCount", { count: invalid.length })}</span>
      </div>
      ${
        headers.length
          ? `<div class="import-mapping">
              <label>
                ${t("importPreset")}
                <select id="csv-preset">
                  ${csvPresetOptions().map(
                    (preset) =>
                      `<option value="${preset.id}" ${preview.presetId === preset.id ? "selected" : ""}>${h(preset.label)}</option>`,
                  ).join("")}
                </select>
              </label>
              <div class="preset-actions">
                <button class="ghost-action" id="save-csv-preset" type="button">${t("saveCsvPreset")}</button>
                ${state.userCsvPresets.some((preset) => preset.id === preview.presetId) ? `<button class="ghost-action danger" id="delete-csv-preset" type="button">${t("deleteCsvPreset")}</button>` : ""}
              </div>
              <div class="mapping-grid">
                ${CSV_IMPORT_FIELDS.map(
                  (field) => `
                    <label>
                      ${h(field.label)}${field.required ? " *" : ""}
                      <select data-import-map="${field.key}">
                        <option value="">${t("ignoreColumn")}</option>
                        ${headers
                          .map(
                            (header) =>
                              `<option value="${h(header)}" ${mapping[field.key] === header ? "selected" : ""}>${h(header)}</option>`,
                          )
                          .join("")}
                      </select>
                    </label>
                  `,
                ).join("")}
              </div>
            </div>`
          : ""
      }
      ${
        previewRows.length
          ? `<div class="import-row-list">
              ${previewRows
                .map(
                  ({ purchase }) => `
                    <div class="import-row">
                      <strong>${h(purchase.productName)}</strong>
                      <span>${h(purchase.merchant)} · ${h(purchase.purchaseDate)} · ${money(purchase.price)}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>`
          : `<p class="empty-note">${t("noImportableRows")}</p>`
      }
      ${
        duplicates.length || invalid.length
          ? `<div class="import-issues">
              ${duplicates
                .slice(0, 3)
                .map(({ rowNumber, purchase }) => `<span>${h(t("duplicateImport", { row: rowNumber, product: purchase.productName }))}</span>`)
                .join("")}
              ${invalid
                .slice(0, 3)
                .map(({ rowNumber, issues }) => `<span>${h(t("rowIssues", { row: rowNumber, issues: issues.join(", ") }))}</span>`)
                .join("")}
            </div>`
          : ""
      }
    </section>
  `;
}

function renderPurchaseForm() {
  return `
    <section class="panel intake-panel" id="add-purchase">
      <div class="panel-heading">
        <div>
          <h2>${t("addPurchase")}</h2>
          <p>${t("manualEntries")}</p>
        </div>
        <span class="privacy-mark">${t("noUpload")}</span>
      </div>
      <form id="purchase-form" class="purchase-form">
        <label>
          ${t("product")}
          <input name="productName" required placeholder="Wireless Headset" />
        </label>
        <label>
          ${t("merchant")}
          <input name="merchant" required placeholder="Example Electronics" />
        </label>
        <label>
          ${t("purchaseDate")}
          <input name="purchaseDate" required type="date" value="${formatDate(today())}" />
        </label>
        <label>
          ${t("price")}
          <input name="price" required min="0" step="0.01" type="number" placeholder="129.99" />
        </label>
        <label>
          ${t("returnDays")}
          <input name="returnWindowDays" min="0" step="1" type="number" value="30" />
        </label>
        <label>
          ${t("refundDays")}
          <input name="refundWindowDays" min="0" step="1" type="number" value="14" />
        </label>
        <label>
          ${t("warrantyMonths")}
          <input name="warrantyMonths" min="0" step="1" type="number" value="12" />
        </label>
        <label>
          ${t("reminderLeadDays")}
          <input name="reminderLeadDays" min="0" step="1" type="number" value="3" />
        </label>
        <label>
          ${t("policyTemplate")}
          <select name="policyTemplate" id="policy-template">
            <option value="">${t("policyTemplateNone")}</option>
            ${POLICY_TEMPLATES.map((template) => `<option value="${template.id}">${h(template.label)}</option>`).join("")}
          </select>
          <span class="field-help">${t("policyTemplateHelp")}</span>
        </label>
        <label>
          ${t("model")}
          <input name="model" placeholder="HX-220" />
        </label>
        <label>
          ${t("serial")}
          <input name="serial" placeholder="${t("optional")}" />
        </label>
        <label>
          ${t("category")}
          <input name="category" placeholder="Appliance" />
        </label>
        <label>
          ${t("room")}
          <input name="room" placeholder="Kitchen" />
        </label>
        <label class="full">
          ${t("supportContact")}
          <input name="supportContact" placeholder="support@example.com / contractor name" />
        </label>
        <label>
          ${t("source")}
          <select name="source">
            <option value="manual">${t("sourceManual")}</option>
            <option value="receipt-text">${t("sourceReceiptText")}</option>
            <option value="csv-import">${t("sourceCsvImport")}</option>
          </select>
        </label>
        <label class="full checkbox-row">
          <input name="hasReceipt" type="checkbox" checked />
          ${t("receiptAvailable")}
        </label>
        <label class="full">
          ${t("notes")}
          <textarea name="notes" rows="3" placeholder="${t("notesPlaceholder")}"></textarea>
        </label>
        <label class="full">
          ${t("documents")}
          <textarea name="documents" rows="2" placeholder="${t("documentsPlaceholder")}"></textarea>
        </label>
        <label class="full">
          ${t("attachments")}
          <input name="attachments" type="file" multiple accept="image/*,application/pdf,.pdf" />
          <span class="field-help">${t("attachmentsHelp")}</span>
        </label>
        <label class="full">
          ${t("serviceNotes")}
          <textarea name="serviceNotes" rows="2" placeholder="${t("serviceNotesPlaceholder")}"></textarea>
        </label>
        <button class="primary-action full" type="submit">${icons.plus} ${t("savePurchase")}</button>
      </form>
    </section>
  `;
}

function renderParser() {
  const parsed = state.parsedReceipt;
  const preview = parsed
    ? `
      <div class="parser-preview">
        <div class="preview-meta">
          <strong>${parsed.merchant}</strong>
          <span>${parsed.purchaseDate || t("dateNotFound")} · ${money(parsed.total)} · ${t(confidenceLabelKeys[parsed.confidence] || parsed.confidence)} ${t("confidence")}</span>
        </div>
        <div class="preview-items">
          ${
            parsed.items.length
              ? parsed.items
                  .map(
                    (item, index) => `
                      <label class="preview-item">
                        <input type="checkbox" data-preview-item="${index}" checked />
                        <span>${item.name}</span>
                        <strong>${money(item.price)}</strong>
                      </label>
                    `,
                  )
                  .join("")
              : `<p class="empty-note">${t("noLineItems")}</p>`
          }
        </div>
        <button class="secondary-action" id="add-parsed-items" type="button">${icons.receipt} ${t("addSelectedItems")}</button>
      </div>
    `
    : `<p class="empty-note">${t("parserEmpty")}</p>`;

  return `
    <section class="panel parser-panel">
      <div class="panel-heading">
        <div>
          <h2>${t("parserTitle")}</h2>
          <p>${t("parserSubtitle")}</p>
        </div>
      </div>
      <textarea id="receipt-text" class="receipt-text" rows="9" spellcheck="false">Example Electronics
Receipt 7142
2026-06-02
Wireless Headset 129.99
Phone Case 24.99
Subtotal 154.98
Tax 12.01
Total 166.99</textarea>
      <div class="parser-actions">
        <label class="tool-button file-button">
          ${icons.import} ${t("localOcr")}
          <input id="ocr-file" type="file" accept="text/plain,text/csv,text/html,application/pdf,.txt,.csv,.html,.htm,.pdf,image/*" />
        </label>
        <button class="ghost-action" id="extract-local-ocr" type="button">${t("extractText")}</button>
        <button class="secondary-action" id="parse-receipt" type="button">${icons.receipt} ${t("parseReceipt")}</button>
        <button class="ghost-action" id="clear-parser" type="button">${t("clear")}</button>
      </div>
      ${state.ocrStatus ? `<p class="empty-note">${state.ocrStatus}</p>` : ""}
      ${preview}
    </section>
  `;
}

function deadlinePill(deadline) {
  return `
      <span class="deadline-pill ${deadline.status}">
      <span>${deadlineLabel(deadline)}</span>
      <strong>${deadline.date}</strong>
      <em>${t("dayShort", { count: deadline.daysLeft })}</em>
    </span>
  `;
}

function renderPurchaseRows() {
  const purchases = getFilteredPurchases();
  if (!purchases.length) {
    return `
      <div class="empty-state">
        <h3>${t("noMatchingPurchases")}</h3>
        <p>${t("noMatchingPurchasesBody")}</p>
      </div>
    `;
  }

  return `
    <div class="purchase-list" role="list">
      ${purchases
        .map(
          (purchase) => `
            <article class="purchase-row ${purchase.status === "resolved" ? "resolved" : ""}" role="listitem">
              <div class="purchase-main">
                <button class="row-title" data-select="${purchase.id}" type="button">
                  <strong>${purchase.productName}</strong>
                  <span>${purchase.merchant} · ${purchase.purchaseDate} · ${money(purchase.price)}</span>
                </button>
                <div class="proof-line">
                  <span class="${purchase.hasReceipt ? "proof-ok" : "proof-missing"}">
                    ${purchase.hasReceipt ? t("proofReady") : t("proofMissing")}
                  </span>
                  <span>${purchase.model || t("noModel")}</span>
                  <span>${purchase.serial || t("noSerial")}</span>
                  <span>${purchase.category || t("noCategory")}</span>
                  <span>${purchase.room || t("noRoom")}</span>
                </div>
              </div>
              <div class="deadline-stack">
                ${purchase.deadlines.map(deadlinePill).join("")}
              </div>
              <div class="row-actions">
                <button class="icon-action" title="${t("exportEvidencePack")}" aria-label="${t("exportEvidencePackFor", { product: purchase.productName })}" data-evidence="${purchase.id}" type="button">${icons.pack}</button>
                <button class="icon-action" title="${t("markResolved")}" aria-label="${t("markResolvedFor", { product: purchase.productName })}" data-resolve="${purchase.id}" type="button">${icons.check}</button>
                <button class="icon-action danger" title="${t("delete")}" aria-label="${t("deleteFor", { product: purchase.productName })}" data-delete="${purchase.id}" type="button">${icons.trash}</button>
              </div>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderQueue() {
  return `
    <section class="panel queue-panel" id="deadline-queue">
      <div class="panel-heading queue-heading">
        <div>
          <h2>${t("queueTitle")}</h2>
          <p>${t("queueSubtitle")}</p>
        </div>
        <div class="filter-tabs" role="tablist" aria-label="${t("queueTitle")}">
          ${["all", "due-soon", "return", "refund", "warranty", "missing-proof", "expired", "resolved"]
            .map(
              (filter) =>
                `<button class="${state.filter === filter ? "active" : ""}" data-filter="${filter}" type="button">${t(filterKeys[filter])}</button>`,
            )
            .join("")}
        </div>
      </div>
      ${renderPurchaseRows()}
    </section>
  `;
}

function renderDetail() {
  const selected = state.purchases.find((purchase) => purchase.id === state.selectedId) || state.purchases[0];
  if (!selected) {
    return `
      <section class="panel detail-panel">
        <h2>${t("evidenceDesk")}</h2>
        <p class="empty-note">${t("evidenceEmpty")}</p>
      </section>
    `;
  }
  const item = computeDeadlines(selected, today());
  const documents = Array.isArray(item.documents) ? item.documents : [];
  const attachments = purchaseAttachments(item);
  const hasLocalDocs = documents.length || attachments.length;
  return `
    <section class="panel detail-panel">
      <div class="panel-heading">
        <div>
          <h2>${t("evidenceDesk")}</h2>
          <p>${item.productName} · ${item.merchant}</p>
        </div>
        <div class="detail-actions">
          <button class="secondary-action" data-evidence="${item.id}" type="button">${icons.pack} ${t("exportPack")}</button>
          <button class="secondary-action" data-claim-packet="${item.id}" type="button">${icons.pack} ${t("claimPacket")}</button>
          <button class="secondary-action" data-claim-bundle="${item.id}" type="button">${icons.export} ${t("claimBundle")}</button>
          <button class="secondary-action" data-claim-zip="${item.id}" type="button">${icons.export} ${t("claimZip")}</button>
        </div>
      </div>
      <div class="deadline-math">
        ${item.deadlines
          .map(
            (deadline) => `
              <div>
                <span>${deadlineLabel(deadline)}</span>
                <strong>${deadline.date}</strong>
                <small>${t("daysLeft", { count: deadline.daysLeft })} · ${statusLabel(deadline.status)}</small>
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="claim-checklist">
        <label><input type="checkbox" ${item.hasReceipt ? "checked" : ""} disabled /> ${t("checklistReceipt")}</label>
        <label><input type="checkbox" disabled /> ${t("checklistPhotos")}</label>
        <label><input type="checkbox" disabled /> ${t("checklistBox")}</label>
        <label><input type="checkbox" ${item.serial ? "checked" : ""} disabled /> ${t("checklistSerial")}</label>
        <label><input type="checkbox" disabled /> ${t("checklistRma")}</label>
        <label><input type="checkbox" ${hasLocalDocs ? "checked" : ""} disabled /> ${t("checklistManuals")}</label>
        <label><input type="checkbox" ${attachments.length ? "checked" : ""} disabled /> ${t("checklistAttachments")}</label>
        <label><input type="checkbox" ${item.serviceNotes ? "checked" : ""} disabled /> ${t("checklistServiceHistory")}</label>
      </div>
      <div class="home-context">
        <h3>${t("homeContext")}</h3>
        <p>${item.category || t("noCategory")} · ${item.room || t("noRoom")}</p>
        <p>${item.supportContact || t("optional")}</p>
        <p>${t("reminderLeadLabel", { count: Number(item.reminderLeadDays ?? 3) })}</p>
      </div>
      <div class="document-list">
        <h3>${t("localDocs")}</h3>
        ${
          hasLocalDocs
            ? `<ul>
                ${documents.map((name) => `<li>${name}</li>`).join("")}
                ${attachments
                  .map(
                    (attachment, index) => `
                      <li class="attachment-item">
                        <span>${attachment.name} · ${fileSizeLabel(attachment.size)}</span>
                        <button class="inline-action" data-attachment-purchase="${item.id}" data-attachment-index="${index}" type="button">${t("downloadAttachment")}</button>
                      </li>
                    `,
                  )
                  .join("")}
              </ul>`
            : `<p>${t("noDocuments")}</p>`
        }
      </div>
      <p class="notes-block">${item.notes || t("noNotes")}</p>
      <p class="notes-block service-note">${item.serviceNotes || t("noNotes")}</p>
    </section>
  `;
}

function renderShell() {
  return `
    <aside class="sidebar">
      <a class="brand" href="#deadline-queue" aria-label="${t("appName")} home">
        <span class="brand-mark">${icons.check}</span>
        <span>
          <strong>${t("appName")}</strong>
          <small>${t("brandSubtitle")}</small>
        </span>
      </a>
      <nav class="side-nav" aria-label="${t("navDeadlineQueue")}">
        <a href="#deadline-queue" class="active">${t("navDeadlineQueue")}</a>
        <a href="#add-purchase">${t("navAddPurchase")}</a>
        <a href="#calendar-guide">${t("navCalendarGuide")}</a>
        <a href="#privacy">${t("navPrivacy")}</a>
      </nav>
      <div class="sidebar-note" id="privacy">
        <strong>${t("sidebarPrivateTitle")}</strong>
        <span>${t("sidebarPrivateBody")}</span>
      </div>
    </aside>
    <main class="main-panel">
      <header class="topbar">
        <div>
          <h1>${t("heroTitle")}</h1>
          <p>${t("heroSubtitle")}</p>
        </div>
        <div class="topbar-tools">
          <label class="language-select">
            <span>${t("languageLabel")}</span>
            <select id="language-select">
              ${languages
                .map(
                  (language) =>
                    `<option value="${language.code}" ${state.language === language.code ? "selected" : ""}>${language.label}</option>`,
                )
                .join("")}
            </select>
          </label>
          <label class="search-box">
            <span>${t("searchLabel")}</span>
            <input id="search-input" value="${state.search}" placeholder="${t("searchPlaceholder")}" />
          </label>
          <button class="tool-button" id="export-json" type="button">${icons.export} ${t("json")}</button>
          <button class="tool-button" id="export-csv" type="button">${icons.export} ${t("csv")}</button>
          <label class="tool-button file-button">
            ${icons.import} ${t("import")}
            <input id="import-json" type="file" accept="application/json,text/csv,.json,.csv" />
          </label>
          <button class="tool-button" id="enable-local-alerts" type="button">${icons.calendar} ${t("localAlerts")}</button>
          <button class="tool-button" id="export-ics" type="button">${icons.calendar} ${t("ics")}</button>
          ${state.notificationStatus ? `<span class="alert-status">${h(state.notificationStatus)}</span>` : ""}
        </div>
      </header>
      ${renderDashboard()}
      ${renderReminderGuide()}
      ${renderImportPreview()}
      <section class="workbench">
        ${renderPurchaseForm()}
        ${renderParser()}
      </section>
      <section class="lower-grid">
        ${renderQueue()}
        ${renderDetail()}
      </section>
    </main>
  `;
}

function render() {
  document.documentElement.lang = languageMeta(state.language).htmlLang;
  document.title = t("appName");
  app.innerHTML = renderShell();
}

function parseImportedJson(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Expected an array of purchases");
  return parsed;
}

async function parseImportedFile(file) {
  const text = await file.text();
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    return {
      mode: "preview",
      preview: {
        ...analyzeCsvImport(text, state.purchases, today()),
        sourceText: text,
        fileName: file.name,
      },
    };
  }
  return { mode: "replace", purchases: parseImportedJson(text) };
}

function reanalyzeImportPreview({ presetId, mapping } = {}) {
  if (!state.importPreview?.sourceText) return;
  const headers = state.importPreview.headers || [];
  const nextPresetId = presetId || state.importPreview.presetId || "auto";
  const savedPreset = state.userCsvPresets.find((preset) => preset.id === nextPresetId);
  const nextMapping = mapping || savedPreset?.mapping || (presetId ? csvMappingForPreset(headers, nextPresetId) : state.importPreview.mapping);
  state.importPreview = {
    ...analyzeCsvImport(state.importPreview.sourceText, state.purchases, today(), {
      presetId: nextPresetId,
      mapping: nextMapping,
    }),
    sourceText: state.importPreview.sourceText,
    fileName: state.importPreview.fileName,
  };
}

function validatePurchase(purchase) {
  return purchase.productName && purchase.merchant && purchase.purchaseDate;
}

function addParsedItems() {
  if (!state.parsedReceipt) return;
  const selected = [...document.querySelectorAll("[data-preview-item]:checked")].map((input) =>
    Number(input.dataset.previewItem),
  );
  const items = state.parsedReceipt.items.filter((_, index) => selected.includes(index));
  const createdAt = new Date().toISOString();
  const purchases = items.map((item) => ({
    id: makeId(),
    productName: item.name,
    merchant: state.parsedReceipt.merchant,
    purchaseDate: state.parsedReceipt.purchaseDate || formatDate(today()),
    price: item.price,
    returnWindowDays: item.returnWindowDays,
    refundWindowDays: item.refundWindowDays,
    warrantyMonths: item.warrantyMonths,
    reminderLeadDays: 3,
    model: "",
    serial: "",
    category: "Receipt import",
    room: "",
    supportContact: "",
    documents: [`${state.parsedReceipt.merchant} receipt text`],
    attachments: [],
    policyTemplateId: "",
    serviceNotes: "",
    source: "receipt-text",
    hasReceipt: true,
    notes: t("createdFromReceipt"),
    status: "active",
    createdAt,
  }));
  state.purchases = [...purchases, ...state.purchases];
  state.selectedId = purchases[0]?.id || state.selectedId;
  state.parsedReceipt = null;
  persistAndRender();
}

function exportEvidence(id) {
  const purchase = state.purchases.find((item) => item.id === id);
  if (!purchase) return;
  const safeName = purchase.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadText(`${safeName || "purchase"}-evidence-pack.md`, "text/markdown", evidencePackMarkdown(purchase, today()));
}

function exportClaimPacket(id) {
  const purchase = state.purchases.find((item) => item.id === id);
  if (!purchase) return;
  const safeName = purchase.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadText(`${safeName || "purchase"}-claim-packet.html`, "text/html", claimPacketHtml(purchase, today()));
}

function exportClaimBundle(id) {
  const purchase = state.purchases.find((item) => item.id === id);
  if (!purchase) return;
  const safeName = purchase.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadText(
    `${safeName || "purchase"}-claim-bundle.json`,
    "application/json",
    claimPacketBundleJson(purchase, today()),
  );
}

function exportClaimZip(id) {
  const purchase = state.purchases.find((item) => item.id === id);
  if (!purchase) return;
  const safeName = purchase.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const bytes = claimPacketZipBytes(purchase, today());
  downloadBlob(`${safeName || "purchase"}-claim-bundle.zip`, new Blob([bytes], { type: "application/zip" }));
}

function downloadAttachment(purchaseId, attachmentIndex) {
  const purchase = state.purchases.find((item) => item.id === purchaseId);
  const attachment = purchaseAttachments(purchase || {})[Number(attachmentIndex)];
  if (!attachment) return;
  const link = document.createElement("a");
  link.href = attachment.dataUrl;
  link.download = attachment.name;
  link.click();
}

app.addEventListener("submit", async (event) => {
  if (event.target.id !== "purchase-form") return;
  event.preventDefault();
  const purchase = await normalizePurchase(new FormData(event.target));
  if (!validatePurchase(purchase)) return;
  state.purchases = [purchase, ...state.purchases];
  state.selectedId = purchase.id;
  persistAndRender();
});

app.addEventListener("input", (event) => {
  if (event.target.id === "search-input") {
    state.search = event.target.value;
    render();
    event.target.focus();
    event.target.setSelectionRange(state.search.length, state.search.length);
  }
});

app.addEventListener("change", async (event) => {
  if (event.target.id === "language-select") {
    state.language = normalizeLanguage(event.target.value);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, state.language);
    render();
    return;
  }

  if (event.target.id === "csv-preset") {
    reanalyzeImportPreview({ presetId: event.target.value });
    render();
    return;
  }

  if (event.target.id === "policy-template") {
    const template = policyTemplateById(event.target.value);
    if (!template) return;
    const form = event.target.closest("form");
    form.querySelector('[name="returnWindowDays"]').value = template.returnWindowDays;
    form.querySelector('[name="refundWindowDays"]').value = template.refundWindowDays;
    form.querySelector('[name="warrantyMonths"]').value = template.warrantyMonths;
    const notes = form.querySelector('[name="notes"]');
    if (!notes.value.includes(template.note)) {
      notes.value = [notes.value.trim(), template.note].filter(Boolean).join("\n");
    }
    return;
  }

  if (event.target.dataset.importMap) {
    reanalyzeImportPreview({
      mapping: {
        ...(state.importPreview?.mapping || {}),
        [event.target.dataset.importMap]: event.target.value,
      },
    });
    render();
    return;
  }

  if (event.target.id !== "import-json") return;
  const [file] = event.target.files;
  if (!file) return;
  try {
    const imported = await parseImportedFile(file);
    if (imported.mode === "preview") {
      state.importPreview = imported.preview;
      render();
      return;
    }
    state.purchases = imported.purchases;
    state.selectedId = imported.purchases[0]?.id || "";
    await persistAndRender();
  } catch (error) {
    alert(t("importFailed", { message: error.message }));
  }
});

app.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.filter) {
    state.filter = button.dataset.filter;
    render();
    return;
  }

  if (button.dataset.select) {
    state.selectedId = button.dataset.select;
    render();
    return;
  }

  if (button.dataset.evidence) {
    exportEvidence(button.dataset.evidence);
    return;
  }

  if (button.dataset.claimPacket) {
    exportClaimPacket(button.dataset.claimPacket);
    return;
  }

  if (button.dataset.claimBundle) {
    exportClaimBundle(button.dataset.claimBundle);
    return;
  }

  if (button.dataset.claimZip) {
    exportClaimZip(button.dataset.claimZip);
    return;
  }

  if (button.dataset.attachmentPurchase) {
    downloadAttachment(button.dataset.attachmentPurchase, button.dataset.attachmentIndex);
    return;
  }

  if (button.dataset.resolve) {
    state.purchases = state.purchases.map((purchase) =>
      purchase.id === button.dataset.resolve ? { ...purchase, status: "resolved" } : purchase,
    );
    await persistAndRender();
    return;
  }

  if (button.dataset.delete) {
    state.purchases = state.purchases.filter((purchase) => purchase.id !== button.dataset.delete);
    state.selectedId = state.purchases[0]?.id || "";
    await persistAndRender();
    return;
  }

  if (button.id === "parse-receipt") {
    const text = document.querySelector("#receipt-text").value;
    state.parsedReceipt = parseReceiptText(text);
    render();
    return;
  }

  if (button.id === "confirm-import") {
    const purchases = (state.importPreview?.valid || []).map((row) => row.purchase);
    state.purchases = [...purchases, ...state.purchases];
    state.selectedId = purchases[0]?.id || state.selectedId;
    state.importPreview = null;
    await persistAndRender();
    return;
  }

  if (button.id === "save-csv-preset") {
    if (!state.importPreview?.mapping) return;
    const label = prompt(t("csvPresetName"), state.importPreview.fileName?.replace(/\.[^.]+$/, "") || "Custom CSV");
    if (!label) return;
    const id = `user-${Date.now()}`;
    saveUserCsvPresets([
      ...state.userCsvPresets,
      {
        id,
        label: String(label).trim(),
        mapping: state.importPreview.mapping,
      },
    ]);
    reanalyzeImportPreview({ presetId: id, mapping: state.importPreview.mapping });
    render();
    return;
  }

  if (button.id === "delete-csv-preset") {
    if (!state.importPreview?.presetId) return;
    saveUserCsvPresets(state.userCsvPresets.filter((preset) => preset.id !== state.importPreview.presetId));
    reanalyzeImportPreview({ presetId: "auto" });
    render();
    return;
  }

  if (button.id === "export-import-report") {
    if (!state.importPreview) return;
    const safeName = (state.importPreview.fileName || "csv-import").replace(/[^a-z0-9._-]+/gi, "-").replace(/^-|-$/g, "");
    downloadText(`${safeName || "csv-import"}-report.json`, "application/json", csvImportReport(state.importPreview, today()));
    return;
  }

  if (button.id === "cancel-import") {
    state.importPreview = null;
    render();
    return;
  }

  if (button.id === "extract-local-ocr") {
    const [file] = document.querySelector("#ocr-file")?.files || [];
    if (!file) return;
    try {
      const text = await extractLocalText(file);
      const receiptText = document.querySelector("#receipt-text");
      receiptText.value = text.trim() || receiptText.value;
      state.parsedReceipt = parseReceiptText(receiptText.value);
      state.ocrStatus = t("ocrDone");
      render();
    } catch (error) {
      state.ocrStatus = t("ocrFailed", { message: error.message });
      render();
    }
    return;
  }

  if (button.id === "clear-parser") {
    state.parsedReceipt = null;
    render();
    return;
  }

  if (button.id === "add-parsed-items") {
    addParsedItems();
    return;
  }

  if (button.id === "enable-local-alerts") {
    await enableLocalAlerts();
    return;
  }

  if (button.id === "export-json") {
    downloadText("return-warranty-guardian-backup.json", "application/json", JSON.stringify(state.purchases, null, 2));
    return;
  }

  if (button.id === "export-csv") {
    downloadText("return-warranty-guardian-export.csv", "text/csv", purchasesToCsv(state.purchases, today()));
    return;
  }

  if (button.id === "export-ics" || button.id === "export-ics-guide") {
    downloadText("return-warranty-guardian-deadlines.ics", "text/calendar", purchasesToIcs(state.purchases, today()));
  }
});

async function boot() {
  state.userCsvPresets = loadUserCsvPresets();
  state.purchases = await loadPurchases();
  if (!state.purchases.length) {
    state.purchases = samplePurchases;
    await savePurchases(state.purchases);
  }
  state.selectedId = state.purchases[0]?.id || "";
  render();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

boot();
