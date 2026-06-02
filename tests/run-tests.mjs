import assert from "node:assert/strict";
import { addDays, addMonths, computeDeadlines, daysUntil, summarizePurchases } from "../src/deadline-engine.js";
import { purchasesFromCsv } from "../src/importers.js";
import { parseReceiptText } from "../src/receipt-parser.js";
import { claimPacketHtml, evidencePackMarkdown, purchasesToCsv, purchasesToIcs } from "../src/exporters.js";

const now = new Date("2026-06-02T10:00:00Z");

assert.equal(addDays("2026-06-02", 30), "2026-07-02");
assert.equal(addDays("2026-06-02", 14), "2026-06-16");
assert.equal(addMonths("2026-06-02", 12), "2027-06-02");
assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
assert.equal(daysUntil("2026-06-16", now), 14);

const purchase = {
  id: "test",
  productName: "Wireless Headset",
  merchant: "Example Electronics",
  purchaseDate: "2026-06-02",
  price: 129.99,
  returnWindowDays: 30,
  refundWindowDays: 14,
  warrantyMonths: 12,
  hasReceipt: true,
  status: "active",
  category: "Electronics",
  room: "Home office",
  supportContact: "support@example.test",
  documents: ["receipt.pdf", "manual.pdf"],
  attachments: [
    {
      name: "warranty-card.pdf",
      type: "application/pdf",
      size: 128,
      dataUrl: "data:application/pdf;base64,JVBERi0x",
    },
  ],
  serviceNotes: "No repairs yet.",
};

const enriched = computeDeadlines(purchase, now);
assert.equal(enriched.returnDeadline, "2026-07-02");
assert.equal(enriched.refundDeadline, "2026-06-16");
assert.equal(enriched.warrantyDeadline, "2027-06-02");
assert.equal(enriched.deadlines.find((deadline) => deadline.type === "refund").status, "due-soon");

const summary = summarizePurchases([purchase], now);
assert.equal(summary.total, 1);
assert.equal(summary.dueSoon, 1);
assert.equal(summary.missingProof, 0);
assert.equal(summary.returnValueAtRisk, 129.99);

const parsed = parseReceiptText(`Example Electronics
Receipt 7142
2026-06-02
Wireless Headset 129.99
Phone Case 24.99
Subtotal 154.98
Tax 12.01
Total 166.99`);

assert.equal(parsed.merchant, "Example Electronics");
assert.equal(parsed.purchaseDate, "2026-06-02");
assert.equal(parsed.total, 166.99);
assert.deepEqual(
  parsed.items.map((item) => item.name),
  ["Wireless Headset", "Phone Case"],
);

const pack = evidencePackMarkdown(purchase, now);
assert.match(pack, /Evidence Pack: Wireless Headset/);
assert.match(pack, /2026-07-02/);
assert.match(pack, /Claim Checklist/);
assert.match(pack, /receipt\.pdf/);
assert.match(pack, /warranty-card\.pdf/);
assert.match(pack, /Home office/);

const csv = purchasesToCsv([purchase], now);
assert.match(csv, /product_name/);
assert.match(csv, /Wireless Headset/);
assert.match(csv, /manual\.pdf/);
assert.match(csv, /warranty-card\.pdf/);

const imported = purchasesFromCsv(`product_name,merchant,purchase_date,price,return_days,refund_days,warranty_months,documents
"Imported Lamp","Home Store","2026-06-01","59.99","30","14","24","lamp-receipt.pdf; lamp-manual.pdf"`, now);
assert.equal(imported.length, 1);
assert.equal(imported[0].productName, "Imported Lamp");
assert.equal(imported[0].documents.length, 2);

const claimPacket = claimPacketHtml(purchase, now);
assert.match(claimPacket, /Claim Packet: Wireless Headset/);
assert.match(claimPacket, /Print or save PDF/);
assert.match(claimPacket, /warranty-card\.pdf/);

const ics = purchasesToIcs([purchase], now);
assert.match(ics, /BEGIN:VCALENDAR/);
assert.match(ics, /SUMMARY:Return deadline: Wireless Headset/);
assert.match(ics, /DTSTART;VALUE=DATE:20260702/);

console.log("All logic tests passed.");
