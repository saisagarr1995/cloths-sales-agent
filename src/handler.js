"use strict";
// Transport-agnostic message pipeline. Both the real WhatsApp wiring
// (src/index.js) and the test fake transport call handleMessage() and then
// deliver the returned outbound messages.
//
// Outbound message shape:
//   { to, text }                                — plain text
//   { to, imagePath|imageBuffer, caption }      — image with caption

const { config } = require("./config");
const catalog = require("./catalog");
const store = require("./store");
const payment = require("./payment");
const intents = require("./intents");
const brain = require("./brain");

function welcomeText() {
  return [
    `👋 Vanakkam! Welcome to *${config.businessName}* 🛍️`,
    "",
    "We sell beautiful clothes for *Kids 🧒, Girls 👧 and Women 👩* at great prices.",
    "",
    "You can:",
    '  • type *"menu"* to see our catalog with prices',
    '  • type *"catalog with images"* to see photos',
    "  • ask me anything — best sellers, dresses for an occasion, sizes…",
    "",
    "நீங்கள் தமிழிலும் பேசலாம் 😊 (You can chat in Tamil or any language!)",
  ].join("\n");
}

async function sendCatalogImages(out, to, text) {
  // Optional category filter: "kids catalog with images"
  const t = intents.norm(text);
  let products = catalog.loadCatalog();
  for (const c of ["kids", "girls", "women"]) {
    if (t.includes(c)) {
      products = products.filter((p) => p.category === c);
      break;
    }
  }
  for (const p of products) {
    out.push({
      to,
      imagePath: catalog.imagePath(p),
      caption: `${p.name} (${p.id}) — ₹${p.price}${p.bestseller ? " ⭐" : ""}`,
    });
  }
  out.push({
    to,
    text: `That's our collection! 😍 Reply with a product code (e.g. *${products[0].id}*) for details, or tell me what you're looking for.`,
  });
}

function sendProduct(out, to, p) {
  out.push({ to, imagePath: catalog.imagePath(p), caption: catalog.formatProductCaption(p) });
}

function startCheckout(customer, out) {
  if (!customer.cart.length) {
    out.push({
      to: customer.phone,
      text: 'Your cart is empty 🛒 — type *"menu"* to browse, then tell me which item, size and quantity you want!',
    });
    return;
  }
  customer.state = "collecting_address";
  out.push({
    to: customer.phone,
    text: `${payment.cartText(customer.cart)}\n\n📦 Great choice! Please send your *full delivery address with pincode* (and your name) to proceed.`,
  });
}

async function placeOrder(customer, address, out) {
  const totals = payment.cartTotals(customer.cart);
  const order = store.createOrder({
    phone: customer.phone,
    items: totals.items,
    itemsTotal: totals.itemsTotal,
    deliveryCharge: totals.deliveryCharge,
    grandTotal: totals.grandTotal,
    address,
  });
  customer.address = address;
  customer.activeOrderId = order.id;
  customer.state = "awaiting_payment";
  customer.cart = [];

  out.push({ to: customer.phone, text: payment.orderSummaryText(order) });
  try {
    const qr = await payment.upiQrPng(order.grandTotal, order.id);
    out.push({ to: customer.phone, imageBuffer: qr, caption: `Scan to pay ₹${order.grandTotal} (${order.id})` });
  } catch {
    // QR generation failing must not block the payment link
  }
  out.push({ to: customer.phone, text: payment.paymentInstructionText(order) });
}

function handlePaymentClaim(customer, text, hasImage, out) {
  const order = customer.activeOrderId ? store.getOrder(customer.activeOrderId) : null;
  if (!order || order.status === "confirmed") {
    out.push({
      to: customer.phone,
      text: "I don't see a pending order for you 🤔 — type *\"menu\"* to start shopping!",
    });
    return;
  }
  const paymentRef = intents.extractPaymentRef(text) || (hasImage ? "screenshot" : null);
  store.updateOrder(order.id, { status: "payment_claimed", paymentRef });
  customer.state = "browsing";

  out.push({
    to: customer.phone,
    text: `🙏 Thank you! We've received your payment confirmation for *${order.id}* (₹${order.grandTotal}).\nWe'll verify it and confirm your order shortly — you'll get a message here. 💚`,
  });
  if (config.ownerNumber) {
    out.push({
      to: config.ownerNumber,
      text: [
        `🔔 *Payment claimed for ${order.id}*`,
        `Customer: ${customer.phone}`,
        `Amount: ₹${order.grandTotal}`,
        paymentRef ? `Ref: ${paymentRef}` : "Ref: (none given)",
        "",
        payment.orderSummaryText(order),
        "",
        `✅ Verify in your UPI app, then reply *confirm ${order.id}* to confirm this order.`,
      ].join("\n"),
    });
  }
}

function handleOwnerCommand(text, out) {
  const m = String(text || "").match(/^\s*confirm\s+(ord\d+)\s*$/i);
  if (!m) return false;
  const order = store.getOrder(m[1]);
  if (!order) {
    out.push({ to: config.ownerNumber, text: `❌ Order ${m[1].toUpperCase()} not found.` });
    return true;
  }
  if (order.status === "confirmed") {
    out.push({ to: config.ownerNumber, text: `ℹ️ ${order.id} is already confirmed.` });
    return true;
  }
  store.updateOrder(order.id, { status: "confirmed" });
  out.push({
    to: order.phone,
    text: `🎉 *Your order ${order.id} is CONFIRMED!*\nPayment of ₹${order.grandTotal} received. Your items will be packed and shipped to:\n${order.address}\n\nThank you for shopping with ${config.businessName}! 💚`,
  });
  out.push({ to: config.ownerNumber, text: `✅ ${order.id} confirmed. Customer has been notified.` });
  return true;
}

// Execute one structured action returned by the LLM
function runAction(action, customer, out) {
  switch (action && action.action) {
    case "add_to_cart": {
      const p = catalog.byId(action.productId);
      if (!p) return;
      const qty = Math.max(1, Math.min(20, Number(action.qty) || 1));
      customer.cart.push({ productId: p.id, size: action.size || p.sizes[0], qty });
      out.push({
        to: customer.phone,
        text: `${payment.cartText(customer.cart)}\n\nType *"checkout"* when you're ready to order 🛍️`,
      });
      break;
    }
    case "remove_from_cart": {
      customer.cart = customer.cart.filter(
        (l) => l.productId.toLowerCase() !== String(action.productId || "").toLowerCase()
      );
      out.push({ to: customer.phone, text: payment.cartText(customer.cart) });
      break;
    }
    case "send_product_image": {
      const p = catalog.byId(action.productId);
      if (p) sendProduct(out, customer.phone, p);
      break;
    }
    case "set_preference": {
      if (action.key) customer.preferences[String(action.key)] = action.value;
      break;
    }
    case "start_checkout":
      startCheckout(customer, out);
      break;
    default:
      break;
  }
}

async function handleMessage({ from, text, hasImage = false }) {
  const out = [];
  const phone = String(from).replace(/\D/g, "");
  text = String(text || "").trim();

  // ---- 0. owner commands ----
  if (config.ownerNumber && phone === config.ownerNumber) {
    if (handleOwnerCommand(text, out)) return out;
    // owner chatting normally falls through (useful for self-testing)
  }

  const customer = store.getCustomer(phone);
  const firstContact = !customer.welcomed;

  // ---- 1. instant welcome on first contact ----
  if (firstContact) {
    customer.welcomed = true;
    customer.state = "browsing";
    out.push({ to: phone, text: welcomeText() });
    if (intents.isGreeting(text) || !text) {
      store.saveCustomer(customer);
      return out;
    }
    // non-greeting first message: welcome + keep processing it below
  }

  if (text) customer.history.push({ role: "user", text });

  try {
    // ---- 2. state machine ----
    if (customer.state === "collecting_address") {
      if (intents.wantsMenu(text) || intents.isGreeting(text)) {
        // let them browse again
        customer.state = "browsing";
      } else if (text.length < 10) {
        out.push({
          to: phone,
          text: "That looks a bit short for a delivery address 🤏 — please send your *full address with pincode* (house/street, area, city, pincode).",
        });
        store.saveCustomer(customer);
        return out;
      } else {
        await placeOrder(customer, text, out);
        store.saveCustomer(customer);
        return out;
      }
    }

    if (customer.state === "awaiting_payment" && (intents.claimsPaid(text) || hasImage)) {
      handlePaymentClaim(customer, text, hasImage, out);
      store.saveCustomer(customer);
      return out;
    }

    // ---- 3. deterministic intents ----
    if (intents.isGreeting(text) && !firstContact) {
      out.push({
        to: phone,
        text: `Hi again! 😊 Type *"menu"* for our catalog, or tell me what you're looking for.`,
      });
    } else if (intents.wantsMenu(text) && intents.wantsImages(text)) {
      await sendCatalogImages(out, phone, text);
    } else if (intents.wantsMenu(text)) {
      out.push({ to: phone, text: catalog.formatMenu() });
    } else if (intents.wantsCart(text)) {
      out.push({
        to: phone,
        text: `${payment.cartText(customer.cart)}${customer.cart.length ? '\n\nType *"checkout"* to place the order!' : ""}`,
      });
    } else if (intents.wantsCheckout(text)) {
      startCheckout(customer, out);
    } else {
      // explicit product id or "show me X"
      const id = intents.extractProductId(text);
      const p = id ? catalog.byId(id) : null;
      if (p) {
        sendProduct(out, phone, p);
      } else if (intents.wantsImages(text)) {
        const matches = catalog.search(intents.productQueryTerms(text).join(" "));
        if (matches.length === 1) {
          sendProduct(out, phone, matches[0]);
        } else if (matches.length > 1) {
          const lines = matches.map((x) => `  ${x.id}. ${x.name} — ₹${x.price}`);
          out.push({
            to: phone,
            text: `I found a few matches — which one? 😊\n${lines.join("\n")}\nReply with the code (e.g. *${matches[0].id}*).`,
          });
        } else {
          await fallThroughToBrain(customer, text, out);
        }
      } else {
        const terms = intents.productQueryTerms(text);
        const matches = terms.length ? catalog.search(terms.join(" ")) : [];
        if (matches.length === 1 && terms.length >= 1 && !firstContact) {
          sendProduct(out, phone, matches[0]);
        } else {
          // ---- 4. everything else → LLM brain ----
          await fallThroughToBrain(customer, text, out);
        }
      }
    }
  } catch (err) {
    out.push({
      to: phone,
      text: "Oops, something went wrong on my side 😅 — please try again in a moment.",
    });
    console.error("handler error:", err);
  }

  // record what we replied (text messages only) for LLM context
  for (const msg of out) {
    if (msg.to === phone && msg.text) customer.history.push({ role: "assistant", text: msg.text });
  }
  store.saveCustomer(customer);
  return out;
}

async function fallThroughToBrain(customer, text, out) {
  const result = await brain.chat(customer, text);
  if (result.reply) out.push({ to: customer.phone, text: result.reply });
  for (const action of result.actions || []) runAction(action, customer, out);
}

module.exports = { handleMessage, welcomeText };
