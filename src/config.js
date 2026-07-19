"use strict";
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const ROOT = path.join(__dirname, "..");

// Accepted input formats for Indian numbers: "+91 XXXXXXXXXX" (with or
// without spaces) or a bare 10-digit mobile number. Output is always the
// WhatsApp form: 91XXXXXXXXXX.
function normalizeIndianNumber(raw) {
  const digits = String(raw || "").replace(/\D/g, ""); // "+91 89397..." -> "9189397..."
  if (digits.length === 10) return `91${digits}`;      // bare 10-digit mobile
  return digits;                                        // "+91"-prefixed already carries 91
}

function isValidIndianWhatsAppNumber(num) {
  return /^91[6-9]\d{9}$/.test(num); // Indian mobiles start 6-9, 10 digits after 91
}

const config = {
  root: ROOT,
  dataDir: path.join(ROOT, "data"),
  imagesDir: path.join(ROOT, "data", "images"),
  customersDir: path.join(ROOT, "data", "customers"),
  ordersFile: path.join(ROOT, "data", "orders.json"),
  catalogFile: path.join(ROOT, "data", "catalog.json"),
  authDir: path.join(ROOT, "auth"),

  groqApiKey: process.env.GROQ_API_KEY || "",
  groqModel: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",

  businessName: process.env.BUSINESS_NAME || "Sri Fashions",
  upiId: process.env.UPI_ID || "",
  upiPayeeName: process.env.UPI_PAYEE_NAME || process.env.BUSINESS_NAME || "Sri Fashions",
  freeDeliveryAbove: Number(process.env.FREE_DELIVERY_ABOVE || 999),
  deliveryCharge: Number(process.env.DELIVERY_CHARGE || 49),

  ownerNumber: normalizeIndianNumber(process.env.OWNER_WHATSAPP_NUMBER),
};

// Fails fast at startup so misconfiguration is obvious, but tests can
// import modules without a filled .env.
function validateForLive() {
  const missing = [];
  if (!config.groqApiKey) missing.push("GROQ_API_KEY");
  if (!config.upiId) missing.push("UPI_ID");
  if (!config.ownerNumber) missing.push("OWNER_WHATSAPP_NUMBER");
  if (missing.length) {
    throw new Error(
      `Missing required .env values: ${missing.join(", ")}. Copy .env.example to .env and fill them in.`
    );
  }
  if (!isValidIndianWhatsAppNumber(config.ownerNumber)) {
    throw new Error(
      `OWNER_WHATSAPP_NUMBER "${process.env.OWNER_WHATSAPP_NUMBER}" is not a valid Indian mobile. Use "+91 XXXXXXXXXX" or a bare 10-digit number.`
    );
  }
}

module.exports = { config, validateForLive };
