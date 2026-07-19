"use strict";
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const ROOT = path.join(__dirname, "..");

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

  ownerNumber: (process.env.OWNER_WHATSAPP_NUMBER || "").replace(/\D/g, ""),
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
}

module.exports = { config, validateForLive };
