"use strict";
// Live tests against the Groq free tier. They self-skip when GROQ_API_KEY is
// not set, so `npm test` always works offline.
const test = require("node:test");
const assert = require("node:assert");

const { config } = require("../src/config");
const ft = require("./fake-transport");
ft.isolateData();

const store = require("../src/store");
const catalog = require("../src/catalog");
const brain = require("../src/brain");

const skip = !config.groqApiKey;
const opts = skip ? { skip: "GROQ_API_KEY not set" } : {};

function freshCustomer(phone) {
  const c = store.getCustomer(phone);
  c.welcomed = true;
  c.state = "browsing";
  store.saveCustomer(c);
  return c;
}

test("bestseller question → recommends bestsellers with reasons", opts, async () => {
  const c = freshCustomer("917777700001");
  const res = await brain.chat(c, "Which are your best selling products?");
  assert.ok(res.reply.length > 20, "empty reply");
  const best = catalog.bestsellers();
  const mentioned = best.filter(
    (p) => res.reply.includes(p.id) || res.reply.toLowerCase().includes(p.name.toLowerCase().slice(0, 12))
  );
  assert.ok(mentioned.length >= 2, `expected ≥2 bestsellers mentioned, got ${mentioned.length}: ${res.reply}`);
});

test("Tamil discount objection → replies in Tamil, holds price, steers to order", opts, async () => {
  const c = freshCustomer("917777700002");
  c.cart = [{ productId: "W02", size: "Free Size", qty: 1 }];
  store.saveCustomer(c);
  const res = await brain.chat(c, "விலை கொஞ்சம் குறைக்க முடியுமா? கொஞ்சம் தள்ளுபடி குடுங்க");
  assert.ok(res.reply.length > 10, "empty reply");
  assert.match(res.reply, /[஀-௿]/, `expected Tamil script in reply: ${res.reply}`);
  assert.ok(!/\d+\s*%\s*(off|discount)/i.test(res.reply), `invented a discount: ${res.reply}`);
});

test("occasion query → suggests matching products", opts, async () => {
  const c = freshCustomer("917777700003");
  const res = await brain.chat(c, "I need something for my daughter's wedding function");
  assert.ok(res.reply.length > 20, "empty reply");
  const weddingItems = catalog.byOccasion("wedding");
  const mentioned = weddingItems.filter(
    (p) => res.reply.includes(p.id) || res.reply.toLowerCase().includes(p.name.toLowerCase().slice(0, 12))
  );
  assert.ok(mentioned.length >= 1, `expected a wedding item mentioned: ${res.reply}`);
});

test("customer preference is remembered via set_preference or acknowledged", opts, async () => {
  const c = freshCustomer("917777700004");
  const res = await brain.chat(c, "I only wear pure cotton, remember that");
  const gotAction = (res.actions || []).some(
    (a) => a.action === "set_preference" && String(a.value).toLowerCase().includes("cotton")
  );
  const acknowledged = /cotton|பருத்தி/i.test(res.reply);
  assert.ok(gotAction || acknowledged, `preference neither stored nor acknowledged: ${JSON.stringify(res)}`);
});

test("buying intent produces an add_to_cart or checkout action", opts, async () => {
  const c = freshCustomer("917777700005");
  const res = await brain.chat(c, "I'll take the W01 kurti in size M, 1 piece");
  const acted = (res.actions || []).some(
    (a) => a.action === "add_to_cart" || a.action === "start_checkout"
  );
  assert.ok(acted, `expected add_to_cart/start_checkout action: ${JSON.stringify(res)}`);
});
