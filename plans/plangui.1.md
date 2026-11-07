# gui.1 — Settings and status UI

## Outcome

A compact settings panel exposes the simulation and energy parameters from `draft.txt`, persists those choices in the URL, and a status area explains current task progress, energy, and contextual controls.

## Design

- `settings.js` owns setting defaults, constraints, UI bindings, URL serialization/parsing, and change notifications. It does not own physics or task state.
- Settings: aperture size, aperture maximum speed, energy cost per movement, ball generation rate, energy storage capacity, ball size, average ball speed, fixed-size versus randomized-size balls, and ball-to-ball collision reflections.
- Numeric controls use sliders with adjacent readable values and keyboard-accessible labels. Clamp values at the setting boundary and update the UI and simulation through one settings-change function. A setting change must not reset unrelated game state.
- Encode settings as a versionless, human-readable query string with stable short keys and explicit defaults omitted. Decode only recognized finite values, clamp them to the same bounds, and fall back per-setting when absent or invalid. `history.replaceState` updates the URL after user changes without creating a history entry for every slider movement. Opening a copied URL restores settings; task progress and ball positions are not serialized.
- `status.js` owns the status/help DOM. Keep a persistent strip for essential current information (active task/progress and energy) and concise contextual guidance for available controls. Guidance describes shipped behavior, not development notes. Never cover the aperture, task, or essential touch controls.
- `main.js` remains wiring-only: initialize settings before simulation, route changes to settings owners, and give status UI a plain view model.
- URL synchronization runs only in a browser. Core settings normalization must also be callable from Node for focused tests.

## Files and ownership

- New `settings.js` — defaults, validation, controls, URL persistence.
- New `status.js` — status and help presentation.
- `main.js` — shared boot and cross-feature wiring only.
- `index.html` — load order and semantic settings/status containers.
- Update `AGENTS.md` ownership map for both new feature files.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: settings round-trip tests, invalid/unknown parameter fallback, clamping, default omission, and UI-to-live-configuration updates.
- L2 because the boot/load order and document shell change: run the full available suite and manually verify a clean load, slider behavior, copied-URL restoration, task/energy status, mobile layout, keyboard operation, and no DOM-id/global-name collisions.

## Dependencies and next step

Requires working simulation, task state, and force/energy values from 0.1–0.3. Once the single-task loop is usable, the deferred queue can be implemented in 1.0.
