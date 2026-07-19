"use strict";
// LLM brain — provider-wrapped so swapping providers is a config change.
// Current provider: Groq free tier (OpenAI-compatible REST API, open Llama
// model) called with Node's built-in fetch. No SDK.

const { config } = require("./config");
const catalog = require("./catalog");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function systemPrompt(customer) {
  const prefs = Object.entries(customer.preferences || {})
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return [
    `You are the friendly, sharp sales assistant of "${config.businessName}", a WhatsApp clothing shop for kids, girls and women in India. Your goal: help the customer and close the sale.`,
    "",
    "LANGUAGE: Always reply in the customer's language (English, Tamil, Hindi or any Indian language). If they write Tamil, reply in Tamil. Mirror their style. Keep replies short (2-5 sentences), warm, WhatsApp-friendly with light emoji.",
    "",
    "SELLING RULES:",
    "- If asked for best sellers, recommend EXACTLY 2 products marked BESTSELLER and explain WHY using the reason given in the catalog.",
    "- If they mention an occasion (wedding, birthday, festival, office, party...), suggest 1-3 matching products with prices from the catalog.",
    "- DISCOUNT OBJECTIONS: never invent discounts or change prices. Politely hold the price, explain the value (fabric, quality, ratings), and mention FREE delivery on orders above ₹" + config.freeDeliveryAbove + " as the nudge. Then guide them back to completing the order.",
    "- Remember useful facts the customer shares (size, fabric preference, kids' ages, budget, name) via the set_preference action.",
    "- Always move toward the sale: suggest sizes, offer to add to cart, ask for the order.",
    "- Prices come ONLY from the catalog below. Never compute or promise totals yourself — checkout handles that.",
    "- If asked something outside clothing/shop scope, answer in one polite line and steer back to shopping.",
    "",
    "CATALOG (id|name|category|price|sizes|occasions|fabric|bestseller-reason):",
    catalog.compactDigest(),
    "",
    `CUSTOMER: phone ${customer.phone}${customer.name ? ", name " + customer.name : ""}. Known preferences: ${prefs || "none yet"}. Cart: ${customer.cart.length ? JSON.stringify(customer.cart) : "empty"}. State: ${customer.state}.`,
    "",
    "OUTPUT FORMAT: Respond with ONLY a JSON object, no other text:",
    '{"reply": "<your WhatsApp message to the customer>", "actions": []}',
    "Allowed actions (include only when needed):",
    '  {"action":"add_to_cart","productId":"W01","size":"M","qty":1}   // when customer clearly asks to buy/take an item',
    '  {"action":"remove_from_cart","productId":"W01"}',
    '  {"action":"send_product_image","productId":"W01"}                // when showing a product they ask about',
    '  {"action":"set_preference","key":"fabric","value":"cotton"}',
    '  {"action":"start_checkout"}                                      // when customer is ready to order/pay',
    "Do not invent product ids. Use only ids from the catalog.",
  ].join("\n");
}

function parseModelJson(raw) {
  let s = String(raw || "").trim();
  // tolerate ```json fences or stray text around the object
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function callGroq(messages) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: config.groqModel,
      messages,
      temperature: 0.6,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq API ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

const FALLBACK_REPLY =
  'I can help you shop! 😊 Type *"menu"* for our catalog with prices, *"catalog with images"* for photos, or a product code like *W01* for details.';

// Main entry: returns { reply, actions[] }. Never throws.
async function chat(customer, text) {
  if (!config.groqApiKey) {
    return { reply: FALLBACK_REPLY, actions: [] };
  }
  const messages = [
    { role: "system", content: systemPrompt(customer) },
    // windowed history (last 10 turns, kept small in store.js)
    ...customer.history.slice(-10).map((h) => ({
      role: h.role === "assistant" ? "assistant" : "user",
      content: h.text,
    })),
  ];
  // history already includes the current user message (pushed by handler);
  // if not (direct calls in tests), append it
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || last.content !== text) {
    messages.push({ role: "user", content: text });
  }

  try {
    const raw = await callGroq(messages);
    const parsed = parseModelJson(raw);
    if (!parsed || typeof parsed.reply !== "string") {
      return { reply: raw ? raw.slice(0, 900) : FALLBACK_REPLY, actions: [] };
    }
    return {
      reply: parsed.reply,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } catch (err) {
    console.error("brain error:", err.message);
    return {
      reply: "Sorry, I'm a little slow right now 😅 — please try again, or type *\"menu\"* to browse our catalog.",
      actions: [],
    };
  }
}

module.exports = { chat, systemPrompt, parseModelJson };
