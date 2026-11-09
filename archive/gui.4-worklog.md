# gui.4 worklog

## 2026-11-09 every size and speed is a share of the field
plan id gui.4
changed: simulation.js feature — `simField.scale = sqrt(w * h)`, `SIM_SHARE`/`simPx`, `simApplyShares`, `simShareClamp`; `simBallConfig.sizeShare`/`.speedShare` and `simAperture.sizeShare`/`.speedShare` hold the settings, `radius`/`speed`/`size` hold their pixels; `simResizeField` scales radii and velocities by the scale ratio; wall thickness and spawn clearance are shares
changed: settings.js feature — share defaults (`ballSize` 14, `ballSpeed` 180, `holeSize` 115, `holeSpeed` 710) and `settingsPercent` readouts `%` / `%/s`
changed: index.html / game.css feature — slider values, percentage outputs and a drawer note saying sizes and speeds are shares of the field
changed: bot.js fix — crossing-speed floor and beside-the-lane offset are `simPx(1)` / `simPx(2)`
changed: experiments/sim_smoke.js, force_smoke.js, scoreboard_smoke.js tests — share-based expectations, tolerant drawn-geometry checks, a phone-sized resize probe
changed: AGENTS.md, plans/index.md, plans/draft-coverage.md, findings — map, build order, rows, lessons
validation: L0 node --check on touched JS, diff --check; L1 sim_smoke 55, force_smoke 88, scoreboard_smoke 28, index.html slider defaults vs the JS defaults and readouts checked; layout_browser not run — the sandbox chromium lacks libnspr4; L2 bot 57, task 72, preview 58, status 13, drawer 15 passed; difficulty_sweep unchanged (cost_q50=27, in_band_share=0.629, without_in_band=0/60); bot_match completed_per_min=1.83 (was 1.83), crossings_per_min=24.50 (was 22.67), one share of ball size moves crossings 19.83–24.50 so the drift is inside the metric's chaos; boot picture 390x844 r=7.94 v=111 hole=66 (was r=4.19 v=165 hole=113), 1920x1080 r=17.79 v=281
decisions: one derived length, sqrt(w * h), because it keeps a ball's area a constant share of the field area at every aspect ratio, where min(w, h) starved short-wide windows; velocities scale with the same ratio on resize, which is the actual complaint — the old code shrank radii by min(sx, sy) and left 175 px/s in place; settings keep their old integer slider grids, so the four defaults land within 2 % of the tuned pixels (ball size −2.0 %) and difficulty bands are bit-identical; line widths (goal ring, forecast) stay pixels because they are strokes, not sizes
pitfalls: drawn geometry can no longer be compared with `===`; a px-injected default is normalized back by the settings boot — see findings
next: the draft's remaining unplanned items are the white/dark theme and the ball-generation slider
