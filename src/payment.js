"use strict";
const QRCode = require("qrcode");
const { config } = require("./config");
const catalog = require("./catalog");

function cartTotals(cart) {
  const items = cart.map((line) => {
    const p = catalog.byId(line.productId);
    const qty = line.qty || 1;
    return {
      productId: p.id,
      name: p.name,
      size: line.size || "-",
      qty,
      price: p.price,
      lineTotal: p.price * qty,
    };
  });
  const itemsTotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const deliveryCharge = itemsTotal >= config.freeDeliveryAbove ? 0 : config.deliveryCharge;
  return { items, itemsTotal, deliveryCharge, grandTotal: itemsTotal + deliveryCharge };
}

function upiLink(amount, orderId) {
  const params = new URLSearchParams({
    pa: config.upiId,
    pn: config.upiPayeeName,
    am: String(amount),
    cu: "INR",
    tn: orderId,
  });
  return `upi://pay?${params.toString()}`;
}

async function upiQrPng(amount, orderId) {
  return QRCode.toBuffer(upiLink(amount, orderId), { type: "png", width: 480, margin: 2 });
}

function cartText(cart) {
  if (!cart.length) return "Your cart is empty 🛒";
  const { items, itemsTotal } = cartTotals(cart);
  const lines = ["🛒 *Your cart:*"];
  for (const i of items) lines.push(`  • ${i.name} (${i.size}) × ${i.qty} = ₹${i.lineTotal}`);
  lines.push(`Subtotal: ₹${itemsTotal}`);
  return lines.join("\n");
}

function orderSummaryText(order) {
  const lines = [
    `🧾 *Order Summary — ${order.id}*`,
    `🏪 ${config.businessName}`,
    "",
  ];
  for (const i of order.items) {
    lines.push(`• ${i.name} (${i.size}) × ${i.qty} — ₹${i.lineTotal}`);
  }
  lines.push("");
  lines.push(`Items total: ₹${order.itemsTotal}`);
  lines.push(
    order.deliveryCharge === 0
      ? "Delivery: FREE 🎉"
      : `Delivery: ₹${order.deliveryCharge}`
  );
  lines.push(`*Grand total: ₹${order.grandTotal}*`);
  lines.push("");
  lines.push(`📍 Address: ${order.address}`);
  return lines.join("\n");
}

function paymentInstructionText(order) {
  return [
    `💳 *Pay ₹${order.grandTotal} via UPI:*`,
    "",
    `Tap this link on your phone:`,
    upiLink(order.grandTotal, order.id),
    "",
    `Or scan the QR code above with GPay / PhonePe / Paytm.`,
    `UPI ID: *${config.upiId}*`,
    "",
    `After paying, reply *PAID* (you can also send the payment screenshot or UTR number). Your order will be confirmed right after we verify it. 🙏`,
  ].join("\n");
}

module.exports = { cartTotals, upiLink, upiQrPng, cartText, orderSummaryText, paymentInstructionText };
