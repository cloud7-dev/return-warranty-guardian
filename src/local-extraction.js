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
  return source.replace(/[^\x09\x0a\x0d\x20-\x7e가-힣一-龥ぁ-ゔァ-ヴー]/g, " ");
}
