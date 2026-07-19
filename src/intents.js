"use strict";
// Deterministic multilingual intent detection. Zero LLM tokens.
// English + Tamil (native & transliterated) + Hindi (native & transliterated).

const GREETINGS = [
  "hi", "hii", "hiii", "hello", "helo", "hey", "hai", "hlo", "yo",
  "good morning", "good afternoon", "good evening", "good night",
  "vanakkam", "vanakam", "namaste", "namaskar", "namaskaram",
  "வணக்கம்", "ஹாய்", "ஹலோ", "नमस्ते", "नमस्कार", "हाय", "हेलो",
];

const MENU_WORDS = [
  "menu", "catalog", "catalogue", "price list", "pricelist", "rate card",
  "collection", "collections", "products", "product list",
  "what do you have", "what do you sell", "what all you have",
  "மெனு", "கேட்டலாக்", "விலை பட்டியல்", "விலை",
  "मेन्यू", "मेनू", "कैटलॉग", "दाम", "रेट",
];

const IMAGE_WORDS = [
  "image", "images", "photo", "photos", "pic", "pics", "picture", "pictures",
  "படம்", "படங்கள்", "போட்டோ", "फोटो", "तस्वीर", "दिखाओ", "காட்டு", "காமி",
];

const CHECKOUT_WORDS = [
  "checkout", "check out", "place order", "place the order", "buy now",
  "confirm order", "i want to order", "order pannunga", "order podunga",
  "வாங்கணும்", "ஆர்டர்", "खरीदना", "ऑर्डर करना",
];

const CART_WORDS = ["cart", "my cart", "basket", "கார்ட்", "कार्ट"];

const PAID_WORDS = [
  "paid", "payment done", "i have paid", "amount sent", "money sent",
  "done payment", "panam anupiten", "katti vitten", "paisa bhej",
  "பணம் அனுப்பிட்டேன்", "பணம் கட்டிட்டேன்", "भुगतान कर दिया", "पैसे भेज दिए",
];

function norm(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAny(text, list) {
  return list.some((w) => text.includes(w));
}

function isGreeting(text) {
  const t = norm(text).replace(/[!.,👋🙏😊]/gu, "").trim();
  // pure greeting: short message that is (or starts with) a greeting word
  return GREETINGS.some((g) => t === g || (t.startsWith(g) && t.length <= g.length + 12));
}

function wantsMenu(text) {
  return containsAny(norm(text), MENU_WORDS);
}

function wantsImages(text) {
  return containsAny(norm(text), IMAGE_WORDS);
}

function wantsCheckout(text) {
  return containsAny(norm(text), CHECKOUT_WORDS);
}

function wantsCart(text) {
  const t = norm(text);
  return CART_WORDS.some((w) => t === w || t.includes(w));
}

function claimsPaid(text) {
  const t = norm(text);
  if (containsAny(t, PAID_WORDS)) return true;
  // UTR / transaction reference numbers are typically 12 digits
  if (/\b\d{12}\b/.test(t)) return true;
  return false;
}

// Extract a UTR-like reference if present
function extractPaymentRef(text) {
  const m = String(text || "").match(/\b\d{12}\b/);
  return m ? m[0] : null;
}

// Words stripped before matching product names in a "show me X" query
const PRODUCT_STOPWORDS = new Set([
  "show", "me", "the", "a", "an", "of", "for", "send", "see", "want", "need",
  "please", "pls", "can", "you", "i", "photo", "photos", "image", "images",
  "pic", "pics", "picture", "pictures", "with", "காட்டு", "படம்", "दिखाओ", "फोटो",
]);

function productQueryTerms(text) {
  return norm(text)
    .replace(/[?!.,]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !PRODUCT_STOPWORDS.has(w));
}

// Explicit product id like K01 / G03 / W02 mentioned anywhere
function extractProductId(text) {
  const m = String(text || "").match(/\b([kgw]\d{2})\b/i);
  return m ? m[1].toUpperCase() : null;
}

module.exports = {
  isGreeting,
  wantsMenu,
  wantsImages,
  wantsCheckout,
  wantsCart,
  claimsPaid,
  extractPaymentRef,
  productQueryTerms,
  extractProductId,
  norm,
};
