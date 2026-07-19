"use strict";
const fs = require("fs");
const path = require("path");
const { config } = require("./config");

let _catalog = null;

function loadCatalog() {
  if (!_catalog) {
    _catalog = JSON.parse(fs.readFileSync(config.catalogFile, "utf8"));
    const ids = new Set();
    for (const p of _catalog) {
      if (ids.has(p.id)) throw new Error(`Duplicate product id in catalog: ${p.id}`);
      ids.add(p.id);
      if (p.bestseller && !p.why) throw new Error(`Bestseller ${p.id} has empty "why"`);
    }
  }
  return _catalog;
}

function byId(id) {
  return loadCatalog().find((p) => p.id.toLowerCase() === String(id).toLowerCase()) || null;
}

// Loose name match: every word of the query must appear in the product name.
function search(query) {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return loadCatalog().filter((p) => {
    const name = p.name.toLowerCase();
    return words.every((w) => name.includes(w));
  });
}

function bestsellers() {
  return loadCatalog().filter((p) => p.bestseller);
}

function byOccasion(occasion) {
  const o = String(occasion).toLowerCase();
  return loadCatalog().filter((p) => p.occasions.includes(o));
}

function imagePath(product) {
  return path.join(config.imagesDir, product.image);
}

const CATEGORY_LABELS = { kids: "🧒 Kids", girls: "👧 Girls", women: "👩 Women" };

function formatMenu() {
  const cat = loadCatalog();
  const lines = [`🛍️ *${config.businessName} — Catalog*`, ""];
  for (const key of ["kids", "girls", "women"]) {
    lines.push(`*${CATEGORY_LABELS[key]}*`);
    for (const p of cat.filter((x) => x.category === key)) {
      lines.push(`  ${p.id}. ${p.name} — ₹${p.price}${p.bestseller ? " ⭐" : ""}`);
    }
    lines.push("");
  }
  lines.push("⭐ = bestseller");
  lines.push(`Reply with a product name or code (e.g. *${cat[0].id}*) for details & photo,`);
  lines.push('or say *"catalog with images"* to see pictures. 😊');
  return lines.join("\n");
}

function formatProductCaption(p) {
  return [
    `*${p.name}* (${p.id})${p.bestseller ? " ⭐" : ""}`,
    `💰 Price: ₹${p.price}`,
    `🧵 Fabric: ${p.fabric}`,
    `📏 Sizes: ${p.sizes.join(", ")}`,
    `🎉 Good for: ${p.occasions.join(", ")}`,
    p.bestseller && p.why ? `✨ ${p.why}` : null,
    "",
    `To order, just tell me the size & quantity! 🛒`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

// One-line-per-product digest kept small to save LLM tokens.
function compactDigest() {
  return loadCatalog()
    .map(
      (p) =>
        `${p.id}|${p.name}|${p.category}|₹${p.price}|sizes:${p.sizes.join("/")}|occ:${p.occasions.join("/")}|${p.fabric}${p.bestseller ? `|BESTSELLER:${p.why}` : ""}`
    )
    .join("\n");
}

module.exports = {
  loadCatalog,
  byId,
  search,
  bestsellers,
  byOccasion,
  imagePath,
  formatMenu,
  formatProductCaption,
  compactDigest,
};
