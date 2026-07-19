"use strict";
// Simulates WhatsApp: sends a message through the real handler pipeline and
// returns the outbound messages, without any network or Baileys.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { config } = require("../src/config");

// Redirect all persistence into a fresh temp dir so tests never touch real data.
function isolateData() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "csa-test-"));
  config.customersDir = path.join(tmp, "customers");
  config.ordersFile = path.join(tmp, "orders.json");
  config.ownerNumber = "919999999999";
  config.upiId = "test@upi";
  config.upiPayeeName = "Test Shop";
  return tmp;
}

const { handleMessage } = require("../src/handler");

async function send(from, text, opts = {}) {
  return handleMessage({ from, text, ...opts });
}

function textsTo(out, phone) {
  return out
    .filter((m) => m.to === String(phone) && m.text)
    .map((m) => m.text)
    .join("\n---\n");
}

function imagesTo(out, phone) {
  return out.filter((m) => m.to === String(phone) && (m.imagePath || m.imageBuffer));
}

module.exports = { isolateData, send, textsTo, imagesTo };
