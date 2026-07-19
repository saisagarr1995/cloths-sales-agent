# CLAUDE.md — Session bootstrap (read this first, every session)

This project is a **WhatsApp sales agent for a clothing business** (Baileys + Groq free tier + UPI deep link). It was built to a fixed, user-approved plan.

## Mandatory startup routine for every new session

1. Read `PLAN.md` — the frozen, user-approved plan. **Do not deviate from it without explicit user approval.**
2. Read `PROGRESS.md` — what has been done so far and the **NEXT STEP** line at the bottom. Continue from there.
3. Only then start working.

## Hard rules (from the project owner)

- **Stick strictly to PLAN.md.** Any plan change requires user approval first, then update `PLAN.md`, `PROGRESS.md`, and `RECREATE_PROMPT.md`.
- **Token economy:** no experimenting, no exploratory rewrites. Think first, write once.
- **Open-source only. No paid APIs.** The LLM is Groq free tier (open Llama model) called via built-in `fetch`.
- **No new npm packages** unless genuinely required and approved by the user. Current allowed set: `@whiskeysockets/baileys`, `dotenv`, `pino`, `qrcode`, `qrcode-terminal`.
- **Lightweight:** plain JSON file persistence, no databases, no frameworks.
- **After every change:** update `PROGRESS.md` (what was done + NEXT STEP) and, if the change affects how the project would be rebuilt, `RECREATE_PROMPT.md`. Use the `update-docs` skill.
- **After development changes:** run the `test-and-fix` skill (`npm test`, fix until green).
- **Do not assume — ask the user** when a requirement is ambiguous.
- Scope: clothes for **kids, girls, women** now; boys/men later. Selling logic must stay generic enough to extend to other product lines later.

## Quick map

| File | Purpose |
|---|---|
| `src/index.js` | Baileys connection, QR login, reconnect, routes messages to handler |
| `src/handler.js` | Pipeline: instant welcome → deterministic intents → checkout state machine → LLM brain |
| `src/intents.js` | Multilingual keyword intent detection (zero LLM tokens) |
| `src/brain.js` | Groq wrapper (fetch), system prompt, JSON `{reply, actions[]}` protocol |
| `src/catalog.js` / `src/store.js` / `src/payment.js` | Catalog, persistence, UPI link + QR + order summary |
| `data/catalog.json` | Editable product list (use `add-product` skill to modify) |
| `test/` | `node --test`; deterministic suite needs no network; `llm.test.js` needs `GROQ_API_KEY` |

Run: `npm start` (scan QR first time). Test: `npm test`.
