# 2.0 — Two players and bot

## Outcome

Two participants share one field and hole while pursuing independent objectives. Either participant can be human or bot. A settings option enables two humans on the same device: player 1 uses the mouse or touch, and player 2 uses the keyboard. One human remains the default; no network connection is needed.

## Design

### Participants and settings

- Extend `players.js` to enable or disable participant 2 and choose human or bot for each participant. Expose these choices in settings and persist them with the other URL settings. Keep one-human mode available. Switching a controller must release its old input before changing type, without resetting that participant's task or energy. Disabling a participant clears its held force and removes its panel and objective.
- Reuse the existing per-participant task lifecycle. Each player has an independent objective; completion replaces only that objective. Avoid assigning identical active tasks when alternatives exist. Label both objectives and their progress by participant. Do not add scoring or a winner without a product decision.
- Reuse the per-participant force panels and funding interface. Both participants pay from separate stores, their funded requests sum and clamp, and opposing requests can cancel. Panels show each participant's selected force, actual funded contribution, energy and two-second cost, including a read-only panel for every bot.

### Two humans on one device

- When the two-human setting is active, player 1 controls their own slider or the canvas with the mouse/touch and may adjust the slider with the wheel. Player 2 uses **Up/Down arrows** to move their own signed vertical slider by 5 percentage points per step, including through the green zero mark. Holding **Right arrow** applies player 2's selected signed force; keyup stops it without changing the selection. Repeated keydown must not toggle the hold, and adjusting a slider alone never applies force.
- The two control paths are independent: player 2 may hold Right while player 1 presses the slider or field, and releasing either participant's input must not clear the other participant's request. The same zero, energy and opposing-force rules apply to both. Suspend player 1's global arrow/Space shortcuts in this mode so the keyboard belongs to player 2.
- Route player 2's keys while focus is on the field or a force slider, including after player 1 clicks a slider. Suppress native range/scroll behavior only for keys the game consumes. Other form fields, settings controls and quest interactions retain their own keys; always honor Right-arrow keyup for an already-held request even if focus moved.
- Release player 2 on keyup, window blur, document hiding, disabling the participant or switching its controller. Pointer cancellation, lost capture and blur independently release player 1. Make the player 2 panel and its keyboard instructions accessible without making the bot panel interactive.

### Bots

- A bot observes its own task, ball distribution, hole and crossing opportunities, then submits a bounded request through the same force API. A straightforward heuristic is sufficient; it must not mutate physics or energy directly. Do not run bot decisions while a held quest freezes simulation. Controller changes clear stale requests before the new controller can submit its own.

## Files and ownership

- `players.js` — participant lifecycle and controller selection; `settings.js` — player count, controller choices and URL persistence.
- New `bot.js` — bot decision policy; `input.js` — independent human pointer and keyboard paths.
- `force.js`, `forcepanel.js`, `tasks.js`, `quest.js` — participant funding, controls and objective presentation.
- `main.js` — wiring only; update `AGENTS.md` for new ownership.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: enabling/disabling participants, URL round trips, independent task completion and energy, opposing forces, controller switches, bot request limits, and empty-objective waiting. Cover player 2 arrow repeats, center crossing, hold/release, simultaneous mouse and keyboard input, focus changes, blur and hidden-document cleanup, and form-control key isolation.
- L2: full available suite and manual human/human, human/bot, bot/human and bot/bot play at desktop and narrow sizes. Verify both panels and objectives, touch/keyboard releases, independent energy, goal-preview pause and settings restoration without networking.

## Dependencies and next step

Requires 0.1–0.3 and settings integration from gui.1. Plan 1.0 is optional; define task-queue assignment separately when needed.
