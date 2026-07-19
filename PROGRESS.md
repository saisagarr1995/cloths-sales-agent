# PROGRESS.md — step-by-step build log

> Rule: every session updates this file after every change. A new session reads
> PLAN.md first, then this file, then continues from the NEXT STEP line.

## 2026-07-19 — Session 1

1. ✅ Plan created and approved by user (see PLAN.md). Key decisions: Baileys (WhatsApp), Groq free tier (LLM, provider-wrapped), UPI deep link + manual confirm (payments), sample catalog data, Node.js runtime.
2. ✅ Scaffolded: `package.json` (5 deps only), `.env.example`, `src/config.js`, `CLAUDE.md`, `PLAN.md`, this file, `RECREATE_PROMPT.md`, `.claude/skills/` (update-docs, test-and-fix, add-product).

3. ✅ `data/catalog.json` — 18 products (6 kids / 6 girls / 6 women), 4 bestsellers with "why" reasons. `scripts/gen-images.js` (zero-dep PNG generator) run → 18 placeholder images in `data/images/`.
4. ✅ Core modules: `src/catalog.js` (load/search/menu/digest), `src/store.js` (customer + order JSON persistence, 10-message history window), `src/payment.js` (cart totals with free-delivery rule, UPI deep link, QR PNG, order summary).
5. ✅ `src/intents.js` (multilingual keyword intents: greeting/menu/images/checkout/cart/paid/UTR/product-id, EN + Tamil + Hindi) and `src/handler.js` (pipeline: owner confirm command → instant welcome → checkout state machine → deterministic intents → LLM fallback; executes LLM actions add_to_cart / remove_from_cart / send_product_image / set_preference / start_checkout).
6. ✅ `src/brain.js` — Groq free tier via built-in fetch (no SDK), compact token-efficient system prompt (catalog digest + prefs + selling playbook), strict JSON `{reply, actions}` protocol, graceful fallbacks when key missing or API errors.
7. ✅ `src/index.js` — Baileys wiring: QR login (qrcode-terminal), auto-reconnect (except logged-out), ignores groups/status, 800ms send gap (anti-spam), image + text delivery.
8. ✅ Tests: `test/fake-transport.js` (isolated temp data dirs), `test/deterministic.test.js` (16 tests), `test/llm.test.js` (5 live Groq tests, self-skip without key).
9. ✅ `npm install` (122 packages from the 5 declared deps). Fixed test-runner glob for Windows (`node --test "test/*.test.js"`).
10. ✅ **Test run: 16/16 deterministic tests PASS, 0 fail; 5 LLM tests skipped (no GROQ_API_KEY yet).** Syntax check on `src/index.js` clean.

## 2026-07-19 — Session 1 (continued)

11. ✅ User provided Groq key + owner number (had put them in `.env.example` by mistake) — moved real values into a new private `.env`, restored placeholders in `.env.example`.
12. ✅ Security for open-sourcing: `.gitignore` excludes `.env` (secrets), `auth/` (live WhatsApp session), `data/customers/` + `data/orders.json` (customer data), `node_modules/`.
13. ✅ **Full test run: 21/21 PASS** — all 16 deterministic + all 5 live Groq tests (Tamil discount objection in Tamil, 2 bestsellers with reasons, occasion match, preference memory, buying intent → cart action).
14. ✅ Added `README.md` for the public repo; `git init` + initial commit (secrets verified excluded).

## NEXT STEP

Go live: user still needs to put the real `UPI_ID` in `.env` (currently placeholder `yourname@upi`), then `npm start`, scan the QR with the business WhatsApp, and send "Hi" from another phone. Recommended: rotate the Groq API key (it briefly sat in `.env.example`). Then push the repo to GitHub.
