import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { addDays, addMonths, computeDeadlines, daysUntil, summarizePurchases } from "../src/deadline-engine.js";
import { sanitizeFixtureFilename, sanitizeFixtureText } from "../src/fixture-sanitizer.js";
import { analyzeCsvImport, csvImportReport, csvMappingForPreset, purchasesFromCsv } from "../src/importers.js";
import { textFromHtmlSource, textFromPdfSource } from "../src/local-extraction.js";
import { policyTemplateById } from "../src/policy-templates.js";
import { parseReceiptText } from "../src/receipt-parser.js";
import {
  claimPacketBundleJson,
  claimPacketHtml,
  claimPacketZipBytes,
  claimSubmissionTemplates,
  evidencePackMarkdown,
  purchasesToCsv,
  purchasesToIcs,
} from "../src/exporters.js";

const now = new Date("2026-06-02T10:00:00Z");
const fixture = (path) => readFile(new URL(`./fixtures/${path}`, import.meta.url), "utf8");

const sanitizedFixture = sanitizeFixtureText(`Jane Buyer
jane.buyer@example.com
010-1234-5678
ORDER AB12CD34
4111-1111-1111-1111
서울시 샘플구 12345`);
assert.doesNotMatch(sanitizedFixture, /jane\.buyer@example\.com/);
assert.doesNotMatch(sanitizedFixture, /010-1234-5678/);
assert.doesNotMatch(sanitizedFixture, /4111-1111-1111-1111/);
assert.match(sanitizedFixture, /user@example\.test/);
assert.equal(sanitizeFixtureFilename("Real Receipt 2026.pdf"), "real-receipt-2026");

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
  reminderLeadDays: 5,
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
    {
      name: "receipt-photo.png",
      type: "image/png",
      size: 96,
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
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
assert.match(csv, /reminder_lead_days/);
assert.match(csv, /Wireless Headset/);
assert.match(csv, /manual\.pdf/);
assert.match(csv, /warranty-card\.pdf/);

const imported = purchasesFromCsv(`product_name,merchant,purchase_date,price,return_days,refund_days,warranty_months,documents
"Imported Lamp","Home Store","2026-06-01","59.99","30","14","24","lamp-receipt.pdf; lamp-manual.pdf"`, now);
assert.equal(imported.length, 1);
assert.equal(imported[0].productName, "Imported Lamp");
assert.equal(imported[0].documents.length, 2);

const analyzed = analyzeCsvImport(
  `product_name,merchant,purchase_date,price
"Imported Lamp","Home Store","2026-06-01","59.99"
"Wireless Headset","Example Electronics","2026-06-02","129.99"
"Missing Merchant","","2026-06-01","10.00"`,
  [purchase],
  now,
);
assert.equal(analyzed.valid.length, 1);
assert.equal(analyzed.duplicates.length, 1);
assert.equal(analyzed.invalid.length, 1);
const importReport = JSON.parse(csvImportReport({ ...analyzed, fileName: "qa.csv" }, now));
assert.equal(importReport.schema, "return-warranty-guardian.csv-import-report.v1");
assert.equal(importReport.duplicateCount, 1);
assert.equal(importReport.invalidCount, 1);

const cardMapping = csvMappingForPreset(["transaction_date", "description", "amount"], "card-statement");
assert.equal(cardMapping.merchant, "description");
assert.equal(cardMapping.purchaseDate, "transaction_date");
assert.equal(cardMapping.price, "amount");
const mapped = analyzeCsvImport(
  `transaction_date,description,amount
"2026-06-01","Mapped Card Store","19.95"`,
  [],
  now,
  { presetId: "card-statement", mapping: cardMapping },
);
assert.equal(mapped.valid[0].purchase.productName, "Mapped Card Store");
assert.equal(mapped.valid[0].purchase.price, 19.95);
assert.equal(mapped.valid[0].purchase.reminderLeadDays, 3);

const koreanCardMapping = csvMappingForPreset(["승인일", "가맹점명", "이용금액"], "korean-card-statement");
assert.equal(koreanCardMapping.purchaseDate, "승인일");
assert.equal(koreanCardMapping.productName, "가맹점명");
assert.equal(koreanCardMapping.price, "이용금액");
const koreanCard = analyzeCsvImport(
  `승인일,가맹점명,이용금액
"2026-06-01","서울전자","₩39,900"`,
  [],
  now,
  { presetId: "korean-card-statement", mapping: koreanCardMapping },
);
assert.equal(koreanCard.valid[0].purchase.productName, "서울전자");
assert.equal(koreanCard.valid[0].purchase.price, 39900);

const amazonMapping = csvMappingForPreset(["order_date", "title", "seller", "item_subtotal", "order_id"], "amazon-style-order");
assert.equal(amazonMapping.productName, "title");
assert.equal(amazonMapping.documents, "order_id");

const koreanOrderMapping = csvMappingForPreset(["주문일", "상품명", "판매자", "결제금액", "주문번호"], "korean-shopping-order");
assert.equal(koreanOrderMapping.productName, "상품명");
assert.equal(koreanOrderMapping.merchant, "판매자");

const fixtureCases = [
  {
    path: "csv/korean-card-statement.csv",
    presetId: "korean-card-statement",
    expectedProduct: "서울전자",
    expectedPrice: 39900,
  },
  {
    path: "csv/korean-shopping-order.csv",
    presetId: "korean-shopping-order",
    expectedProduct: "무선 청소기 필터",
    expectedPrice: 18900,
  },
  {
    path: "csv/amazon-style-order.csv",
    presetId: "amazon-style-order",
    expectedProduct: "USB-C Hub",
    expectedPrice: 32.49,
  },
];
for (const item of fixtureCases) {
  const text = await fixture(item.path);
  const mapping = csvMappingForPreset(text.split(/\r?\n/)[0].split(","), item.presetId);
  const preview = analyzeCsvImport(text, [], now, { presetId: item.presetId, mapping });
  assert.equal(preview.valid.length, 1);
  assert.equal(preview.valid[0].purchase.productName, item.expectedProduct);
  assert.equal(preview.valid[0].purchase.price, item.expectedPrice);
}

const emailFixture = textFromHtmlSource(await fixture("receipts/email-receipt.html"));
assert.match(emailFixture, /Fixture Demo Store/);
assert.match(emailFixture, /Desk Organizer 18.50/);
assert.equal(parseReceiptText(emailFixture).items[0].name, "Desk Organizer");

const pdfText = textFromPdfSource(`%PDF-1.4
BT
(PDF Demo Store) Tj
[(Monitor) -20 ( Stand)] TJ
<323032362d30362d3032> Tj
ET`);
assert.match(pdfText, /PDF Demo Store/);
assert.match(pdfText, /Monitor Stand/);
assert.match(pdfText, /2026-06-02/);

const pdfFixtureText = textFromPdfSource(await fixture("pdf/simple-text-operator.pdf.txt"));
assert.match(pdfFixtureText, /PDF Fixture Store/);
assert.match(pdfFixtureText, /Warranty Router 89.00/);

const policyTemplate = policyTemplateById("extended-60-day-return");
assert.equal(policyTemplate.returnWindowDays, 60);
assert.match(policyTemplate.note, /Confirm current merchant terms/);
const policyFixtures = JSON.parse(await fixture("policies/templates.json"));
for (const item of policyFixtures) {
  const template = policyTemplateById(item.id);
  assert.equal(template.returnWindowDays, item.expectedReturnWindowDays);
  assert.equal(template.refundWindowDays, item.expectedRefundWindowDays);
  assert.equal(template.warrantyMonths, item.expectedWarrantyMonths);
}

const claimPacket = claimPacketHtml(purchase, now);
assert.match(claimPacket, /Claim Packet: Wireless Headset/);
assert.match(claimPacket, /Print or save PDF/);
assert.match(claimPacket, /warranty-card\.pdf/);
assert.match(claimPacket, /data:image\/png/);
assert.match(claimPacket, /Submission Note/);
assert.match(claimPacket, /Submission Templates/);
assert.match(claimPacket, /Merchant Return Request/);

const templates = claimSubmissionTemplates(purchase, now);
assert.equal(templates.length, 4);
assert.equal(templates.map((template) => template.id).join(","), "merchant-return,warranty-support,chargeback-summary,repair-intake");
assert.match(templates[1].body, /support@example\.test/);
assert.match(templates[3].body, /Home office/);

const claimBundle = JSON.parse(claimPacketBundleJson(purchase, now));
assert.equal(claimBundle.schema, "return-warranty-guardian.claim-bundle.v1");
assert.match(claimBundle.claimPacketHtml, /Claim Packet: Wireless Headset/);
assert.equal(claimBundle.submissionTemplates.length, 4);
assert.equal(claimBundle.attachments.length, 2);
const claimZip = claimPacketZipBytes(purchase, now);
assert.deepEqual([...claimZip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
assert.match(new TextDecoder().decode(claimZip), /claim-packet\.html/);
assert.match(new TextDecoder().decode(claimZip), /claim-bundle\.json/);
assert.match(new TextDecoder().decode(claimZip), /templates\/merchant-return\.txt/);

const ics = purchasesToIcs([purchase], now);
assert.match(ics, /BEGIN:VCALENDAR/);
assert.match(ics, /SUMMARY:Return deadline: Wireless Headset/);
assert.match(ics, /DTSTART;VALUE=DATE:20260702/);
assert.match(ics, /BEGIN:VALARM/);
assert.match(ics, /TRIGGER:-P5D/);

console.log("All logic tests passed.");
