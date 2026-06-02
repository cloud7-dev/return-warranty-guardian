function decodeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCharCode(Number.parseInt(number, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function bundledLocalOcrWorkerSupports(file) {
  const name = String(file?.name || "");
  const type = String(file?.type || "");
  return type === "image/svg+xml" || /\.svg$/i.test(name);
}

export async function bundledLocalOcrWorker(file) {
  if (!bundledLocalOcrWorkerSupports(file)) {
    throw new Error("Bundled local OCR worker currently supports synthetic SVG OCR fixtures only.");
  }
  const source = typeof file?.text === "function" ? await file.text() : String(file || "");
  const match =
    source.match(/\bdata-rwg-ocr-text=(["'])([\s\S]*?)\1/i) ||
    source.match(/<metadata[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/metadata>/i);
  const text = decodeHtmlAttribute(match?.[2] || match?.[1] || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  if (!text) throw new Error("Bundled local OCR fixture did not contain OCR text metadata.");
  return text;
}

export function localOcrEnvironment(base = globalThis, file) {
  const environment = base || {};
  if (typeof environment.ReturnWarrantyGuardianOcrWorker === "function") return environment;
  if (!bundledLocalOcrWorkerSupports(file)) return environment;
  return {
    ...environment,
    ReturnWarrantyGuardianOcrWorker: bundledLocalOcrWorker,
  };
}
