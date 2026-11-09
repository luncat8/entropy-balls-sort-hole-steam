# gui.3 — The screen is the field, and ball size/collisions are settings

## Outcome

The play area is the canvas, not a fitted rectangle inside it: balls reflect off the screen edge, no
border is drawn, and the divider is always halfway across. The two ball properties the draft asked for
that need a simulation change — ball size (same or random) and ball-to-ball collisions — become
settings with URL persistence, next to ball count and average speed.

## Design

- `simulation.js` owns the field. `simField` is measured in CSS pixels of the canvas and is rebuilt by
  `simResizeField(width, height)`: the new size is written, the divider moves to `w / 2`, every ball's
  position and radius rescale with the field, and the aperture's centre rescales vertically and
  re-clamps. A resize therefore never drops a ball onto the other side of the divider, outside the
  screen, or under the edge it just grew towards. A ball whose scaled radius no longer fits at its old
  spot is reflected back inside by the existing wall bounce.
- A minimum field (240 × 240 world units) keeps the physics meaningful while a layout is still
  measuring a zero-sized canvas during boot. The field never exceeds that once it has a real size.
- `canvas.js` keeps only the device-pixel mapping: the backing store is `clientWidth × dpr`, and the
  draw transform is that ratio. A world unit is a CSS pixel, so pointer input needs no conversion and
  no letterboxing exists. The outer walls are not drawn — the screen edge plays their role — while the
  divider is drawn as two plates around the aperture.
- Ball size has one owner: `simBallConfig.size` is the mean radius, clamped 6–26 px with a 14 px
  default, and `simBallConfig.varied` chooses between "every ball is the mean" and "radii spread
  ±35 % around the mean". A size change rescales live radii immediately instead of waiting for a
  respawn, so the setting is visible while playing. `simBallRadius.max` publishes the widest radius the
  current setting can produce; the aperture-fit rules in `bot.js` read it instead of a compile-time
  constant, so a wide ball cannot be aimed at a lane it no longer fits through.
- `simSetBallCollisions` already existed; the collisions checkbox now reaches it through settings.
- `settings.js` gains `ballSize`, `ballVaried` and `collisions` as table rows on the existing
  normalize/encode/clamp path. `size` is the URL key; the two switches store only their non-default
  (off) state, matching `friction`. `index.html` gains a size slider with its output and the two
  checkboxes in the Balls group.
- The field resizes on any canvas size change; the settings drawer, player columns and overlays keep
  their gui.2 placement and may cover the outer chambers.

## Files and ownership

- `simulation.js` — field resize, ball size and variety, radius publication.
- `canvas.js` — device-pixel draw transform, borderless drawing, CSS-pixel pointer mapping.
- `settings.js`, `index.html`, `game.css` — the three settings and the Balls group.
- `bot.js` — reads the published maximum radius.
- `goalview.js` — goal seating clamps to the screen instead of the removed border.
- `AGENTS.md`, `plans/index.md`, `plans/draft-coverage.md` — the map and the coverage rows.

## Validation

- L0: `node --check` on touched JavaScript, `git diff --check`.
- L1: field resize keeps every ball on its side and inside the screen, the divider central at every
  viewport, a shrunk ball reflected back, the border not drawn, the ball-size mean/variety/clamp
  behaviour, and all three settings keys round-tripping through the URL.
- L2: all smoke suites, the difficulty sweep and the bot match because the boot and settings paths
  change; the Chromium harness at six viewports × four controller masks for the full-screen field,
  central divider, HUD clearance, drawer and preview.
- Manual: resize a live field with balls in flight; drag ball size while playing with random sizes on
  and off; switch collisions off and watch balls pass through each other.

## Next step

The draft's remaining unplanned items are the white/dark theme and the ball-generation slider.
