# 2.0 — Two players and bot

## Outcome

Two participants share one field and hole while pursuing independent objectives. A setting enables a second human on the same device: the first human uses mouse or touch, the second uses the keyboard. A lone human owns both channels. Either slot can instead be automated through the player table (2.1–2.2), with a read-only force panel and its own funding path.

## Design

### Participants and settings

- `players.js` owns participant slots and controller type. `playersInit(humans, bots)` builds one or two slots and applies the per-slot bot mask. A slot keeps its identity, so slot 1 is always player 2 and its task, panel and energy belong to whoever controls that slot.
- `settings.js` owns the `humans` setting (`1` or `2`) next to the existing `friction` key. Both keys are one table (`SETTINGS_KEYS`) with one normalization, one encoding and one URL write. Two humans is written as `humans=2` and omitted otherwise; unknown values fall back to one human; other query parameters, the hash and the file:// copyable-URL fallback behave as for any settings key.
- Changing the number of humans rebuilds the participant list, then re-attaches objectives only to live slots (`tasksRestart`), clears both channels' holds and reprojects the stored selections into the force layer. Rebuilding never resets the ball field, the hole or an unrelated setting. Turning the second human off drops that slot's objective with it, so the player who stays is not measured against a slot nobody plays.
- The participant list is the single source for the panels: `forcePanelPaint` rebuilds when a count, controller type or control channel changed.

### Control channels

- Channels are participant ids. `inputState.mouse` owns the pointer (field and slider) and the wheel for the first human; `inputState.keys` owns the arrow keys for the second human. A lone human owns both channels even in slot 2. `inputRebind` recomputes both from the participant list and releases every hold first.
- Per participant, state is a selected signed value (−100…+100 in 5-point steps), at most one slider pointer, at most one canvas pointer, and a key hold flag. Direction is `sign(value)` except while a canvas pointer is held, which aims the hole at the pointer's vertical position with the slider's magnitude and a half-step dead zone.
- A player applies force only while holding a source: their slider, their field pointer, or the key apply key. Releasing a source releases only that player, keeping the selection. Pointer release, cancellation, lost capture, window blur, document hiding and a channel change clear holds; `keyup` always releases a held key even after focus moved.
- Player 2 uses **↑/↓** to move their own slider in 5-point steps, including through the green zero mark, and holds **→** to apply the selection. A repeated keydown does not toggle the hold; the keyup releases it. In two-human mode the single-human shortcuts are suspended, so ↑/↓ are not double-bound: player 1 uses only the pointer and the wheel. With one human, **Space** applies and ↑/↓ adjust.
- Keys are consumed only when they belong to the game's own controls; form fields, settings, quest items and a consumed event keep their keys. A keyboard-owned slider ignores the pointer (`pointer-events: none`) so a click on it cannot move a value the keyboard owns, while `↑/↓` still reach the window.
- Panels label the channel rather than the species: `Mouse`, `Arrows`, `Read only`, with per-channel one-line hints for short screens and a full help line otherwise. The player marker changes colour by channel, and the quest list prefixes objectives with `P1`/`P2` when two humans are active.

### Bots

- A bot submits requests through the same force API and appears in a read-only panel with its own store. `PLAYER_BOT` slots never read pointer or key input; their policy and contested-hole turns are owned by `bot.js` (2.1–2.2).

## Files and ownership

- `players.js` — participant lifecycle and controller type; `settings.js` — the `humans` and `friction` settings, URL persistence.
- `input.js` — both human channels, holds and bindings; `forcepanel.js` — channel labels, hints and panel rebuilds.
- `tasks.js` — objectives per live participant; `quest.js` — list copy and the two-player prefix.
- `main.js` — boot order (participants, force layer, input, settings) and wiring; `index.html` — script order and the setting control.
- `force.js`, `simulation.js`, `canvas.js` unchanged by this slice: energy, funding, hole physics and coordinate conversion already serve every participant.

## Validation

- L0: `node --check` on every touched file.
- L1: `experiments/force_smoke.js` — channel assignment for one and two humans, per-player selection steps, apply-key hold/release, simultaneous pointer and key holds, independent energy, hold release on blur, panel labels and rebuilds, `humans` URL round trip and default omission.
- L2: the available simulations, tasks, quest-preview and force suites, because boot order, the participant list and the settings URL writer are shared. Manual pass: enable the second player, hold both controls at once, release each in turn, turn the mode off, reload a copied `?humans=2` URL, confirm both panels and objectives stay readable on a narrow screen.

## Dependencies and next step

Requires the field, tasks and force/energy layers of 0.1–0.3 and settings persistence from gui.1. Next: a bot decision policy on the existing `PLAYER_BOT` slot, then the task queue in 1.0.
