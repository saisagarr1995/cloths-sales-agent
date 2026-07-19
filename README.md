# WhatsApp Cloth-Sales Agent 🛍️

An open-source, lightweight WhatsApp sales agent for a clothing business (kids, girls, women). It welcomes customers instantly, shows the catalog with prices and photos, recommends best sellers with reasons, suggests outfits by occasion, remembers customer preferences, handles discount objections in **English, Tamil and other Indian languages**, collects the delivery address, sends a clean order summary with a **UPI payment link + QR**, and confirms the order after the owner verifies payment.

## Stack (100% open source / free)

| Piece | Tech |
|---|---|
| WhatsApp | [Baileys](https://github.com/WhiskeySockets/Baileys) — QR-scan login on a normal WhatsApp number |
| AI brain | Groq **free tier** (open Llama 3.3 70B) via plain `fetch` — swappable provider wrapper |
| Payments | UPI deep link (`upi://pay?...`) + QR image — no gateway, no fees |
| Storage | Plain JSON files — no database |
| Tests | Built-in `node:test` — no test framework |

Only 5 npm packages. No Python, no frameworks.

## Setup

```bash
git clone <this repo>
cd cloths-sales-agent
npm install
# create a .env file (template below)
npm run gen-images         # placeholder product images (replace with real photos later)
npm test                   # 16 offline tests; +5 live AI tests once GROQ_API_KEY is set
npm start                  # scan the QR with your business WhatsApp (Linked Devices)
```

Create a `.env` file in the project root with:

```ini
# Free key from https://console.groq.com -> API Keys (no card needed)
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile

BUSINESS_NAME=Your Shop Name
# UPI ID that receives payments, e.g. 9876543210@okicici or name@ybl
UPI_ID=yourname@upi
# Name shown in the customer's UPI app while paying
UPI_PAYEE_NAME=Your Shop Name
FREE_DELIVERY_ABOVE=999
DELIVERY_CHARGE=49

# Number (country code + digits) that receives order alerts and
# confirms payments by replying: confirm ORD001
OWNER_WHATSAPP_NUMBER=919876543210
```

> ⚠️ **Never commit `.env`, `auth/` or `data/customers/`** — they hold your API key, your live WhatsApp session and customer data. All are in `.gitignore`.

## How it works

1. **Deterministic layer first (zero AI tokens):** greetings, menu, catalog images, product lookups, checkout, address collection, payments — all handled by code for instant replies and token economy.
2. **AI layer only for real conversation:** objections, recommendations, occasions, memory, any Indian language. The LLM returns structured JSON actions (`add_to_cart`, `start_checkout`, …) — it never computes prices.
3. **Order flow:** cart → address → summary → UPI link + QR → customer says *PAID* (or sends UTR/screenshot) → owner gets the order on WhatsApp → owner replies `confirm ORD001` → customer notified.

## Customizing products

Edit `data/catalog.json` (schema documented in `.claude/skills/add-product/SKILL.md`), drop real photos into `data/images/` with matching filenames, and run `npm run gen-images` for any product still missing an image.

## ⚠️ Fair-use note

Baileys is an unofficial WhatsApp client. Keep the bot conversational (it already paces messages), don't bulk-broadcast, or WhatsApp may ban the number.

## Project docs

- `PLAN.md` — the frozen build plan
- `PROGRESS.md` — build log + next step
- `CLAUDE.md` + `.claude/skills/` — automation rules for AI-assisted maintenance
