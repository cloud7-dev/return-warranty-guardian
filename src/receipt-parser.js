const PRICE_PATTERN = /(?:\$|USD\s*)?([0-9]+(?:\.[0-9]{2}))\s*$/i;
const DATE_PATTERNS = [
  /\b(20[0-9]{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12][0-9]|3[01])\b/,
  /\b(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12][0-9]|3[01])[-/.](20[0-9]{2})\b/,
];

function normalizeDate(match, monthFirst = false) {
  if (!match) return "";
  const year = monthFirst ? match[3] : match[1];
  const month = String(monthFirst ? match[1] : match[2]).padStart(2, "0");
  const day = String(monthFirst ? match[2] : match[3]).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseReceiptText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const dateMatchIso = lines.join(" ").match(DATE_PATTERNS[0]);
  const dateMatchUs = lines.join(" ").match(DATE_PATTERNS[1]);
  const purchaseDate = dateMatchIso
    ? normalizeDate(dateMatchIso)
    : normalizeDate(dateMatchUs, true);

  const merchant =
    lines.find((line) => !/receipt|invoice|order|total|subtotal|tax/i.test(line)) ||
    "Unknown Merchant";

  const totalLine = [...lines].reverse().find((line) => /total/i.test(line) && PRICE_PATTERN.test(line));
  const total = totalLine ? Number(totalLine.match(PRICE_PATTERN)?.[1] || 0) : 0;

  const items = lines
    .filter((line) => PRICE_PATTERN.test(line))
    .filter((line) => !/receipt|invoice|order|date|subtotal|total|tax|visa|mastercard|change|balance/i.test(line))
    .filter((line) => !DATE_PATTERNS.some((pattern) => pattern.test(line)))
    .map((line) => {
      const price = Number(line.match(PRICE_PATTERN)?.[1] || 0);
      const name = line.replace(PRICE_PATTERN, "").replace(/[-–—:]+$/, "").trim();
      return {
        name: name || "Receipt item",
        price,
        returnWindowDays: 30,
        refundWindowDays: 14,
        warrantyMonths: 12,
      };
    });

  return {
    merchant,
    purchaseDate,
    total,
    items: items.length ? items : [],
    confidence: purchaseDate && merchant !== "Unknown Merchant" ? "medium" : "low",
  };
}
