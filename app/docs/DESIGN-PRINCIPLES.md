# Design Principles

These five rules outrank every other UI decision. If a rule below contradicts a Tailwind class, an animation, a copy choice, or a layout idea — the principle wins.

## 1. The verdict comes first

A user under attack does not have time to read paragraphs. The colour-coded badge and one-line summary must be readable in **under one second** of the verdict modal opening.

- Verdict badge: top-left of the card, full-saturation colour.
- One-line summary: 12–14 words, present tense, plain English.
- Everything else (citations, decoded instructions, simulation deltas) lives below the fold of the card and can be skimmed.

## 2. Citations are mandatory

No verdict appears on screen without **at least one cited reason**. The LLM's confidence is meaningless without grounding; users learn to trust the system because they can see *why* each decision was made.

- The verdict-output schema (zod, in `shared/`) requires `citations: [string, ...string[]]`. Don't relax it.
- Citations are short. Each cites one signal: a scam-intel hit, a vision-similarity score, a history-RAG comparison, a simulation balance delta.
- A citation that says "the AI thinks it's risky" is not a citation. It's noise. Reject it.

## 3. Honest uncertainty

When the system isn't sure (visual similarity 0.6, no scam-intel match, no historical comparison), the verdict is **YELLOW** with the explicit reason: *"this transaction is novel; we cannot confirm safety from local signals alone."*

- Argus must never overclaim certainty on either side.
- A green verdict is a positive assertion that **multiple** signals checked out.
- A red verdict is a positive assertion that **at least one** signal fired hard.
- Neither — and you're in yellow.

## 4. No dark patterns

The Approve and Block buttons are **equally prominent**. There is no countdown timer pressuring the user. The default action when in doubt is no action.

- Same size. Same padding. Same font weight.
- Block sits left, Approve sits right — Western reading order: read the warning, then act.
- No "Recommended" tags on either. No pre-selection. No keyboard default that triggers approve.

## 5. Accessibility is first-class, not retrofitted

A visually-impaired user attempting self-custody is the **tertiary persona** by name in the PRD. Voice mode is not a feature flag.

- Every verdict element exposed to screen readers via correct ARIA roles + labels.
- Voice mode is a primary entry point. F5-hold is not buried in Settings.
- Every action surface is keyboard-reachable in tab order.
- Colour is never the only signal — every verdict has a textual label and an icon.

---

## When you're tempted to break a principle

You're not. Re-read [AGENTS.md](../AGENTS.md), close the editor, take a walk, then re-read this file.
