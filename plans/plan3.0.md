# 3.0 — Colored-wall territory mode

## Outcome

A player can select the territory mode without changing the existing aperture game. The standard mode remains the default. The mode is shareable in the settings URL and each mode owns only the controls and presentation it needs.

In territory mode, the central divider is a persistent, color-painted territory surface. A ball paints it when it contacts the divider; neutral balls leave it unchanged. Paint transitions are spatially localized and blend gradually rather than replacing the whole surface. The two players have distinct target colors (red and blue), and a ball whose color is close enough to a player's color is counted as that player's captured ball. The primary objective is to grow the player's captured-color share of the wall and field.

The divider has a fixed universal passage near the top edge. Color-painted regions provide additional passages only to balls whose color matches the region. Other balls are stopped by the divider and may repaint it on contact. A small set of colored room/field regions provides the visual context for these color transitions. Players may move their ball guns only along their own painted wall territory; their initial territory is a small seeded region.

## Design

### Mode boundary

- Add a mode setting with `standard` as the default and `territory` as the new choice. It normalizes, encodes, restores from a copied URL, and switches mode through one owner rather than scattering mode checks across unrelated features.
- A mode switch initializes mode state and controls without changing the standard mode's physics, task behavior, or settings. Returning to standard restores its existing field and controls.
- Mode-specific input, simulation rules, drawing, and score presentation have named owners. The shared simulation remains the owner of field dimensions and ball motion; mode behavior is applied through explicit hooks at stable simulation boundaries.
- Keep the experience local and classic-script based. No network service or build step is introduced.

### Paint and passage rules

- Store persistent paint as a fixed-capacity set of wall segments with position, width, owner/color, and blend state. Reuse storage; do not allocate in the simulation or render loop.
- A non-neutral ball paints the segment it touches. Neutral balls do not paint. A later non-neutral contact changes the local segment gradually toward that ball's color. The wall display is derived from this same state.
- The fixed universal gate passes every ball. Painted passages pass only a ball whose color is within the configured matching range for the paint at its crossing height. A mismatch reflects from the divider and may repaint the contact location.
- Match and neutral ranges are explicit mode constants/settings, shared by passage, capture counting, and display; no separate visual-only color test is allowed.
- Initial wall territory is small and seeded for each player. A player's gun position is constrained to continuous wall territory whose color matches that player. The region may expand through painting and shrink/repaint through opponent contacts.
- Each gun acts through a soft gravity ray. Attraction falls smoothly with both distance to the ball and perpendicular distance from the aim line; only neutral balls can be manipulated directly. Use field-relative reach/caps, and let normal ball/wall physics produce the resulting paint—never snap a ball onto the wall.
- A ball whose palette color is sufficiently similar to a player's color is captured for that player. The same color-distance threshold is used for capture, painted-passage matching, and the color shown on the wall; balls outside both player ranges are neutral.
- Score each slot by the field's captured-ball count and colored wall share. Display both in the player's existing HUD; a mode-specific score must not alter standard quests or scoreboard semantics.

### Limits and fairness

- The first version uses fixed red and blue player colors and a fixed green neutral range. It does not add palette selection, procedural room layouts, or a full territory-task generator.
- Start from a deterministic layout and seed for repeatable tests. If wall regions overlap or repaint, the same contact order always yields the same result.
- Bound the number of wall segments and merge adjacent segments with compatible color so long play cannot grow state without limit.

## Files and ownership

- `settings.js` — mode key, URL normalization/encoding, and mode selection control.
- `main.js` — mode lifecycle wiring only.
- `simulation.js` — the explicit mode hook around divider contact/passage; standard rules stay unchanged.
- New mode-owned source files — paint state, matching/capture rules, territory input and mode-specific view model; add script order in `index.html`.
- `canvas.js` and `game.css` — render the wall paint, universal gate, colored rooms and territory HUD.
- `scoreboard.js` — mode-specific captured share/count only if the existing row can present it without changing standard mode.
- `experiments/` — deterministic paint/passage/capture and mode-switch smoke tests.

## Manual pass list

- Standard mode starts by default and remains visually and behaviorally unchanged.
- Selecting territory mode and opening its copied URL restores territory mode; switching back restores the standard field.
- A neutral ball contacting the divider leaves its paint unchanged; a colored ball changes only its contact region, with a visible gradual transition.
- A matching ball crosses a painted passage, a nonmatching ball reflects and can repaint it, and every color crosses the universal top passage.
- A ball's capture attribution uses the same color range as passage matching and agrees with the displayed player totals.
- Each player's gun stays on its own painted region; the initial regions are small, distinct and reachable.
- The gravity ray weakens as a neutral ball gets farther away or farther off-axis; colored balls cannot be pulled or pushed directly.
- Captured-ball attribution, wall paint and matching-passage tests agree on the same color-distance threshold.
- Repeated contacts merge/replace wall segments within the fixed capacity without visual gaps or unbounded allocation.
- Resize and narrow-screen checks keep the wall, rooms, passages and player HUD aligned.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: deterministic mode smoke tests for mode restoration, wall paint, neutral contacts, matching/mismatching passage, capture counts and segment bounds.
- L2: full smoke suite plus browser layout checks when mode selection or script order changes.
