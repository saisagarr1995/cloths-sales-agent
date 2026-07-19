---
name: update-docs
description: Sync PROGRESS.md and RECREATE_PROMPT.md after any code or plan change. Use after completing any task in this project.
---

# update-docs

Keep the project's memory files truthful. Run this after **every** meaningful change.

## Steps

1. Open `PROGRESS.md`. Under today's date (add a new `## YYYY-MM-DD — Session N` heading if this session hasn't logged yet), append numbered entries describing what was just done — concrete file names, what changed, and why. Keep entries one line each.
2. Replace the `## NEXT STEP` section at the bottom with the single most concrete next action (so a brand-new session can continue without re-reading the whole history).
3. Ask yourself: "would a fresh rebuild from RECREATE_PROMPT.md produce the project as it now exists?" If not (new behavior, changed flow, new file, changed dependency, changed env var), edit the prompt inside `RECREATE_PROMPT.md` so it would.
4. If the change was a **plan deviation approved by the user**, also update `PLAN.md` to match, and note the approval in `PROGRESS.md`.

## Rules

- Never log speculative or unfinished work as done.
- Never let PLAN.md, PROGRESS.md and RECREATE_PROMPT.md contradict each other.
