# gui.1 — Settings and status UI

## Outcome

A compact settings panel exposes the simulation and energy parameters from `draft.txt`, persists those choices in the URL, and a status area explains current task progress, energy, and contextual controls.

## Design

- `settings.js` owns setting defaults, constraints, UI bindings, URL serialization/parsing, and change notifications. It does not own physics or task state.
- Settings: friction force, the second participant, the per-slot bot mask, ball count limit and average ball speed. The bot checkboxes live in the player table (2.2); the other controls live in the settings panel. Aperture size/speed and energy cost/storage are covered by 0.5. Ball size, collision reflections and theme remain deferred.
- Ball count is a limit from 6 to 36, default 24; initial population and generation rate scale with it. Average ball speed is 50–350 px/s in 5 px/s steps, default 175. Count changes trim excess balls immediately and regenerate active objectives; speed changes scale existing velocities without changing direction.
- Numeric controls use sliders with adjacent readable values and keyboard-accessible labels. Clamp values at the setting boundary and update the UI and simulation through one settings-change function. A setting change must not reset unrelated game state.
- Encode settings as a versionless, human-readable query string with stable short keys and explicit defaults omitted. Decode only recognized finite values, clamp them to the same bounds, and fall back per-setting when absent or invalid. `history.replaceState` updates the URL after user changes without creating a history entry for every slider movement. On `file://` origins where query replacement is rejected, keep settings functional and provide a copyable URL containing the serialized query; loading that URL restores the settings. Opening a copied URL restores settings; task progress and ball positions are not serialized.
- `status.js` owns the status/help content inside the settings drawer (gui.2) showing live versus held-goal state and per-slot controller guidance. Numeric task counts, completion mode, hold progress and energy remain in the task cards and force panels, rather than maintaining duplicate readouts. A lone human in either slot gets pointer/wheel and Space guidance; with two humans the pointer player and arrow/Right player get separate instructions; bots get takeover guidance. Inactive slots are hidden. Only state changes write text, and only the live/preview sentence is a polite live region.
- The full-screen field and edge HUD follow gui.2. Status/help scrolls with settings inside the drawer; no footer space is reserved. `canvas.js` observes canvas size changes independently of drawer visibility.
- `main.js` remains wiring-only: apply URL settings after simulation, input and force owners exist, route changes to their owners, and pass status the pause flag, public input-channel values and active-slot count without allocating a per-frame view object.
- URL synchronization runs only in a browser. Core settings normalization must also be callable from Node for focused tests.

## Files and ownership

- New `settings.js` — defaults, validation, controls, URL persistence.
- New `status.js` — status and help presentation.
- `main.js` — shared boot and cross-feature wiring only.
- `index.html` — load order and semantic settings/status containers. Layout and drawer behavior follow gui.2.
- `canvas.js` — resize observation for the available play area.
- `experiments/status_smoke.js` — boot, controller switches, preview/release, restart and cached rendering.
- Update `AGENTS.md` ownership map for both new feature files.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: settings round-trip tests, invalid/unknown parameter fallback, clamping, default omission, and UI-to-live-configuration updates for both ball sliders.
- L2 because the boot/load order and document shell change: run the full available suite and manually verify a clean load, slider behavior, copied-URL restoration, task/energy status, file:// URL behavior, mobile layout, keyboard operation, and no DOM-id/global-name collisions.

## Manual pass list

- At desktop, narrow portrait and short landscape sizes, the drawer starts closed on compact screens and does not resize the canvas.
- Switch between solo, two humans, human/bot (either slot) and two bots; help follows the active control channels.
- Hold/release a quest, cancel a pointer and blur the window; the live/paused message follows the actual preview.
- Change settings, copy the URL and reload under `file://`; verify both settings and controls.
- Use wheel, touch and keyboard; help remains readable without blocking controls.

## Dependencies and next step

Requires working simulation, task state, and force/energy values from 0.1–0.3. Once the single-task loop is usable, the deferred queue can be implemented in 1.0.
