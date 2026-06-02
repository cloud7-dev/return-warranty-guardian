const replacements = [
  { pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, value: "user@example.test" },
  { pattern: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{4}\b/g, value: "000-0000-0000" },
  { pattern: /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/g, value: "0000-0000-0000-0000" },
  { pattern: /\b(?:ORDER|ORD|INV|RMA|CASE|TICKET|승인|주문|영수증)[-_:\s]?[A-Z0-9-]{4,}\b/gi, value: "ORDER-EXAMPLE-001" },
  { pattern: /\b[A-Z]{2,5}-\d{4,}\b/g, value: "ID-EXAMPLE-001" },
  { pattern: /\b\d{5,6}(?:-\d{4})?\b/g, value: "00000" },
];

export function sanitizeFixtureText(input) {
  return replacements.reduce((text, item) => text.replace(item.pattern, item.value), String(input || ""));
}

export function sanitizeFixtureFilename(filename) {
  return String(filename || "fixture")
    .toLowerCase()
    .replace(/\.(csv|txt|html?|pdf)$/i, "")
    .replace(/[^a-z0-9가-힣._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "fixture";
}
