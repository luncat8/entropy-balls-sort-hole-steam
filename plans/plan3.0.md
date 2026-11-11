# 3.0 — Colored-wall territory mode

## Outcome

A player can select the territory mode without changing the existing aperture game. The standard mode remains the default. The mode is shareable in the settings URL and each mode owns only the controls and presentation it needs.

In territory mode, the central divider is a persistent, color-painted territory surface. A colored ball paints the region it contacts; neutral balls leave it unchanged and bounce. Paint transitions are spatially localized and blend gradually rather than replacing the whole surface. The two players have distinct target colors (red and blue), and a ball whose hue is close enough to a player's hue is counted as that player's captured ball. The objective is to grow the player's colored share of the wall; the captured-ball count is shown beside it.

The divider has one fixed universal passage at the top edge. In this mode the standard movable aperture is not in play: the universal gate is the only opening for every color, and strongly painted regions act as additional passages for balls of that same color. Other colored balls are stopped by the divider and gradually repaint the contact location toward their own color; neutral balls only bounce and never paint. A few colored room regions on the field gradually change the hue of balls passing through them toward the room's color, which is how new red, blue and neutral balls appear. Both players have a ball gun on the wall that may move only along their own contiguous painted region; each initial region is small and its position is drawn from a deterministic seed.

## Design

### Mode boundary

- Add a mode setting with `standard` as the default and `territory` and `ball-gun` as the other choices. It normalizes, encodes, restores from a copied URL, and switches mode through one owner rather than scattering mode checks across unrelated features.
- A mode switch initializes mode state and controls without changing the standard mode's physics, task behavior, or settings. Returning to standard restores its existing field, participants and controls.
- Balls move at a quarter of the standard speed in this mode (and in ball-gun mode), from one mode speed table in `mode.js`; no setting value is overwritten.
- Mode-specific input, simulation rules, drawing, trajectory decisions and score presentation have named owners. The shared simulation remains the owner of field dimensions and ball motion; mode behavior is applied through explicit hooks at stable simulation boundaries (control step, before/after ball motion, divider contact). With no hook installed, every standard rule and every standard forecast is byte-for-byte the old behavior.
- Keep the experience local and classic-script based. No network service or build step is introduced.

### Colored rooms and the color rule

- A settings checkbox controls a few fixed field-relative colored rooms; it is off in standard mode and on by default in territory mode, and its value is URL-persisted. Balls whose center is inside a room gradually move their hue toward the room's hue at a field-independent angular rate; leaving a room keeps the new hue.
- Player 1 is red, player 2 is blue, and the neutral range is green. One explicit hue tolerance classifies a ball as red, blue or neutral; the same tolerance is used for capture counting, painted-passage matching, room tint targets and the displayed player colors. Balls outside both player ranges are neutral.
- Ball hue changes reuse preallocated hue tables for RGB, CSS and palette index, so recoloring allocates nothing in the frame loop.

### Paint and passage rules

- Store persistent paint as a fixed-capacity set of wall segments with position, width, owner/color, and blend state, tiling the paintable wall below the universal gate. Reuse storage; do not allocate in the simulation or render loop.
- A colored ball paints the segments overlapped by its contact footprint. A neutral ball never paints. A later colored contact changes the local segments gradually toward that ball's color; the wall display is derived from this same state. Paint is permanent and has no time decay.
- The fixed universal gate at the top passes every ball whose whole body fits. A painted region passes only a ball whose owner matches the region and whose paint blend is at or above the match threshold; the same whole-body height check is used at the segment edges. A mismatch reflects from the divider and repaints the contact location. A matching ball crosses without repainting.
- One passage predicate answers whether a ball at a given height may cross; both the simulation's divider hook and the trajectory forecast call it, so a drawn pass and an actual pass cannot disagree.
- Initial wall territory is small and seeded for each player with a deterministic seed. A player's gun position is constrained to a contiguous wall region whose color matches that player. The region may expand through painting and shrink/repaint through opponent contacts.
- Each gun acts through a soft gravity ray. Attraction falls smoothly with both along-ray distance and perpendicular distance from the aim line; only neutral balls can be manipulated directly. Use field-relative reach/beam/acceleration caps, and let normal ball/wall and ball/ball physics produce the resulting paint — never snap a ball onto the wall.
- Forecast lines that meet a wall region painted in a player's color are highlighted in that player's color and at full brightness; other forecasts keep the standard dashed style. The forecast of the standard mode is unchanged.

### Input and controls

- Player 1's pointer moves its gun along its own painted region and sets the gun's aim point. Player 2 uses ↑↓ to move its gun, with a fixed aim into its own chamber.
- Holding the **middle** mouse button (button 1) applies the pull ray; a left-button press applies a push impulse. The right button is never used: it opens the browser context menu, so it cannot be an aim gesture. Middle-button `mousedown`/`auxclick` are prevented so the browser cannot autoscroll.
- Touch has one unambiguous press/release pair: hold to pull, tap to push. Pointer cancellation, focus loss, visibility change, a released hold and a mode switch stop the force immediately.
- The hole force channel, bot turns and the per-player force panels are inactive in this mode; the mode HUD shows each player's wall share and captured-ball count. Standard quests and the scoreboard keep their own semantics.

### Limits and fairness

- The first version uses fixed red/blue player hues, a fixed green neutral range, a fixed room layout and a deterministic gun seed. It does not add palette selection, procedural rooms or a territory-task generator.
- Bound the number of wall segments and merge adjacent segments with compatible color/blend, so long play cannot grow state without limit or leave visual gaps. A fixed contact order always yields the same result.
- All lengths, speeds and force caps are shares of the field scale, so a resize or a narrow screen does not change their meaning.

## Files and ownership

- `settings.js` — mode key, rooms key, URL normalization/encoding, mode-dependent defaults and selection controls.
- `main.js` — mode lifecycle wiring only.
- `simulation.js` — explicit mode hooks around control step, ball forces, ball tint and divider contact; standard rules stay unchanged.
- `trajectory.js` — one whole-body divider fit with an optional passage predicate, ball index, point budget and hole shift.
- `modecolor.js` — mode hues, the shared classify/match tolerance, room colors and hue tables.
- `territorypaint.js` — fixed-capacity wall segments, localized blending, merge/compaction, shares and passage lookup.
- `territory.js` — rooms, guns, divider hook, capture counting and the territory view/HUD.
- `modeinput.js` — middle/left/touch gestures and release handling for both new modes.
- `mode.js` — active mode, lifecycle and hook registration.
- `canvas.js`, `index.html`, `game.css`, `status.js`, `scoreboard.js` — mode hooks, wall/rooms/guns/ray drawing, HUD, help and mode readout.
- `experiments/` — deterministic paint/passage/capture, room tint, forecast highlight and mode-switch smoke tests.

## Manual pass list

- Standard mode starts by default and remains visually and behaviorally unchanged, including its forecasts and plate marks.
- Selecting territory mode and opening its copied URL restores territory mode; switching back restores the standard field, participants and controls.
- A neutral ball contacting the divider leaves its paint unchanged; a colored ball changes only its contact region, with a visible gradual transition.
- A matching ball crosses a painted passage, a nonmatching ball reflects and can repaint it, and every color crosses the universal top gate. No second movable aperture lets balls through.
- A ball's capture attribution uses the same hue tolerance as passage matching and agrees with the displayed player totals.
- Colored rooms gradually turn balls toward their background hue, and the rooms checkbox restores from the URL.
- Each player's gun stays on its own painted region; the initial regions are small, distinct and reachable.
- The gravity ray weakens as a neutral ball gets farther away or farther off-axis; colored balls cannot be pulled or pushed directly.
- Highlighted forecasts follow the player-colored wall regions; unrelated lines keep the standard dash.
- Middle-button hold pulls, left-button press pushes, touch hold/tap does the same, and release/cancellation stops force immediately.
- Repeated contacts merge/replace wall segments within the fixed capacity without visual gaps or unbounded allocation.
- Resize and narrow-screen checks keep the wall, rooms, gate, guns and player HUD aligned.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: deterministic mode smoke tests for mode restoration, wall paint, neutral contacts, matching/mismatching passage, capture counts, room tint, segment bounds and standard forecast regression.
- L2: full smoke suite plus browser layout checks when mode selection or script order changes.
