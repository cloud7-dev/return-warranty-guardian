import { readFile } from "node:fs/promises";

const requiredFiles = [
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "src/app.js",
  "src/deadline-engine.js",
  "src/receipt-parser.js",
  "src/storage.js",
  "src/exporters.js",
  "src/sample-data.js",
  "assets/icon.svg",
  "README.md",
  "LICENSE",
];

for (const file of requiredFiles) {
  await readFile(file, "utf8");
}

const html = await readFile("index.html", "utf8");
const css = await readFile("styles.css", "utf8");
const app = await readFile("src/app.js", "utf8");
const manifest = JSON.parse(await readFile("manifest.webmanifest", "utf8"));
const sw = await readFile("sw.js", "utf8");

const htmlRefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((ref) => !ref.startsWith("http"));

for (const ref of htmlRefs) {
  await readFile(ref.replace(/^\.\//, ""), "utf8");
}

if (manifest.display !== "standalone") {
  throw new Error("manifest display must be standalone");
}

for (const cached of [...sw.matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1].replace(/^\.\//, ""))) {
  await readFile(cached || "index.html", "utf8");
}

const requiredUiCopy = [
  "Never miss a return window or warranty again.",
  "Deadline queue",
  "Receipt text parser",
  "Evidence desk",
  "No account. No server upload.",
];

for (const copy of requiredUiCopy) {
  if (!app.includes(copy) && !html.includes(copy)) {
    throw new Error(`Missing required UI copy: ${copy}`);
  }
}

if (!css.includes("@media (max-width: 820px)")) {
  throw new Error("Missing mobile responsive breakpoint");
}

console.log("Static build check passed.");
