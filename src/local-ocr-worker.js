const TEMPLATE_CELL_WIDTH = 4;
const TEMPLATE_CELL_HEIGHT = 6;

const TEMPLATE_GLYPHS = {
  " ": ["000", "000", "000", "000", "000"],
  "-": ["000", "000", "111", "000", "000"],
  ".": ["000", "000", "000", "000", "010"],
  ":": ["000", "010", "000", "010", "000"],
  "$": ["111", "110", "111", "011", "111"],
  A: ["111", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["111", "100", "100", "100", "111"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["111", "100", "101", "101", "111"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "111"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["111", "101", "111", "100", "100"],
  Q: ["111", "101", "101", "111", "001"],
  R: ["110", "101", "110", "101", "101"],
  S: ["111", "100", "111", "001", "111"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
};

const TEMPLATE_LOOKUP = new Map(Object.entries(TEMPLATE_GLYPHS).map(([char, rows]) => [rows.join("/"), char]));

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
  return type === "image/svg+xml" || /\.svg$/i.test(name) || type === "image/x-portable-bitmap" || /\.pbm$/i.test(name);
}

function normalizedTemplateChar(char) {
  const normalized = String(char || " ").toUpperCase();
  return TEMPLATE_GLYPHS[normalized] ? normalized : " ";
}

export function renderBundledOcrPbm(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => [...line].map(normalizedTemplateChar).join(""))
    .filter((line) => line.length);
  const width = Math.max(1, ...lines.map((line) => line.length)) * TEMPLATE_CELL_WIDTH;
  const height = Math.max(1, lines.length) * TEMPLATE_CELL_HEIGHT - 1;
  const rows = Array.from({ length: height }, () => Array.from({ length: width }, () => "0"));

  lines.forEach((line, lineIndex) => {
    [...line.padEnd(width / TEMPLATE_CELL_WIDTH, " ")].forEach((char, charIndex) => {
      const glyph = TEMPLATE_GLYPHS[normalizedTemplateChar(char)] || TEMPLATE_GLYPHS[" "];
      glyph.forEach((glyphRow, rowIndex) => {
        [...glyphRow].forEach((pixel, columnIndex) => {
          rows[lineIndex * TEMPLATE_CELL_HEIGHT + rowIndex][charIndex * TEMPLATE_CELL_WIDTH + columnIndex] = pixel;
        });
      });
    });
  });

  return [
    "P1",
    "# return-warranty-guardian bundled-template-ocr-v1 cell=4x6",
    `${width} ${height}`,
    ...rows.map((row) => row.join(" ")),
  ].join("\n");
}

function parsePbm(source) {
  const tokens = String(source || "")
    .replace(/#[^\n\r]*/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.shift() !== "P1") throw new Error("Bundled local OCR template worker expects a plain PBM P1 bitmap.");
  const width = Number(tokens.shift() || 0);
  const height = Number(tokens.shift() || 0);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < TEMPLATE_CELL_WIDTH || height < 5) {
    throw new Error("Bundled local OCR template PBM has invalid dimensions.");
  }
  const pixels = tokens.map((token) => (token === "1" ? "1" : "0"));
  if (pixels.length < width * height) throw new Error("Bundled local OCR template PBM is missing pixel data.");
  return {
    width,
    height,
    rows: Array.from({ length: height }, (_, rowIndex) => pixels.slice(rowIndex * width, rowIndex * width + width)),
  };
}

function templateTextFromPbm(source) {
  const bitmap = parsePbm(source);
  const lineCount = Math.floor((bitmap.height + 1) / TEMPLATE_CELL_HEIGHT);
  const charCount = Math.floor(bitmap.width / TEMPLATE_CELL_WIDTH);
  const lines = [];
  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    let line = "";
    for (let charIndex = 0; charIndex < charCount; charIndex += 1) {
      const glyph = [];
      for (let rowOffset = 0; rowOffset < 5; rowOffset += 1) {
        const row = bitmap.rows[lineIndex * TEMPLATE_CELL_HEIGHT + rowOffset] || [];
        glyph.push(row.slice(charIndex * TEMPLATE_CELL_WIDTH, charIndex * TEMPLATE_CELL_WIDTH + 3).join(""));
      }
      line += TEMPLATE_LOOKUP.get(glyph.join("/")) || " ";
    }
    lines.push(line.replace(/\s+$/g, ""));
  }
  return lines.map((line) => line.trim()).filter(Boolean).join("\n");
}

export async function bundledLocalOcrWorker(file) {
  if (!bundledLocalOcrWorkerSupports(file)) {
    throw new Error("Bundled local OCR worker supports SVG fixtures and PBM template bitmaps.");
  }
  const source = typeof file?.text === "function" ? await file.text() : String(file || "");
  if (/^\s*P1\b/.test(source)) {
    const text = templateTextFromPbm(source);
    if (!text) throw new Error("Bundled local OCR template PBM did not produce text.");
    return text;
  }
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
