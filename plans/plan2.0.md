# 2.0 — Two players and bot

## Outcome

Two participants share a field and hole while pursuing independent objectives. Either participant can be human or bot. The initial multiplayer mode is local, not networked.

## Design

- Extend the existing `players.js` participant registry to enable a second participant and select human or bot for either. Preserve each participant's identity, task and energy when switching controller; clear held input immediately. The one-player mode remains available.
- Reuse 0.2's per-participant task generator and lifecycle. Each player has an independent objective; completion replaces only that objective. Avoid assigning identical active tasks when alternatives exist. Do not add scoring or a winner without a product decision.
- Both participants submit signed requests through 0.3's existing interface. Each pays from their own store, requests sum and clamp, and opposing requests can cancel. Neither bots nor humans bypass the same cost and recharge rules.
- Provide clearly labeled player controls, with keyboard and touch access. Each bot uses observations of its task, distribution, hole and crossing opportunities to submit a bounded request; it never mutates physics or energy directly. A simple heuristic is sufficient; do not promise optimal play.
- Show each participant's task, hold progress, energy, and human/bot status. Task queue integration remains optional and separate.

## Files and ownership

- `players.js` — participant lifecycle and controller selection.
- New `bot.js` — bot decision policy.
- `force.js`, `tasks.js`, `input.js`, `status.js` — reuse and extend their existing participant interfaces and presentation.
- `main.js` — wiring only; update `AGENTS.md` for new ownership.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: independent task completion and energy, opposing forces, participant enable/disable, controller switch releasing held input, bot request limits, and empty-objective waiting.
- L2: full available suite and manual human/human, human/bot, bot/human and bot/bot play; verify touch/keyboard release and independent energy without networking.

## Dependencies and next step

Requires 0.1–0.3 and gui.1. Plan 1.0 is optional; define queue assignment integration separately when needed.
