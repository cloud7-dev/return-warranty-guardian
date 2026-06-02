export const POLICY_TEMPLATES = [
  {
    id: "standard-30-day-return",
    label: "Standard 30-day return",
    returnWindowDays: 30,
    refundWindowDays: 14,
    warrantyMonths: 12,
    note: "Policy template: standard 30-day return. Confirm merchant policy, item exclusions, and receipt requirements before relying on this deadline.",
  },
  {
    id: "extended-60-day-return",
    label: "Extended 60-day retailer return",
    returnWindowDays: 60,
    refundWindowDays: 30,
    warrantyMonths: 12,
    note: "Policy template: extended 60-day return. Confirm current merchant terms, member-status rules, seasonal exceptions, and return-label requirements.",
  },
  {
    id: "warranty-only",
    label: "Warranty-only support",
    returnWindowDays: 0,
    refundWindowDays: 0,
    warrantyMonths: 12,
    note: "Policy template: warranty-only support. Use when the return/refund window is unavailable or unknown, and verify manufacturer claim steps.",
  },
  {
    id: "final-sale",
    label: "Final sale or no return",
    returnWindowDays: 0,
    refundWindowDays: 0,
    warrantyMonths: 0,
    note: "Policy template: final sale/no return. Confirm whether warranty, recall, or payment-dispute evidence still applies before closing the record.",
  },
];

export function policyTemplateById(id) {
  return POLICY_TEMPLATES.find((template) => template.id === id) || null;
}
