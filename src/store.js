"use strict";
const fs = require("fs");
const path = require("path");
const { config } = require("./config");

function ensureDirs() {
  fs.mkdirSync(config.customersDir, { recursive: true });
  fs.mkdirSync(path.dirname(config.ordersFile), { recursive: true });
}

// ---------- customers ----------

function customerFile(phone) {
  return path.join(config.customersDir, `${String(phone).replace(/\D/g, "")}.json`);
}

function getCustomer(phone) {
  ensureDirs();
  const file = customerFile(phone);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    phone: String(phone).replace(/\D/g, ""),
    name: null,
    language: null,          // detected/remembered language preference
    preferences: {},          // e.g. { fabric: "cotton", size: "M" }
    cart: [],                 // [{ productId, size, qty }]
    state: "new",             // new | browsing | collecting_address | awaiting_payment
    address: null,
    activeOrderId: null,
    history: [],              // [{ role: "user"|"assistant", text }] windowed
    welcomed: false,
    createdAt: new Date().toISOString(),
  };
}

function saveCustomer(customer) {
  ensureDirs();
  // keep the LLM context window small
  if (customer.history.length > 10) customer.history = customer.history.slice(-10);
  fs.writeFileSync(customerFile(customer.phone), JSON.stringify(customer, null, 2));
}

// ---------- orders ----------

function readOrders() {
  ensureDirs();
  if (!fs.existsSync(config.ordersFile)) return [];
  return JSON.parse(fs.readFileSync(config.ordersFile, "utf8"));
}

function writeOrders(orders) {
  ensureDirs();
  fs.writeFileSync(config.ordersFile, JSON.stringify(orders, null, 2));
}

function createOrder({ phone, items, itemsTotal, deliveryCharge, grandTotal, address }) {
  const orders = readOrders();
  const id = `ORD${String(orders.length + 1).padStart(3, "0")}`;
  const order = {
    id,
    phone,
    items,          // [{ productId, name, size, qty, price, lineTotal }]
    itemsTotal,
    deliveryCharge,
    grandTotal,
    address,
    status: "awaiting_payment", // awaiting_payment | payment_claimed | confirmed
    paymentRef: null,
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  writeOrders(orders);
  return order;
}

function getOrder(id) {
  return readOrders().find((o) => o.id.toLowerCase() === String(id).toLowerCase()) || null;
}

function updateOrder(id, patch) {
  const orders = readOrders();
  const idx = orders.findIndex((o) => o.id.toLowerCase() === String(id).toLowerCase());
  if (idx === -1) return null;
  orders[idx] = { ...orders[idx], ...patch, updatedAt: new Date().toISOString() };
  writeOrders(orders);
  return orders[idx];
}

module.exports = { getCustomer, saveCustomer, createOrder, getOrder, updateOrder, readOrders };
