# gui.4 — A field-relative game: every size and speed is a share of the field

## Outcome

The field is the screen, so its pixel size is not a constant. Ball size, ball speed, hole size, hole
speed, the divider thickness and the spawn clearance are shares of the field instead of CSS pixels:
one set of settings draws the same picture and plays at the same pace on a phone and on a desktop, and
a resize rescales radii and velocities with the field. The settings drawer reports those four controls
as percentages of the field, never as pixels.

## Design

- `simulation.js` owns one derived length: `simField.scale = sqrt(w * h)`, the side of a square with
  the field's area. A setting is a share of a thousandth of it (`SIM_SHARE`), and `simPx(share)`
  converts for drawing, physics and the other features. A ball's area is then a constant share of the
  field area at every aspect ratio, so no screen looks crowded while another looks empty, and a
  uniform window resize multiplies the scale exactly.
- `simField.scale` is rebuilt whenever the field size changes. `simResizeField` keeps the positions'
  per-axis scaling and additionally scales every radius and velocity by the scale ratio, so balls
  neither stay at their old pixel size nor keep their old pace on a new screen. The aperture's size
  and speed, `simBallRadius.max` and `simField.wallT` are re-derived from their shares.
- `simBallConfig.sizeShare` / `.speedShare` are the settings; `simBallConfig.radius` / `.speed` and
  `simBallRadius.max` are their live pixel conversion, the numbers the physics, the bot and the
  drawing already read. `simAperture.sizeShare` / `.speedShare` likewise feed `simAperture.size` /
  `.speed`. One function, `simApplyShares`, derives every pixel value from its share, so a resize, a
  boot and a settings change cannot disagree.
- Defaults are shares that reproduce the tuned pixel values on the default 1200 × 800 field (scale
  980) within 2 %: `ballSize` 14 ‰ (1.4 % ≈ 13.7 px), `ballSpeed` 180 ‰ (18 %/s ≈ 176 px/s),
  `holeSize` 115 ‰ (11.5 % ≈ 113 px), `holeSpeed` 710 ‰ (71 %/s ≈ 696 px/s), divider 8 ‰. The slider ranges keep their
  old numbers, which are now shares: 6–26, 50–350, 60–240, 200–1400.
- `settings.js` stores shares, clamps them through the existing normalize path, and prints one
  decimal: `1.4 %`, `18 %/s`, `11.5 %`, `71 %/s`. URL keys are unchanged; their values are shares.
- `bot.js` reads pixels for lanes and cross times as before; its two pixel tolerances — the crossing
  speed floor and the offset beside a predicted crossing — become shares so they follow the field.
- `goalview.js` and `canvas.js` keep reading the pixel values and need no change.

## Files and ownership

- `simulation.js` — field scale, share constants, `simPx`, `simApplyShares`, resize scaling,
  share-taking setters.
- `settings.js`, `index.html`, `game.css` — share-backed controls and percentage readouts.
- `bot.js` — the two pixel tolerances.
- `experiments/sim_smoke.js`, `force_smoke.js`, `scoreboard_smoke.js` — share-based expectations and
  a resize check for size and pace.
- `AGENTS.md`, `plans/index.md`, `plans/draft-coverage.md` — the map, the build order and the rows.

## Validation

- L0: `node --check` on touched JavaScript, `git diff --check`.
- L1: `sim_smoke` (defaults, clamps, variety band, speed scaling, resize keeps the share and the
  pace), `force_smoke` (hole share, defaults, URL round trip), `scoreboard_smoke` (slider output and
  URL values).
- L2: every smoke suite, `difficulty_sweep` and `bot_match` against the pre-change numbers (the default
  field changes by less than 1 %, so a > 5 % move is a defect).
- Manual: resize a live field from a phone-sized viewport to a desktop one and watch ball size and
  pace follow; drag ball size and hole size while playing; read the drawer on a 390 × 844 screen.

## Next step

The draft's remaining unplanned items are the white/dark theme and the ball-generation slider.
