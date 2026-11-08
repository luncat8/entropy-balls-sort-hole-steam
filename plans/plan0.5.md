# 0.5 — Aperture and energy settings

## Outcome

The settings panel exposes the four constants that decide how the hole feels: aperture size, aperture
speed, energy spent per unit of drive, and energy storage. All four persist in the URL with the same
format as the existing keys, clamp at the boundary, and apply to the live game without a restart.

## Design

- The values already have owners; this slice only gives them a control and a persistence path.
  `simulation.js` gains `simSetApertureSize` and `simSetApertureSpeed`; `force.js` already owns
  `forceSetCost` and `forceSetCapacity`. No gameplay rule changes.
- Aperture size 60–240 px, default 113. The aperture is clamped inside the field after a change, so a
  larger hole cannot be pushed past a wall. A size change does not move the hole's centre.
- Aperture speed 200–1400 px/s, default 700. It is a cap, not an acceleration: the current drive
  applies immediately, which is how the force model already behaves.
- Energy cost 5–80 per unit of drive per second at full magnitude, default 25, and storage 25–300,
  default 100. A lower storage than the current charge clamps the live stores rather than resetting
  them, so changing the setting never refunds or wipes energy mid-game.
- `settings.js` gains the four keys with the same normalize/encode/clamp shape as the existing ones,
  and additions to `SETTINGS_KEYS`. Defaults are omitted from the URL, as for every other key.
- `index.html` gains four sliders with adjacent outputs in a new settings group. The existing
  keyboard-accessible label pattern carries over.

## Files and ownership

- `simulation.js` — two aperture setters with clamping.
- `force.js` — no change; the setters exist.
- `settings.js` — four keys, controls, URL round trip.
- `index.html` — the settings group and its styles.
- `AGENTS.md` — ownership map stays as is; no file changes owner.

## Validation

- L0: `node --check` on touched files.
- L1: the four keys round-trip through the URL, fall back on invalid input, clamp at both ends and
  omit defaults; a size change keeps the aperture inside the field; a storage reduction clamps stores
  without resetting the selection.
- L2 because the settings table and control markup change: the existing settings round-trip checks.
- Manual: drag each slider while playing and confirm the field keeps running.

## Dependencies and next step

Requires the settings table from gui.1 and the aperture/energy owners from 0.1–0.3. Next: ball size
and the collision checkbox, which need a simulation change rather than a control.
