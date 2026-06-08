export const ENCRYPTED_BACKUP_SCHEMA = "return-warranty-guardian.encrypted-backup.v1";
export const BACKUP_PAYLOAD_SCHEMA = "return-warranty-guardian.backup-payload.v1";
export const RESTORE_PREVIEW_SCHEMA = "return-warranty-guardian.restore-preview.v1";
export const BACKUP_ATTACHMENT_LIMIT_BYTES = 5 * 1024 * 1024;
const KDF_ITERATIONS = 310000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function cryptoApi(cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle) throw new Error("WebCrypto is required for encrypted backups.");
  return cryptoImpl;
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(String(value || ""), "base64"));
  const binary = atob(String(value || ""));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length, cryptoImpl = globalThis.crypto) {
  const api = cryptoApi(cryptoImpl);
  const bytes = new Uint8Array(length);
  api.getRandomValues(bytes);
  return bytes;
}

async function deriveBackupKey(passphrase, salt, cryptoImpl = globalThis.crypto, iterations = KDF_ITERATIONS) {
  const api = cryptoApi(cryptoImpl);
  const baseKey = await api.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return api.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function requirePassphrase(passphrase) {
  if (!String(passphrase || "").trim()) throw new Error("A backup passphrase is required.");
}

export async function encryptedBackupEnvelope(payload, passphrase, now = new Date(), cryptoImpl = globalThis.crypto) {
  requirePassphrase(passphrase);
  const api = cryptoApi(cryptoImpl);
  const salt = randomBytes(16, api);
  const iv = randomBytes(12, api);
  const key = await deriveBackupKey(passphrase, salt, api);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await api.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));

  return {
    schema: ENCRYPTED_BACKUP_SCHEMA,
    createdAt: now.toISOString(),
    payloadSchema: payload?.schema || BACKUP_PAYLOAD_SCHEMA,
    crypto: {
      kdf: "PBKDF2",
      hash: "SHA-256",
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt),
      cipher: "AES-GCM",
      iv: bytesToBase64(iv),
      keyLength: 256,
    },
    ciphertext: bytesToBase64(ciphertext),
  };
}

export async function decryptBackupEnvelope(envelope, passphrase, cryptoImpl = globalThis.crypto) {
  requirePassphrase(passphrase);
  if (envelope?.schema !== ENCRYPTED_BACKUP_SCHEMA) throw new Error("Unsupported encrypted backup schema.");
  if (envelope?.crypto?.kdf !== "PBKDF2" || envelope?.crypto?.cipher !== "AES-GCM") {
    throw new Error("Unsupported encrypted backup crypto settings.");
  }
  if (!envelope?.crypto?.salt || !envelope?.crypto?.iv || !envelope?.ciphertext) {
    throw new Error("Corrupted encrypted backup file.");
  }

  const api = cryptoApi(cryptoImpl);
  const salt = base64ToBytes(envelope.crypto.salt);
  const iv = base64ToBytes(envelope.crypto.iv);
  const ciphertext = base64ToBytes(envelope.ciphertext);
  const key = await deriveBackupKey(passphrase, salt, api, Number(envelope.crypto.iterations || KDF_ITERATIONS));

  try {
    const plaintext = await api.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const payload = JSON.parse(decoder.decode(plaintext));
    if (payload?.schema !== BACKUP_PAYLOAD_SCHEMA) throw new Error("Unsupported backup payload schema.");
    return payload;
  } catch (error) {
    if (/Unsupported backup payload schema/.test(error.message)) throw error;
    throw new Error("Wrong passphrase or corrupted backup file.");
  }
}

export function backupDuplicateKey(purchase) {
  return [purchase?.productName, purchase?.merchant, purchase?.purchaseDate]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}

function attachmentBytes(attachment) {
  if (Number.isFinite(Number(attachment?.size))) return Number(attachment.size);
  const dataUrl = String(attachment?.dataUrl || "");
  const [, base64 = ""] = dataUrl.split(",");
  return base64 ? Math.ceil((base64.length * 3) / 4) : 0;
}

function attachmentReferenceFromSkipped(skipped, now = new Date()) {
  return {
    name: skipped?.attachmentName || skipped?.name || "",
    size: Number(skipped?.size || 0),
    reason: skipped?.reason === "over-size-limit" ? "skipped-large" : skipped?.reason || "needs-reattach",
    note: skipped?.note || "Attachment payload was not included in the encrypted backup. Reattach it or verify separate storage before submitting evidence.",
    createdAt: skipped?.createdAt || now.toISOString(),
  };
}

function skippedAttachmentRecord(attachment, purchase, reason, size, now = new Date()) {
  return {
    purchaseId: purchase?.id || "",
    productName: purchase?.productName || "",
    attachmentName: attachment?.name || "",
    size,
    reason,
    note: reason === "skipped-large"
      ? "Attachment was over the encrypted backup payload limit and must be kept separately."
      : "Attachment payload could not be hydrated from local browser storage during backup.",
    createdAt: attachment?.createdAt || now.toISOString(),
  };
}

function normalizeAttachmentReferences(purchase, now = new Date()) {
  return (Array.isArray(purchase?.attachmentReferences) ? purchase.attachmentReferences : [])
    .filter((reference) => reference?.name)
    .map((reference) => ({
      name: reference.name,
      size: Number(reference.size || 0),
      reason: reference.reason || "needs-reattach",
      note: reference.note || "Attachment must be reattached or verified in separate storage.",
      createdAt: reference.createdAt || now.toISOString(),
    }));
}

function sanitizeAttachmentForBackup(attachment, purchase, manifest, maxAttachmentBytes, now = new Date()) {
  const size = attachmentBytes(attachment);
  const dataUrl = String(attachment?.dataUrl || "");

  if (size > maxAttachmentBytes) {
    manifest.skippedAttachments.push(skippedAttachmentRecord(attachment, purchase, "skipped-large", size, now));
    return { ...attachment, dataUrl: "", opfsPath: "", storage: "backup-reference", backupStatus: "skipped-large" };
  }

  if (!dataUrl && (attachment?.opfsPath || attachment?.storage === "data-url")) {
    manifest.skippedAttachments.push(skippedAttachmentRecord(attachment, purchase, "hydration-failed", size, now));
    return { ...attachment, dataUrl: "", opfsPath: "", storage: "backup-reference", backupStatus: "hydration-failed" };
  }

  if (dataUrl) manifest.includedAttachmentCount += 1;
  return { ...attachment, dataUrl, backupStatus: dataUrl ? "backup-included" : attachment?.backupStatus || "" };
}

export async function backupPayloadFromState(
  {
    purchases = [],
    userCsvPresets = [],
    selfHostedAlerts = {},
    snoozedReminders = {},
    hydratePurchase = async (purchase) => purchase,
    maxAttachmentBytes = BACKUP_ATTACHMENT_LIMIT_BYTES,
  } = {},
  now = new Date(),
) {
  const backupManifest = {
    purchaseCount: purchases.length,
    attachmentCount: 0,
    includedAttachmentCount: 0,
    skippedAttachmentCount: 0,
    skippedAttachments: [],
  };

  const hydratedPurchases = [];
  for (const purchase of purchases) {
    const hydrated = await hydratePurchase(purchase);
    const attachments = Array.isArray(hydrated?.attachments) ? hydrated.attachments : [];
    const existingReferences = normalizeAttachmentReferences(hydrated, now);
    backupManifest.attachmentCount += attachments.length;
    for (const reference of existingReferences) {
      backupManifest.skippedAttachments.push({
        purchaseId: hydrated?.id || "",
        productName: hydrated?.productName || "",
        attachmentName: reference.name,
        size: reference.size,
        reason: reference.reason,
        note: reference.note,
        createdAt: reference.createdAt,
      });
    }
    hydratedPurchases.push({
      ...hydrated,
      attachments: attachments.map((attachment) =>
        sanitizeAttachmentForBackup(attachment, hydrated, backupManifest, maxAttachmentBytes, now),
      ),
      attachmentReferences: existingReferences,
    });
  }
  backupManifest.skippedAttachmentCount = backupManifest.skippedAttachments.length;

  return {
    schema: BACKUP_PAYLOAD_SCHEMA,
    createdAt: now.toISOString(),
    purchases: hydratedPurchases,
    userCsvPresets: Array.isArray(userCsvPresets) ? userCsvPresets : [],
    selfHostedAlerts: selfHostedAlerts && typeof selfHostedAlerts === "object" ? selfHostedAlerts : {},
    snoozedReminders: snoozedReminders && typeof snoozedReminders === "object" ? snoozedReminders : {},
    backupManifest,
  };
}

export function backupRestorePreview(payload, existingPurchases = []) {
  if (payload?.schema !== BACKUP_PAYLOAD_SCHEMA) throw new Error("Unsupported backup payload schema.");
  const purchases = Array.isArray(payload.purchases) ? payload.purchases : [];
  const existingKeys = new Set(existingPurchases.map(backupDuplicateKey).filter((key) => key !== "||"));
  const duplicateCandidates = purchases
    .map((purchase, index) => ({ purchase, index, key: backupDuplicateKey(purchase) }))
    .filter((candidate) => candidate.key !== "||" && existingKeys.has(candidate.key))
    .map((candidate) => ({
      index: candidate.index,
      productName: candidate.purchase.productName || "",
      merchant: candidate.purchase.merchant || "",
      purchaseDate: candidate.purchase.purchaseDate || "",
      key: candidate.key,
    }));
  const attachmentCount = purchases.reduce(
    (count, purchase) =>
      count + (Array.isArray(purchase.attachments) ? purchase.attachments.filter((attachment) => attachment?.dataUrl).length : 0),
    0,
  );
  const skippedAttachmentCount = Number(payload.backupManifest?.skippedAttachmentCount || payload.backupManifest?.skippedAttachments?.length || 0);
  const skippedAttachments = (Array.isArray(payload.backupManifest?.skippedAttachments) ? payload.backupManifest.skippedAttachments : [])
    .map((item) => ({
      purchaseId: item.purchaseId || "",
      productName: item.productName || "",
      attachmentName: item.attachmentName || item.name || "",
      size: Number(item.size || 0),
      reason: item.reason === "over-size-limit" ? "skipped-large" : item.reason || "needs-reattach",
      note: item.note || "",
      createdAt: item.createdAt || "",
    }));

  return {
    schema: RESTORE_PREVIEW_SCHEMA,
    backupCreatedAt: payload.createdAt || "",
    payloadSchema: payload.schema,
    recordCount: purchases.length,
    attachmentCount,
    skippedAttachmentCount,
    skippedAttachments,
    duplicateCandidates,
    importableCount: Math.max(0, purchases.length - duplicateCandidates.length),
  };
}

function skippedReferencesForPurchase(payload, purchase) {
  const skippedAttachments = Array.isArray(payload?.backupManifest?.skippedAttachments) ? payload.backupManifest.skippedAttachments : [];
  const purchaseId = purchase?.id || "";
  const productName = purchase?.productName || "";
  const fromManifest = skippedAttachments
    .filter((item) => (purchaseId && item.purchaseId === purchaseId) || (!item.purchaseId && item.productName === productName))
    .map((item) => attachmentReferenceFromSkipped(item));
  const existing = normalizeAttachmentReferences(purchase);
  const seen = new Set();
  return [...existing, ...fromManifest].filter((reference) => {
    const key = `${reference.name}|${reference.reason}|${reference.size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeRestoredPurchase(payload, purchase) {
  const references = skippedReferencesForPurchase(payload, purchase);
  const attachments = (Array.isArray(purchase?.attachments) ? purchase.attachments : []).map((attachment) => {
    if (attachment?.dataUrl) return { ...attachment, backupStatus: attachment.backupStatus || "backup-included" };
    return { ...attachment, dataUrl: "", opfsPath: "", storage: "backup-reference", backupStatus: attachment.backupStatus || "needs-reattach" };
  });
  return { ...purchase, attachments, attachmentReferences: references };
}

export function mergeBackupPurchases(payload, existingPurchases = []) {
  const preview = backupRestorePreview(payload, existingPurchases);
  const duplicateKeys = new Set(preview.duplicateCandidates.map((candidate) => candidate.key));
  const incoming = Array.isArray(payload.purchases) ? payload.purchases : [];
  const additions = incoming
    .filter((purchase) => !duplicateKeys.has(backupDuplicateKey(purchase)))
    .map((purchase) => normalizeRestoredPurchase(payload, purchase));
  return {
    purchases: [...additions, ...existingPurchases],
    addedCount: additions.length,
    duplicateCount: preview.duplicateCandidates.length,
    skippedAttachmentCount: preview.skippedAttachmentCount,
  };
}
