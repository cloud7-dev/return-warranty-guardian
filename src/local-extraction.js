export function textFromHtmlSource(raw) {
  const source = String(raw || "");
  if (typeof DOMParser === "function") {
    const doc = new DOMParser().parseFromString(source, "text/html");
    doc.querySelectorAll("script,style,noscript").forEach((node) => node.remove());
    doc.querySelectorAll("br,p,div,li,tr,h1,h2,h3,h4,h5,h6").forEach((node) => node.append("\n"));
    return doc.body.textContent
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:p|div|li|tr|h[1-6]|br)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function decodePdfLiteral(value) {
  const text = String(value || "").replace(/^\(/, "").replace(/\)$/, "");
  let output = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char !== "\\") {
      output += char;
      continue;
    }
    const next = text[index + 1];
    if (next === "n") output += "\n";
    else if (next === "r") output += "\n";
    else if (next === "t") output += "\t";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next === "(" || next === ")" || next === "\\") output += next;
    else if (/\d/.test(next || "")) {
      const octal = text.slice(index + 1).match(/^[0-7]{1,3}/)?.[0] || "";
      output += String.fromCharCode(Number.parseInt(octal, 8));
      index += octal.length - 1;
      continue;
    } else if (next === "\r" && text[index + 2] === "\n") {
      index += 2;
      continue;
    } else if (next === "\n" || next === "\r") {
      index += 1;
      continue;
    } else {
      output += next || "";
    }
    index += 1;
  }
  return output;
}

function decodePdfHex(value) {
  const hex = String(value || "").replace(/[<>\s]/g, "");
  if (!hex) return "";
  const bytes = [];
  for (let index = 0; index < hex.length; index += 2) {
    bytes.push(Number.parseInt(hex.slice(index, index + 2).padEnd(2, "0"), 16));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let output = "";
    for (let index = 2; index < bytes.length; index += 2) {
      output += String.fromCharCode((bytes[index] << 8) + (bytes[index + 1] || 0));
    }
    return output;
  }
  return String.fromCharCode(...bytes);
}

function pdfTextToken(value) {
  return value.startsWith("<") ? decodePdfHex(value) : decodePdfLiteral(value);
}

export function pdfExtractionStatus(raw) {
  return pdfExtractionDiagnostics(raw).status;
}

export function pdfExtractionDiagnostics(raw) {
  const source = String(raw || "");
  const hasTextOperators =
    /(\((?:\\[\s\S]|[^\\)])*\)|<[\da-fA-F\s]+>)\s*(?:Tj|'|")/g.test(source) ||
    /\[((?:\s*(?:\((?:\\[\s\S]|[^\\)])*\)|<[\da-fA-F\s]+>|-?\d+(?:\.\d+)?)\s*)+)\]\s*TJ/g.test(source);
  const hasImageXObject = /\/Subtype\s*\/Image|\/XObject\b/i.test(source);
  const hasCompressedStream = /\/Filter\s*\/?(?:FlateDecode|DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode)/i.test(source);
  const hasPotentialEncryption = /\/Encrypt\b/i.test(source);
  const status = hasTextOperators ? "text-operator" : hasImageXObject || hasCompressedStream ? "scanned-or-compressed" : "plain-fallback";
  return {
    status,
    hasTextOperators,
    hasImageXObject,
    hasCompressedStream,
    hasPotentialEncryption,
    noCloudOcrUsed: true,
    fallbackAction:
      status === "scanned-or-compressed"
        ? "Paste local OCR text manually or keep the PDF as local claim evidence."
        : "Use extracted browser-local text.",
  };
}

export function localOcrEnginePlan(environment = globalThis) {
  const hasTextDetector = typeof environment?.TextDetector === "function";
  const hasBundledWorker = typeof environment?.ReturnWarrantyGuardianOcrWorker === "function";
  const engine = hasBundledWorker ? "bundled-worker" : hasTextDetector ? "browser-text-detector" : "manual-fallback";
  return {
    schema: "return-warranty-guardian.local-ocr-engine-plan.v1",
    engine,
    available: hasBundledWorker || hasTextDetector,
    noCloudOcrUsed: true,
    requiresNetwork: false,
    fallbackAction: hasBundledWorker || hasTextDetector ? "Run local OCR before parsing receipt text." : "Paste OCR text manually or attach the file as local claim evidence.",
  };
}

export async function textFromImageSource(file, environment = globalThis) {
  const plan = localOcrEnginePlan(environment);
  if (plan.engine === "bundled-worker") {
    return environment.ReturnWarrantyGuardianOcrWorker(file);
  }
  if (plan.engine === "browser-text-detector") {
    const bitmap = await environment.createImageBitmap(file);
    try {
      const detector = new environment.TextDetector();
      const detections = await detector.detect(bitmap);
      return detections.map((item) => item.rawValue || "").filter(Boolean).join("\n");
    } finally {
      bitmap.close?.();
    }
  }
  throw new Error("Image OCR is not available locally. Paste receipt text or attach the file as local claim evidence.");
}

export function textFromPdfSource(raw) {
  const source = String(raw || "");
  const tokens = [];
  for (const match of source.matchAll(/(\((?:\\[\s\S]|[^\\)])*\)|<[\da-fA-F\s]+>)\s*(?:Tj|'|")/g)) {
    tokens.push(pdfTextToken(match[1]));
  }
  for (const match of source.matchAll(/\[((?:\s*(?:\((?:\\[\s\S]|[^\\)])*\)|<[\da-fA-F\s]+>|-?\d+(?:\.\d+)?)\s*)+)\]\s*TJ/g)) {
    const values = [...match[1].matchAll(/\((?:\\[\s\S]|[^\\)])*\)|<[\da-fA-F\s]+>/g)].map((item) => pdfTextToken(item[0]));
    if (values.length) tokens.push(values.join(""));
  }
  const extracted = tokens
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  if (extracted) return extracted;
  if (pdfExtractionStatus(source) === "scanned-or-compressed") {
    return [
      "PDF local extraction note: this PDF appears to be compressed, image-based, or scanned.",
      "Browser-local text operators were not found. Paste OCR text manually or keep the PDF as local claim evidence.",
      "No cloud OCR was used.",
    ].join("\n");
  }
  return source.replace(/[^\x09\x0a\x0d\x20-\x7e가-힣一-龥ぁ-ゔァ-ヴー]/g, " ");
}
