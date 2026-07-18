# Founder Mode

A daily story game. You step into the shoes of a real CEO at a real turning point — Blockbuster 2000, Apple 1997, Kodak 1975, Netflix 2011 — and make the five decisions that defined the company. Wrong choices spawn counterfactual timelines. The ending shows what your company became under your leadership vs. reality.

**Play:** every day rotates a new episode. Same episode for all players.

## How it works

- **Legend mode** — win by matching great decisions (Apple '97, Netflix '11).
- **Villain mode** — you play the doomed CEO (Blockbuster, Kodak); beating history = winning.
- Two badges per decision: `MATCHED HISTORY` and `IT WORKED` — they can disagree. That's the lesson.
- Live valuation chart tracks your company vs. reality across the years.
- Emoji-grid share, streak tracking via localStorage. No accounts, no backend.

## Running locally

Any static file server works:

```bash
npx serve .
```

## Adding an episode

Episodes are pure JSON in `episodes/` — no code changes needed. Copy an existing file for the schema (5 decisions × 3 choices, each choice with `matchesHistory`, `works`, a valuation `multiplier`, and a ≤3-sentence reveal), then add it to `EPISODE_SCHEDULE` in `app.js`.

## Stack

Vanilla HTML/CSS/JS. One page, zero dependencies.
