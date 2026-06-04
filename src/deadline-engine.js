export const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateString, days) {
  const base = parseDate(dateString);
  const amount = Number(days);
  if (!base || !Number.isFinite(amount) || amount <= 0) return "";
  return formatDate(new Date(base.getTime() + amount * DAY_MS));
}

export function addMonths(dateString, months) {
  const base = parseDate(dateString);
  const amount = Number(months);
  if (!base || !Number.isFinite(amount) || amount <= 0) return "";
  const result = new Date(base.getTime());
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + amount);
  if (result.getDate() < originalDay) result.setDate(0);
  return formatDate(result);
}

export function daysUntil(dateString, now = new Date()) {
  const target = parseDate(dateString);
  if (!target) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target.getTime() - today.getTime()) / DAY_MS);
}

export function statusFor(dateString, now = new Date(), dueSoonDays = 14) {
  const days = daysUntil(dateString, now);
  if (days === null) return "missing";
  if (days < 0) return "expired";
  if (days <= dueSoonDays) return "due-soon";
  return "active";
}

export function computeDeadlines(purchase, now = new Date()) {
  const returnDeadline = addDays(purchase.purchaseDate, purchase.returnWindowDays);
  const refundDeadline = addDays(purchase.purchaseDate, purchase.refundWindowDays);
  const warrantyDeadline = addMonths(purchase.purchaseDate, purchase.warrantyMonths);
  const priceProtectionDeadline = addDays(purchase.purchaseDate, purchase.priceProtectionDays);
  const priceProtectionCandidate =
    Boolean(priceProtectionDeadline) &&
    Number(purchase.lastSeenPrice || 0) > 0 &&
    Number(purchase.price || 0) > 0 &&
    Number(purchase.lastSeenPrice) < Number(purchase.price) &&
    statusFor(priceProtectionDeadline, now) !== "expired";
  const priceProtectionSavings = priceProtectionCandidate
    ? Number((Number(purchase.price) - Number(purchase.lastSeenPrice)).toFixed(2))
    : 0;
  const safetyCheckNeeded = Boolean(purchase.safetyNote || purchase.recallReferenceUrl) && !purchase.safetyCheckedAt;
  const deadlines = [
    {
      type: "return",
      label: "Return",
      date: returnDeadline,
      daysLeft: daysUntil(returnDeadline, now),
      status: statusFor(returnDeadline, now),
    },
    {
      type: "refund",
      label: "Refund",
      date: refundDeadline,
      daysLeft: daysUntil(refundDeadline, now),
      status: statusFor(refundDeadline, now),
    },
    {
      type: "warranty",
      label: "Warranty",
      date: warrantyDeadline,
      daysLeft: daysUntil(warrantyDeadline, now),
      status: statusFor(warrantyDeadline, now, 30),
    },
    {
      type: "price-protection",
      label: "Price protection",
      date: priceProtectionDeadline,
      daysLeft: daysUntil(priceProtectionDeadline, now),
      status: priceProtectionCandidate ? "due-soon" : statusFor(priceProtectionDeadline, now),
    },
  ].filter((deadline) => deadline.date);

  const nextDeadline = deadlines
    .filter((deadline) => deadline.daysLeft !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];

  return {
    ...purchase,
    deadlines,
    nextDeadline,
    returnDeadline,
    refundDeadline,
    warrantyDeadline,
    priceProtectionDeadline,
    priceProtectionCandidate,
    priceProtectionSavings,
    safetyCheckNeeded,
  };
}

export function summarizePurchases(purchases, now = new Date()) {
  const enriched = purchases.map((purchase) => computeDeadlines(purchase, now));
  const open = enriched.filter((purchase) => purchase.status !== "resolved");
  return {
    total: enriched.length,
    open: open.length,
    dueSoon: open.filter((purchase) =>
      purchase.deadlines.some((deadline) => deadline.status === "due-soon"),
    ).length,
    expired: open.filter((purchase) =>
      purchase.deadlines.some((deadline) => deadline.status === "expired"),
    ).length,
    missingProof: open.filter((purchase) => !purchase.hasReceipt).length,
    priceProtectionCandidates: open.filter((purchase) => purchase.priceProtectionCandidate).length,
    safetyCheckNeeded: open.filter((purchase) => purchase.safetyCheckNeeded).length,
    returnValueAtRisk: open
      .filter((purchase) =>
        purchase.deadlines.some(
          (deadline) => deadline.type === "return" && deadline.status !== "expired",
        ),
      )
      .reduce((sum, purchase) => sum + Number(purchase.price || 0), 0),
  };
}
