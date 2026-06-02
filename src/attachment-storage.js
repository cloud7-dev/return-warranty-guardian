const ATTACHMENT_ROOT = "rwg-attachments";

function safePathSegment(value) {
  return (
    String(value || "file")
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "file"
  );
}

function opfsAvailable() {
  return Boolean(globalThis.navigator?.storage?.getDirectory);
}

async function blobToDataUrl(blob) {
  if (typeof FileReader === "function") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const binary = typeof Buffer !== "undefined" ? Buffer.from(bytes).toString("base64") : btoa(String.fromCharCode(...bytes));
  return `data:${blob.type || "application/octet-stream"};base64,${binary}`;
}

async function attachmentRootHandle() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(ATTACHMENT_ROOT, { create: true });
}

async function writeOpfsAttachment(file, purchaseId) {
  const root = await attachmentRootHandle();
  const purchaseDirName = safePathSegment(purchaseId || "unassigned");
  const purchaseDir = await root.getDirectoryHandle(purchaseDirName, { create: true });
  const fileName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safePathSegment(file.name)}`;
  const handle = await purchaseDir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(file);
  await writable.close();
  return `${purchaseDirName}/${fileName}`;
}

async function readOpfsAttachment(opfsPath) {
  const [purchaseDirName, fileName] = String(opfsPath || "").split("/");
  if (!purchaseDirName || !fileName) return null;
  const root = await attachmentRootHandle();
  const purchaseDir = await root.getDirectoryHandle(purchaseDirName);
  const handle = await purchaseDir.getFileHandle(fileName);
  return handle.getFile();
}

export function localAttachmentStorageMode() {
  return opfsAvailable() ? "opfs" : "data-url";
}

export async function fileToLocalAttachment(file, purchaseId) {
  const base = {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    createdAt: new Date().toISOString(),
  };

  if (opfsAvailable()) {
    try {
      return {
        ...base,
        storage: "opfs",
        opfsPath: await writeOpfsAttachment(file, purchaseId),
      };
    } catch {
      // Fall through to data URL storage so attachment capture still works.
    }
  }

  return {
    ...base,
    storage: "data-url",
    dataUrl: await blobToDataUrl(file),
  };
}

export async function attachmentToDataUrl(attachment) {
  if (attachment?.dataUrl) return attachment.dataUrl;
  if (!attachment?.opfsPath || !opfsAvailable()) return "";
  try {
    return await blobToDataUrl(await readOpfsAttachment(attachment.opfsPath));
  } catch {
    return "";
  }
}

export async function hydratePurchaseAttachments(purchase) {
  const attachments = Array.isArray(purchase?.attachments) ? purchase.attachments : [];
  return {
    ...purchase,
    attachments: await Promise.all(
      attachments.map(async (attachment) => ({
        ...attachment,
        dataUrl: await attachmentToDataUrl(attachment),
      })),
    ),
  };
}
