"use strict";
const test = require("node:test");
const assert = require("node:assert");

const { config } = require("../src/config");
config.groqApiKey = ""; // deterministic suite must never hit the network

const ft = require("./fake-transport");
ft.isolateData();

const store = require("../src/store");
const catalog = require("../src/catalog");

const CUST = "918888800001";
const OWNER = "919999999999";

function browsingCustomer(phone) {
  const c = store.getCustomer(phone);
  c.welcomed = true;
  c.state = "browsing";
  store.saveCustomer(c);
  return c;
}

test("first contact with 'Hi' gets an instant welcome", async () => {
  const out = await ft.send("918888800010", "Hi");
  const text = ft.textsTo(out, "918888800010");
  assert.match(text, /Welcome/i);
  assert.ok(text.includes(config.businessName));
  assert.match(text, /menu/i);
});

test("first contact with a question gets welcome AND an answer path", async () => {
  const out = await ft.send("918888800011", "menu");
  const text = ft.textsTo(out, "918888800011");
  assert.match(text, /Welcome/i);
  assert.match(text, /Catalog/i); // menu also rendered
});

test("'menu' returns the catalog with names and prices", async () => {
  browsingCustomer(CUST);
  const out = await ft.send(CUST, "menu");
  const text = ft.textsTo(out, CUST);
  for (const p of catalog.loadCatalog()) {
    assert.ok(text.includes(p.name), `menu missing ${p.name}`);
    assert.ok(text.includes(`₹${p.price}`), `menu missing price of ${p.id}`);
  }
});

test("'catalog with images' sends every product image", async () => {
  browsingCustomer(CUST);
  const out = await ft.send(CUST, "catalog with images");
  const images = ft.imagesTo(out, CUST);
  assert.strictEqual(images.length, catalog.loadCatalog().length);
  assert.ok(images[0].caption.includes("₹"));
});

test("'kids catalog with images' filters to kids only", async () => {
  browsingCustomer(CUST);
  const out = await ft.send(CUST, "kids catalog with images");
  const images = ft.imagesTo(out, CUST);
  const kidsCount = catalog.loadCatalog().filter((p) => p.category === "kids").length;
  assert.strictEqual(images.length, kidsCount);
});

test("asking for a product by code sends its image + details", async () => {
  browsingCustomer(CUST);
  const out = await ft.send(CUST, "show me W01");
  const images = ft.imagesTo(out, CUST);
  assert.strictEqual(images.length, 1);
  assert.match(images[0].caption, /Soft Cotton Kurti/);
  assert.match(images[0].caption, /₹799/);
});

test("asking for a product by name with 'photo' sends the right image", async () => {
  browsingCustomer(CUST);
  const out = await ft.send(CUST, "photo of kanchipuram saree");
  const images = ft.imagesTo(out, CUST);
  assert.strictEqual(images.length, 1);
  assert.match(images[0].caption, /Kanchipuram/);
});

test("ambiguous image request lists the matching options", async () => {
  browsingCustomer(CUST);
  const out = await ft.send(CUST, "show me saree photos");
  const text = ft.textsTo(out, CUST);
  assert.match(text, /W02/);
  assert.match(text, /W05/);
});

test("plain product-name message auto-shows the single match", async () => {
  browsingCustomer(CUST);
  const out = await ft.send(CUST, "cotton kurti");
  const images = ft.imagesTo(out, CUST);
  assert.strictEqual(images.length, 1);
  assert.match(images[0].caption, /Soft Cotton Kurti/);
});

test("full checkout flow: cart → address → summary → UPI → paid → owner alert → confirm", async () => {
  const phone = "918888800020";
  const c = browsingCustomer(phone);
  c.cart = [
    { productId: "W01", size: "M", qty: 1 }, // 799
    { productId: "G05", size: "8-9y", qty: 1 }, // 399 → total 1198 ≥ 999 → free delivery
  ];
  store.saveCustomer(c);

  // checkout → asks for address
  let out = await ft.send(phone, "checkout");
  assert.match(ft.textsTo(out, phone), /address/i);

  // too-short address is rejected
  out = await ft.send(phone, "Chennai");
  assert.match(ft.textsTo(out, phone), /full address/i);

  // real address → order summary + QR + UPI link
  out = await ft.send(phone, "Sagar, 12 Gandhi Street, Anna Nagar, Chennai 600040");
  const text = ft.textsTo(out, phone);
  assert.match(text, /Order Summary — ORD\d+/);
  assert.match(text, /Items total: ₹1198/);
  assert.match(text, /Delivery: FREE/);
  assert.match(text, /Grand total: ₹1198/);
  assert.match(text, /Gandhi Street/);
  assert.ok(text.includes("upi://pay?"), "UPI link missing");
  assert.ok(text.includes("pa=test%40upi") || text.includes("pa=test@upi"), "UPI id missing");
  assert.match(text, /am=1198/);
  assert.match(text, /tn=ORD\d+/);
  const qrImages = ft.imagesTo(out, phone);
  assert.strictEqual(qrImages.length, 1, "QR image missing");
  assert.ok(qrImages[0].imageBuffer.length > 100);

  const orderId = text.match(/ORD\d+/)[0];

  // customer claims payment with a UTR
  out = await ft.send(phone, "paid 123456789012");
  assert.match(ft.textsTo(out, phone), /Thank you/i);
  const ownerAlert = ft.textsTo(out, OWNER);
  assert.match(ownerAlert, /Payment claimed/i);
  assert.ok(ownerAlert.includes(orderId));
  assert.ok(ownerAlert.includes("123456789012"));
  assert.strictEqual(store.getOrder(orderId).status, "payment_claimed");

  // owner confirms
  out = await ft.send(OWNER, `confirm ${orderId}`);
  assert.match(ft.textsTo(out, phone), /CONFIRMED/i);
  assert.match(ft.textsTo(out, OWNER), /confirmed/i);
  assert.strictEqual(store.getOrder(orderId).status, "confirmed");
});

test("delivery charge applies below the free-delivery threshold", async () => {
  const phone = "918888800021";
  const c = browsingCustomer(phone);
  c.cart = [{ productId: "K05", size: "2-3y", qty: 1 }]; // 379 < 999
  c.state = "collecting_address";
  store.saveCustomer(c);

  const out = await ft.send(phone, "No 5, Mint Street, Sowcarpet, Chennai 600079");
  const text = ft.textsTo(out, phone);
  assert.match(text, /Items total: ₹379/);
  assert.match(text, new RegExp(`Delivery: ₹${config.deliveryCharge}`));
  assert.match(text, new RegExp(`Grand total: ₹${379 + config.deliveryCharge}`));
});

test("payment claim via screenshot (image, no text) works", async () => {
  const phone = "918888800022";
  const c = browsingCustomer(phone);
  c.cart = [{ productId: "W02", size: "Free Size", qty: 1 }];
  c.state = "collecting_address";
  store.saveCustomer(c);
  let out = await ft.send(phone, "Flat 2B, Lake View Road, Coimbatore 641001");
  const orderId = ft.textsTo(out, phone).match(/ORD\d+/)[0];

  out = await ft.send(phone, "", { hasImage: true });
  assert.match(ft.textsTo(out, phone), /Thank you/i);
  const order = store.getOrder(orderId);
  assert.strictEqual(order.status, "payment_claimed");
  assert.strictEqual(order.paymentRef, "screenshot");
});

test("customer memory persists across restarts (new store read)", async () => {
  const phone = "918888800023";
  const c = browsingCustomer(phone);
  c.preferences.fabric = "cotton";
  c.name = "Priya";
  store.saveCustomer(c);
  const again = store.getCustomer(phone);
  assert.strictEqual(again.preferences.fabric, "cotton");
  assert.strictEqual(again.name, "Priya");
});

test("free-form question without LLM key gets the graceful fallback", async () => {
  browsingCustomer(CUST);
  const out = await ft.send(CUST, "do you have anything nice for a wedding?");
  const text = ft.textsTo(out, CUST);
  assert.ok(text.length > 0);
  assert.match(text, /menu/i);
});

test("owner 'confirm' on unknown order reports not found", async () => {
  const out = await ft.send(OWNER, "confirm ORD999");
  assert.match(ft.textsTo(out, OWNER), /not found/i);
});

test("UPI link format is correct", () => {
  const payment = require("../src/payment");
  const link = payment.upiLink(1234, "ORD007");
  assert.ok(link.startsWith("upi://pay?"));
  assert.ok(link.includes("am=1234"));
  assert.ok(link.includes("tn=ORD007"));
  assert.ok(link.includes("cu=INR"));
});
