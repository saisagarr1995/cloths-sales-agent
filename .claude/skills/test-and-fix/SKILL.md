---
name: test-and-fix
description: Run the full test suite and automatically fix every failure until green. Use after any development change and before declaring work done.
---

# test-and-fix

Automatic bug-hunting loop for this project.

## Steps

1. Run `npm test` from the project root (uses `node --test test/`).
   - The deterministic suite always runs (no network, no API key).
   - `llm.test.js` self-skips when `GROQ_API_KEY` is missing; if a `.env` with a key exists it will run live against Groq's free tier.
2. If everything passes: log "tests green" in `PROGRESS.md` (via the update-docs skill) and stop.
3. For each failure:
   - Read the failing assertion and the involved source file(s).
   - Diagnose the **root cause** — do not weaken or delete the test to make it pass. Tests encode approved requirements; change a test only if it contradicts PLAN.md, and say so.
   - Apply the minimal fix in `src/`.
4. Re-run `npm test`. Repeat step 3 until fully green.
5. If a failure is caused by an external factor (Groq rate limit / model retired / network), report it to the user with the exact error instead of looping. For a retired Groq model, the fix is the `GROQ_MODEL` value in `.env` — ask the user before changing models.
6. Finish with the update-docs skill.

## Rules

- Never mark work complete with failing tests.
- Keep fixes minimal — no refactors, no new packages.
