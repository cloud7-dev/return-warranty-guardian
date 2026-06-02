import { computeDeadlines, formatDate, summarizePurchases } from "./deadline-engine.js";
import { evidencePackMarkdown, purchasesToIcs, downloadText } from "./exporters.js";
import { parseReceiptText } from "./receipt-parser.js";
import { samplePurchases } from "./sample-data.js";
import { loadPurchases, savePurchases } from "./storage.js";

const app = document.querySelector("#app");

const state = {
  purchases: [],
  search: "",
  filter: "all",
  selectedId: "",
  parsedReceipt: null,
};

const today = () => new Date();

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
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function makeId() {
  return `purchase-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePurchase(formData) {
  return {
    id: makeId(),
    productName: String(formData.get("productName") || "").trim(),
    merchant: String(formData.get("merchant") || "").trim(),
    purchaseDate: String(formData.get("purchaseDate") || "").trim(),
    price: Number(formData.get("price") || 0),
    returnWindowDays: Number(formData.get("returnWindowDays") || 0),
    refundWindowDays: Number(formData.get("refundWindowDays") || 0),
    warrantyMonths: Number(formData.get("warrantyMonths") || 0),
    model: String(formData.get("model") || "").trim(),
    serial: String(formData.get("serial") || "").trim(),
    source: String(formData.get("source") || "manual"),
    hasReceipt: formData.get("hasReceipt") === "on",
    notes: String(formData.get("notes") || "").trim(),
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
      return [purchase.productName, purchase.merchant, purchase.model, purchase.serial, purchase.notes]
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
    <section class="summary-grid" aria-label="Purchase deadline summary">
      ${summaryCard("Due soon", summary.dueSoon, "Returns or warranties need action", "warning")}
      ${summaryCard("Open items", summary.open, `${summary.total} total records`, "")}
      ${summaryCard("Missing proof", summary.missingProof, "Attach or locate receipts", "risk")}
      ${summaryCard("Return value", money(summary.returnValueAtRisk), "Still inside return windows", "money")}
    </section>
  `;
}

function renderPurchaseForm() {
  return `
    <section class="panel intake-panel" id="add-purchase">
      <div class="panel-heading">
        <div>
          <h2>Add purchase</h2>
          <p>Manual entries stay on this device.</p>
        </div>
        <span class="privacy-mark">No upload</span>
      </div>
      <form id="purchase-form" class="purchase-form">
        <label>
          Product
          <input name="productName" required placeholder="Wireless Headset" />
        </label>
        <label>
          Merchant
          <input name="merchant" required placeholder="Example Electronics" />
        </label>
        <label>
          Purchase date
          <input name="purchaseDate" required type="date" value="${formatDate(today())}" />
        </label>
        <label>
          Price
          <input name="price" required min="0" step="0.01" type="number" placeholder="129.99" />
        </label>
        <label>
          Return days
          <input name="returnWindowDays" min="0" step="1" type="number" value="30" />
        </label>
        <label>
          Refund days
          <input name="refundWindowDays" min="0" step="1" type="number" value="14" />
        </label>
        <label>
          Warranty months
          <input name="warrantyMonths" min="0" step="1" type="number" value="12" />
        </label>
        <label>
          Model
          <input name="model" placeholder="HX-220" />
        </label>
        <label>
          Serial
          <input name="serial" placeholder="Optional" />
        </label>
        <label>
          Source
          <select name="source">
            <option value="manual">Manual</option>
            <option value="receipt-text">Receipt text</option>
            <option value="csv-import">CSV import</option>
          </select>
        </label>
        <label class="full checkbox-row">
          <input name="hasReceipt" type="checkbox" checked />
          Receipt or order proof is available
        </label>
        <label class="full">
          Notes
          <textarea name="notes" rows="3" placeholder="Return policy note, support case, RMA, box/accessories..."></textarea>
        </label>
        <button class="primary-action full" type="submit">${icons.plus} Save purchase</button>
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
          <span>${parsed.purchaseDate || "Date not found"} · ${money(parsed.total)} · ${parsed.confidence} confidence</span>
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
              : '<p class="empty-note">No line items found. Add the purchase manually or adjust the pasted text.</p>'
          }
        </div>
        <button class="secondary-action" id="add-parsed-items" type="button">${icons.receipt} Add selected items</button>
      </div>
    `
    : '<p class="empty-note">Paste a receipt, PDF invoice text, or order confirmation. The parser never saves anything until you confirm it.</p>';

  return `
    <section class="panel parser-panel">
      <div class="panel-heading">
        <div>
          <h2>Receipt text parser</h2>
          <p>Fast path for email receipts and copied invoices.</p>
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
        <button class="secondary-action" id="parse-receipt" type="button">${icons.receipt} Parse receipt</button>
        <button class="ghost-action" id="clear-parser" type="button">Clear</button>
      </div>
      ${preview}
    </section>
  `;
}

function deadlinePill(deadline) {
  return `
    <span class="deadline-pill ${deadline.status}">
      <span>${deadline.label}</span>
      <strong>${deadline.date}</strong>
      <em>${deadline.daysLeft}d</em>
    </span>
  `;
}

function renderPurchaseRows() {
  const purchases = getFilteredPurchases();
  if (!purchases.length) {
    return `
      <div class="empty-state">
        <h3>No matching purchases</h3>
        <p>Try another filter or add a receipt to start a deadline queue.</p>
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
                    ${purchase.hasReceipt ? "Proof ready" : "Proof missing"}
                  </span>
                  <span>${purchase.model || "No model"}</span>
                  <span>${purchase.serial || "No serial"}</span>
                </div>
              </div>
              <div class="deadline-stack">
                ${purchase.deadlines.map(deadlinePill).join("")}
              </div>
              <div class="row-actions">
                <button class="icon-action" title="Export evidence pack" aria-label="Export evidence pack for ${purchase.productName}" data-evidence="${purchase.id}" type="button">${icons.pack}</button>
                <button class="icon-action" title="Mark resolved" aria-label="Mark ${purchase.productName} resolved" data-resolve="${purchase.id}" type="button">${icons.check}</button>
                <button class="icon-action danger" title="Delete" aria-label="Delete ${purchase.productName}" data-delete="${purchase.id}" type="button">${icons.trash}</button>
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
          <h2>Deadline queue</h2>
          <p>Sorted by the closest return, refund, or warranty date.</p>
        </div>
        <div class="filter-tabs" role="tablist" aria-label="Deadline filters">
          ${["all", "due-soon", "return", "refund", "warranty", "missing-proof", "expired", "resolved"]
            .map(
              (filter) =>
                `<button class="${state.filter === filter ? "active" : ""}" data-filter="${filter}" type="button">${filter.replace("-", " ")}</button>`,
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
        <h2>Evidence desk</h2>
        <p class="empty-note">Select or create a purchase to see deadline math and claim checklist.</p>
      </section>
    `;
  }
  const item = computeDeadlines(selected, today());
  return `
    <section class="panel detail-panel">
      <div class="panel-heading">
        <div>
          <h2>Evidence desk</h2>
          <p>${item.productName} · ${item.merchant}</p>
        </div>
        <button class="secondary-action" data-evidence="${item.id}" type="button">${icons.pack} Export pack</button>
      </div>
      <div class="deadline-math">
        ${item.deadlines
          .map(
            (deadline) => `
              <div>
                <span>${deadline.label}</span>
                <strong>${deadline.date}</strong>
                <small>${deadline.daysLeft} days left · ${deadline.status}</small>
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="claim-checklist">
        <label><input type="checkbox" ${item.hasReceipt ? "checked" : ""} disabled /> Receipt or order confirmation</label>
        <label><input type="checkbox" disabled /> Product photos</label>
        <label><input type="checkbox" disabled /> Box and accessories</label>
        <label><input type="checkbox" ${item.serial ? "checked" : ""} disabled /> Serial/model number</label>
        <label><input type="checkbox" disabled /> Return label or RMA</label>
      </div>
      <p class="notes-block">${item.notes || "No notes yet."}</p>
    </section>
  `;
}

function renderShell() {
  return `
    <aside class="sidebar">
      <a class="brand" href="#deadline-queue" aria-label="Return & Warranty Guardian home">
        <span class="brand-mark">${icons.check}</span>
        <span>
          <strong>Return & Warranty Guardian</strong>
          <small>Local purchase memory</small>
        </span>
      </a>
      <nav class="side-nav" aria-label="Primary navigation">
        <a href="#deadline-queue" class="active">Deadline queue</a>
        <a href="#add-purchase">Add purchase</a>
        <a href="#privacy">Privacy</a>
      </nav>
      <div class="sidebar-note" id="privacy">
        <strong>Private by default</strong>
        <span>Purchases stay in browser storage. Export a JSON backup before clearing site data.</span>
      </div>
    </aside>
    <main class="main-panel">
      <header class="topbar">
        <div>
          <h1>Never miss a return window or warranty again.</h1>
          <p>No account. No server upload. A local deadline desk for the things you buy.</p>
        </div>
        <div class="topbar-tools">
          <label class="search-box">
            <span>Search</span>
            <input id="search-input" value="${state.search}" placeholder="Merchant, product, model..." />
          </label>
          <button class="tool-button" id="export-json" type="button">${icons.export} JSON</button>
          <label class="tool-button file-button">
            ${icons.import} Import
            <input id="import-json" type="file" accept="application/json" />
          </label>
          <button class="tool-button" id="export-ics" type="button">${icons.calendar} ICS</button>
        </div>
      </header>
      ${renderDashboard()}
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
  app.innerHTML = renderShell();
}

function parseImportedJson(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("Expected an array of purchases");
  return parsed;
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
    model: "",
    serial: "",
    source: "receipt-text",
    hasReceipt: true,
    notes: "Created from pasted receipt text. Verify merchant policy before relying on deadlines.",
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

app.addEventListener("submit", (event) => {
  if (event.target.id !== "purchase-form") return;
  event.preventDefault();
  const purchase = normalizePurchase(new FormData(event.target));
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
  if (event.target.id !== "import-json") return;
  const [file] = event.target.files;
  if (!file) return;
  try {
    const imported = parseImportedJson(await file.text());
    state.purchases = imported;
    state.selectedId = imported[0]?.id || "";
    await persistAndRender();
  } catch (error) {
    alert(`Import failed: ${error.message}`);
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

  if (button.id === "clear-parser") {
    state.parsedReceipt = null;
    render();
    return;
  }

  if (button.id === "add-parsed-items") {
    addParsedItems();
    return;
  }

  if (button.id === "export-json") {
    downloadText("return-warranty-guardian-backup.json", "application/json", JSON.stringify(state.purchases, null, 2));
    return;
  }

  if (button.id === "export-ics") {
    downloadText("return-warranty-guardian-deadlines.ics", "text/calendar", purchasesToIcs(state.purchases, today()));
  }
});

async function boot() {
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
