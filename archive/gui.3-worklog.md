# gui.3 worklog

## 2026-11-09 the screen is the field
plan id gui.3
changed: simulation.js feature — `simResizeField` rebuilds the field from the canvas CSS size, divider at `wallX = w / 2`, balls and aperture rescaled and re-clamped; `FIELD_MIN_W/H`
changed: canvas.js feature — device-pixel-only draw transform, CSS pixels are world units, outer walls no longer drawn, `canvasView` is `dpr/w/h`
changed: goalview.js fix — goal seating and mirroring clamp to the screen instead of the removed border
changed: index.html fix — inline field-sized canvas style so the first measure is never zero
changed: experiments — resize, border, pointer-mapping and layout assertions follow the new field
validation: L0 node --check on touched JS, diff --check; L1 sim_smoke 47, force_smoke 81, preview_smoke 58 passed; L2 all smoke suites passed, Chromium 6 viewports × 4 masks layout/drawer/preview passed, page_errors=0
decisions: the field is rebuilt rather than letterboxed, so no screen area is unused and the divider is central by construction; a resize rescales existing balls instead of resetting them, which keeps the round going while the device rotates; a ball shrunk at the edge is reflected back by the existing wall bounce rather than teleported
pitfalls: `simInit` centres the aperture on the current field height, so a fixture must set the field size before it; a fake canvas keeps its size across a resize, and the harness's old drawer assertions raced the panel's toggle event — see findings

## 2026-11-09 ball size, random sizes and collisions
plan id gui.3
changed: simulation.js feature — `size` mean radius plus `varied` switch replace the fixed radius range, `simSetBallSize` rescales live radii, `simBallRadius.max` publishes the widest radius
changed: bot.js fix — aperture-fit rules read `simBallRadius.max` instead of a constant
changed: settings.js feature — `ballSize`, `ballVaried`, `collisions` keys (`size` URL key), controls and apply path
changed: index.html / game.css feature — ball size slider with output, random-sizes and collisions checkboxes in the Balls group
changed: experiments/sim_smoke.js, force_smoke.js, vmload.js tests — size mean/variety/clamp, edge reflections, URL round trip, switch delivery
validation: L0 node --check; L1 sim_smoke 53, force_smoke 86 passed; L2 all smoke suites passed (bot 57, drawer 15, preview 58, scoreboard 28, status 13, task 72); difficulty_sweep in_band_share=0.629, distributions_without_in_band=0/60; bot_match completed_per_min=2.00, zero_runs=0; Chromium `?size=24&collisions=0&ballVaried=0&humans=2` gave ten 24 px balls, page_errors=0
decisions: one mean radius plus a ±35 % variety band, because a min/max pair is two settings for one idea; live radii rescale on change so the slider is visible mid-round; the bot's fit test reads the published maximum, otherwise a large ball is aimed at a lane the plate blocks
next: the light/dark theme and the ball-generation slider
