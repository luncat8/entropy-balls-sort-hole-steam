# 2.0 — Two players and bot

## Outcome

Two participants share one field and energy-limited aperture controls while pursuing distinct objectives. Either participant can be human or bot. The initial multiplayer mode is local hot-seat play, not networking.

## Design

- `players.js` owns player records, human/bot type, assigned objective references, and player-specific progress view models. It does not own ball simulation, energy, or objective predicates.
- Each player receives a distinct active objective from the task system. Objectives use the same side/category/comparator rules as single-player. Track progress and completion independently; do not add a winner, score, turn timer, or competitive reward because none is specified in the draft.
- Both players may issue push/pull requests against the same aperture. `force.js` combines requests by adding signed force, then clamps the result to the shared maximum and charges the single shared energy store. This prevents duplicated storage or energy bypass. Equal opposing requests cancel.
- Local controls are presented as two clearly labeled player pads/areas so one player does not accidentally activate the other's control. Support keyboard/mouse and touch. Provide one bot toggle per player; changing a participant to bot releases any held human input immediately.
- The bot owns no physics. `bot.js` observes its assigned objective and the current distribution, selects the aperture force direction/magnitude, and releases force when its energy is insufficient or the action would not help. Its policy is deliberately simple and bounded: steer toward a crossing opportunity that moves a matching ball toward the objective side; do not promise an optimal strategy.
- Task assignment is stable for the life of an objective. A completed player's objective is replaced independently; the other player's objective and progress remain unchanged. The deferred task list can later supply distinct claimed objectives, but this plan must work without that queue.
- `status.js` presents both player tasks and shared energy without obscuring the field. Bot/human status is visible.

## Files and ownership

- New `players.js` — participant state and objective assignment.
- New `bot.js` — bot decision policy.
- `force.js` — combine requests and retain one shared energy budget.
- `tasks.js` — provide distinct objectives and independent completion.
- `status.js` — display per-player objectives and participant type.
- `main.js` — boot/wiring only; update `AGENTS.md` ownership map for new files.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: tests for distinct objectives, independent completion, equal/opposed force combination, shared energy drain, bot release on type change, and invalid/empty objective conditions.
- L2 at plan completion: full available suite and manual play with human/human, human/bot, bot/human, and bot/bot configurations; verify distinct tasks, shared resource limits, touch/keyboard release behavior, and no accidental networking requirement.

## Dependencies and next step

Requires the simulation, task predicate, force/energy interface, and settings/status UI from 0.1–gui.1. Plan 1.0 is optional and is not a dependency; if implemented, integrate task claiming only after player assignment semantics are validated.
