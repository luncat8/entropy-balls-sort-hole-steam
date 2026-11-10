# findings — pitfalls and reusable lessons

## running global-script pages under node (2026-11-08)
classic scripts share one global scope in the browser and in `vm.runInContext`, so a loader that reads index.html's script list and runs each file in one context reproduces page wiring for tests. give the context stubs for `document`, `window`, `requestAnimationFrame`, and a `module` object so the `typeof module` export guards populate per-file apis. guard the boot tail with `typeof document` so bare `require` of any file stays clean. see experiments/vmload.js.

## canvas fillStyle without per-frame strings (2026-11-08)
fillStyle/strokeStyle only accept strings, and building them per frame violates the no-allocation rule. build the css string once when the color is created (ball spawn, impact record) and keep it beside the packed rgb; the draw loop then only assigns cached strings.

## palette hues plus random S/L for readable sorting (2026-11-08)
random full-wheel hues make "sort the reds" tasks unreadable and mostly infeasible. six palette hues (three per temperature band) with random saturation 0.60-0.90 and lightness 0.50-0.75 keep categories crisp while every ball still looks distinct. warm/cold stays a hue-boundary test in color.js, not a palette table.

## deterministic physics smoke vs time-based generation (2026-11-08)
time-based spawn writes into deterministic stepping tests (stray balls record stray impacts). give simulation a rate setter — it is also the seam for the gui.1 generation slider — and set it to 0 in the test fixture. also: `simAdvance` caps catch-up at 0.25 s per call by design, so long test runs must loop small advances instead of one big one.

## integer task percentages (2026-11-08)
compare `match * 100 ? threshold * sideTotal` so 1/2 is neither >50 nor <50. feasibility ignores side (any nonempty split of the live counts); only the already-satisfied check reads the named chamber. empty population waits until `simDist.rev` changes — do not resample every step.

## hold time is steps*dt, not summed dt (2026-11-08)
adding 1/120 two hundred forty times yields 1.9999999999999953, so `sum < 2` never completes on the 2.00s step. store a step count and set `hold = steps * dt`; 240 * (1/120) === 2.

## canvas state across draw layers (2026-11-08)
Canvas 2D styles persist until reassigned: a forecast's `globalAlpha` can silently make the later ball pass translucent even if alpha is reset at frame end. Reset context state before each layer that expects defaults; tests should record style values at draw-call time, not only inspect the final context.

## difficulty as minimum crossings, not a percentage (2026-11-08)
a percentage target is incomparable across categories: "60% of left is green" is trivial with ten green balls and near-impossible with two. pricing a task by the fewest balls that must change chamber gives one integer that is comparable across categories, sides and population sizes, and it matches what the player actually does. the count is a unit-L1 distance from the current `(other, category)` counts, and the threshold is linear in `m`, so the satisfying `m` form one run and the cost is convex in `m` — clamping the flat minimum into the run gives O(nAll) per candidate instead of O(nAll^2). verify such a closed form against a brute-force move count on every combination before trusting it; the first three attempts here were wrong in ways the band numbers looked plausible for.

## a flat draw over candidates is biased toward the widest band (2026-11-08)
bands of different width do not have equal candidate counts, so picking uniformly over in-band candidates makes the widest band the default difficulty — 55% of assignments landed in `hard` before the fix. draw the label first (uniform over labels that have at least one candidate), then a candidate inside it. measure the assigned mix, not the candidate histogram, to see this.

## rejecting already-true tasks needs the cheapest reachable plan (2026-11-08)
the 0.2 filter only rejected a task satisfied on its named side, which left half of all candidates (4763/9600) already true by construction: a looser threshold on a category that is already ahead costs nothing. a cost of 0 has to be rejected globally, and so does a task that costs 1–2 crossings — those are decided by one or two balls, and random drift through the opening flips them without the player acting.

## a preview that is drawn, not priced, lies (2026-11-08)
a goal picture assembled from percentages drifts from the rule that decides the objective. return the plan from the solver that already prices it (`tasksCheapest(..., out)` writes the split; `tasksCost` is that call without the output) and place balls from the plan: fill the quota from balls already in the named chamber first, then from balls that cross. moved balls then equal the reported cost by construction, and one assertion (`moved === tasksCost(...)`) protects the whole picture. drawing state belongs to the drawing file; the simulation must not learn about previews.

## a minimised goal can contradict the panel (2026-11-08)
the cost is total crossings, so `s - m` small (an almost empty chamber) can tie with staying put: ">40% violet of 2/2" showed next to "needs 2 of 4". break cost ties toward the split nearest the current chamber size inside the solver, not in the view; every consumer of the cost then agrees.

## freeze the field instead of copying it (2026-11-08)
a held preview that must not drift is simplest as "do not call simAdvance": one guard in main.js, no ghost state in simulation.js, and the live arrays are still the fallback when a goal cannot be drawn. the cost is that input is paused too, which is the intent while reading a goal.

## an option label must show its own shape (2026-11-08)
three "representations" that all render as a gradient rectangle make two of the labels false. give each mode its own DOM shape (one ball, a row of balls, one bar) behind one `previewFill(el, base, hue, count, mode)` path, and let the caller's base class carry the size. keep the base class in the assignment — overwriting `className` wholesale silently drops the size rules the layout depends on.

## a control channel, not a control mode (2026-11-08)
two humans on one device is the same problem as human-versus-bot: both need "who may write this participant's request". model it as a channel per participant (`mouse`, `keys`) rather than an `inputMode` flag threaded through the gesture code, and the second human is a second channel with different event sources. the panel labels the channel (`Mouse`/`Arrows`), so it stays honest for a bot slot with no channel at all.

## a shadowing `const` in an experiment reads as undefined (2026-11-08)
an experiment that does `const players = apis['players.js']` shadows the page global, so a loop `for (let id = 0; id < players.count; id++)` reads `undefined`, compares false and silently skips the body. the run then "passes" with stale state, or fails far away in an unrelated check. always spell the state field (`players.players.count`) in harness code; a loop whose body never runs is invisible in a pass/fail count. a shared reset should also call the same setters the ui calls (`inputSetValue(id, start)`) instead of poking the state array, so the test exercises the shipped path.

## boot order: a settings loader that rebuilds participants needs the participants' consumers (2026-11-08)
loading settings before the force layer exists makes the rebind project selections into an uninitialised store, and the input layer guards with `if (!inputState.value) return` — a silent no-op that leaves player 1 at zero force after a `?humans=2` reload. when a settings load can rebuild live parts, boot those parts first and load settings last.

## a bot that chases the next matching ball loses to a bot that parks (2026-11-08)
with a shared field and a small aperture, the metric moves with crossing *volume*: opening for the soonest wanted ball also opens for every ball that arrives at that height meanwhile, so the ratio stays at the ambient mix while the hole burns its store travelling. measured in a dense field over three 60 s runs: "soonest matching ball" let 42 wanted and 69 wrong-way balls through, a lane-density aim (net predicted crossings inside one aperture, minus travel) 38 and 51, and a parked hole 9 and 9. score heights, not balls, and score the height the hole already holds too, otherwise it chases noise across the field.

## a "keep what exists" loop must write both branches (2026-11-08)
`tasksRestart` cleared every slot and then attached an objective only where the copy said there was none, so every slot that already had a task lost it and only the new one got a task — the first human lost their objective the moment a second player joined, which reads as "toggling two players deletes my quest". when rewriting state from a copy, assert the kept branch explicitly: `if (prior[id]) on[id] = 1; else attach(id)`.

## a policy on the fixed-step hook overwrites hand-made force in display tests (2026-11-08)
panel tests write `forceSetDirection`/`forceHold` directly and then step to price the store; once a bot policy runs on the same hook, the step replaces the request and the panel shows "No force". detach the hook for those steps (`simSetControlHook(null)`, step, restore) instead of teaching the display tests the policy.

## two bots need a contest rule, not just two controllers (2026-11-08)
equal opposite requests through a shared aperture cancel while both stores pay; synchronized rest/resume thresholds can repeat the stall. in a 180 s two-bot run the old policy spent about 62 s in exact opposition. alternate the right to drive only when ready bots actually oppose, let aligned requests combine, and never let a resting or arrived bot reserve a turn. this removes the cancellation deadlock without giving one slot a permanent force advantage.

## a restart that clears force stores must reproject human selections (2026-11-08)
`forceInit()` clears magnitude as well as energy, while the input layer still remembers the slider value. calling it from a restart or roster rebuild without a following `inputRebind()` leaves a human panel showing a nonzero selection that applies zero force until the slider moves. boot the stores first, then rebind/reproject the human channels.

## a bot must aim at the split, not at the direction a ball wants to go (2026-11-08)
"does this ball belong on that side" cannot tell a task's quota apart from its traffic: a matching ball already standing in the named chamber is a ball the objective *holds*, and opening for its exit spends two crossings, yet a per-ball wanted/harm flag calls it progress. read the exact plan the difficulty priced (`tasksCheapest(..., out)` writes the split; the current counts minus that split are the two quotas left to fill) and score each predicted crossing by whether it moves a quota. in the same dense field, seeded 90 s matches: net helpful crossings 0.67 → 1.47 per minute solo, 3.00 → 6.33 with two bots.

## the cheapest satisfying split can cost zero, and a `best < 0` guard drops it (2026-11-08)
`tasksCheapest` tracked only strictly cheaper walks, so when a split satisfying the task was already reachable at cost 0 the loop found it but never stored it. every caller saw `-1` (unreachable), and the generator's "reject an already true task" filter checks `cost === 0` — a satisfied objective therefore slipped through as assignable. initialize `best` from the first valid split, and keep a brute-force cross-check of the closed form on the zero case, not only on the expensive ones.

## a ball crossing a divider comes back at a fixed interval (2026-11-08)
after crossing, a ball is in the other chamber heading for its outer wall, so the next meeting with the divider is `2 * (chamber width - r) / |vx|` later, and the lane it will cross at advances by `|vy|` times that. with two equal chambers the interval alternates slightly but repeats. predicting three crossings per ball instead of one makes a lane score reflect collected traffic instead of a single lucky ball. the direction of the next crossing is decided by which chamber the ball is in, never by the sign of `vx` — a ball moving away from the divider crosses the other way after it turns.

## a policy weight must be relative to its cost term (2026-11-08)
lane score was `crossings * weight - travelSeconds`. at a weight of 0.6 a single near crossing was worth less than a 0.5 s drive, so every candidate lane scored below zero, `botAim` returned false on nearly every think and the bot sat still — while the harness happily reported "fewer wasted crossings". read the units: one crossing has to buy at least the travel a bot can afford to it, or the optimum is the empty action.

## one owner beats alternating turns when a resource is contested per tick (2026-11-08)
equal and opposite requests cancel per fixed step while both pay. a fixed 2 s turn is shorter than the travel it authorizes, so each bot undid the other's move and the pair spent 60% of a match in exact opposition with neither objective moving. give the turn to one bot until *it* is done (parked) or a generous cap expires, let a parked bot reserve nothing, and let aligned requests combine.

## a view painted between fixed steps must refresh itself (2026-11-08)
`tasksView` was only rewritten inside `tasksStep`. `questPaint` runs from the frame loop, so after a ball moved but before the next step the card showed the previous split, and a progress bar could read 0% for a state that had already changed. the paint path now calls `tasksRefresh()` before reading. the same trap applies to any cached value keyed by a revision counter: the cache may be older than the snapshot the reader sees.

## fold a prediction at the crossing's own time (2026-11-08)
`botFoldY(y, vy, t)` returns the height at time `t`, so a list of future crossings needs each crossing's absolute time, not the time since the last one. the first version passed `0` for the first crossing and then the previous crossing's time, so every entry was the height one crossing earlier — the hole was aimed where the ball already was. horizontal-only test balls (`vy = 0`) hide this completely: add one diagonal ball and assert the predicted height against `y + vy * t`.

## a quota that only tests one sign plays half the grammar backwards (2026-11-08)
the plan's two counts (`needCat`, `spareOther`) can be negative: `<X%` is reached by matching balls *leaving* the named chamber and other balls *entering* it. a predicate written as `entering && needCat > 0` labels every crossing of a `<` objective as harmful, so the bot avoids the only progress available and those objectives are generated but never completed. derive the useful crossing from the sign, and test both comparators in the smoke rather than only the one the field usually generates.

## an equal-chance draw needs its own grammar check (2026-11-08)
comparators are not symmetric in a random field: `<70%` is already true 81% of the time, so of 80 playable candidates per direction only 7 were `<` and 58 were `>` — a flat draw over candidates then makes "greater than" the default quest. two fixes compound: span the threshold table over both ends (10-90), and draw the comparator by equal chance inside the chosen difficulty label. measure the assigned mix (48/300 `<`), not the candidate histogram: the histogram looked merely lopsided while the cards were one-directional.

## a satisfied hold has nothing to maximise (2026-11-08)
a `hold` objective that is already met leaves both quotas at zero, so every crossing is worth `-1` and every lane scores below zero — `botAim` returns false and the bot stops defending exactly when the two-second hold starts. a hold needs its own lane rule: count only the crossings that would end the hold (`>` loses when the named chamber's share drops) and treat the lane the hole already holds as the zero baseline, so a safer lane must beat the drive.

## a full-screen field is rebuilt, not letterboxed (2026-11-09)
fitting a fixed-aspect world into a viewport leaves unused screen area on every aspect ratio, and at
the short-landscape end that area was where the aperture track lived. making the world size equal the
canvas' CSS size (`simResizeField`) removes the transform entirely: a world unit is a CSS pixel, the
divider is `w / 2` by construction, and the device-pixel ratio stays the only drawing concern. rescale
existing balls with the field instead of re-spawning them, and clamp each against the new walls — a
shrinking radius near an edge is the one case that needs the bounce. fixture code must set the field
size before `simInit`, because the aperture centre is derived from the current height.

## a fake canvas is not resized by a "viewport" edit (2026-11-09)
`stubs.els.canv.clientWidth/Height` persist between sections of one smoke file. once the field takes
its size from the canvas, a fixture that assumes the default 1200x800 can silently build balls for a
smaller field left behind by an earlier resize. set both properties in the fixture's reset.

## `<details>` toggle work is queued, so the next statement may read stale state (2026-11-09)
after `locator.click()` on a summary, the `toggle` event (which shows the backdrop and writes the
localStorage preference) flushes as a task afterwards. a browser harness that immediately reads
`backdrop.hidden` or reloads the page sees the pre-toggle state — this failed at 1024x768 and 390x844
on a clean tree. wait for the effect (`page.waitForFunction` on the DOM or the stored key) instead of
expecting the click to have completed it.

## a field that is the screen needs a share, not a pixel (2026-11-09)
when the world size is the viewport, a fixed px size means a phone gets toy balls and a fast game: at
boot the old code spawned 14 px balls in the default 1200x800 world and the first resize scaled radii
by `min(sx, sy)` (4.2 px on 390x844) while velocities stayed at 175 px/s. the fix is one derived length:
`scale = sqrt(w * h)`, with every size and speed stored as a share of a thousandth of it. sqrt keeps a
ball's *area* a constant share of the field area, so density and pace hold on wide, tall and square
screens alike — `min(w, h)` starves a short-wide window (1600x300 gave 5 px balls at 53 px/s). a resize
must scale velocities with the scale as well; scaling radius only is what made small screens feel fast.
fixtures and the bot need the same unit: any px tolerance in gameplay code (a "moving" threshold, a
beside-the-lane offset) becomes `simPx(n)` or it silently changes meaning with the screen.

## derived pixels break exact float assertions (2026-11-09)
`impactMarks.x` is a `Float32Array` and the wall thickness is now `simPx(8)` = 7.838, not 8. checks
that compared a mark or a fillRect argument with `===` against `wallX - wallT / 2` passed only because
8 and 596 are exactly representable. compare drawn geometry with a tolerance (1e-3 is plenty) and
derive the expected numbers from `simField`, not from the constants a test used to know.

## a settings boot normalizes whatever the constants say (2026-11-09)
to reproduce old pixel defaults in a measurement, editing `BALL_SIZE_DEFAULT` alone does nothing:
`mainBoot` -> `settingsInit` -> `settingsApply` runs `settingsNormalize` with a step, so 13.717 became
14 and 176.36 became 175. any A/B of a default value has to go through the same normalize/step path
the setting exposes, or the run silently measures the old value.

## an opponent-aware lane score must refuse, not retaliate (2026-11-09)
a bot that adds "the crossings that hurt the opponent" as a reward is a spite engine: the lanes that
cost the opponent's plan usually cost its own too, so the score prefers hurting both and two such bots
stall. measured on the same 20 × 90 s two-bot matches: charging the opponent's gains *and* rewarding
their losses gave 3 completions with 17 empty matches; charging only their gains gave 73 completions
with the same seed set. if a character is meant to "minimise the opponent's profit", count the profit
it takes away, never the damage it causes.

## a preference that pays for denial must be swept against a mirror match (2026-11-09)
denial strength looks free in a mixed match and is not: at a weight of 1.25 the denier's opponent lost
the same completions it lost at 0.6, while two deniers fell from 73 to 46 completions. sweep the
weight in both the mixed and the mirror pairing and pick the largest value that keeps the mirror
match at the baseline rate — the opponent's suppression saturates long before the mirror match dies.

## a dashed line that starts at its ball crawls; pin the pattern to the field (2026-11-10)
a stroke's dash pattern starts at the path's first point, so a line drawn from a moving ball drags its
dashes along and every forecast on screen shimmers. set `lineDashOffset = span − (lengthToAnchor + gap)
mod span` with the anchor at the end that does not move (the first touch of the divider): a whole dash
ends at the anchor and the pattern stands still while the ball eats it. in the fake canvas, record
`lineDashOffset` at call time and assert that it shifts by exactly the distance flown. in a browser,
compare the stroke masks of two frames in a box ahead of the ball: a level line differs in 0 pixels, a
slanted one in a couple of dozen (27 and 23 here) — edge pixels of a line that got brighter, not motion.

## a GPU canvas dashes one shape in a shader: a level two-point line (2026-11-10)
Chromium's GPU canvas (Skia Ganesh, `DashOp::CanDrawDashLine`) takes a dashed stroke on its fast path
only when the path is two points, horizontal or vertical *before* the transform, with one dash and one
gap and no round caps; the matrix may rotate. a slanted line or a polyline is cut into dashes on the
CPU and rastered as a general path, every frame. so stroke each leg as `moveTo(0, 0); lineTo(len, 0)`
under `setTransform(ux, uy, -uy, ux, x0, y0)` (all times the pixel ratio) and carry the dash offset from
leg to leg: the same picture (at most 1449 of 960000 px differ, antialiasing) at 6.7 ms a frame against
18.1 ms under software GL, 1920x1080 with 24 balls, 1.9 ms with the cues off
(`experiments/forecast_raster.js`). dash ops merge only when their colour is equal, so the floor is one
draw per differently coloured line. in a one-scene bench the level line cost 4.7–4.9 ms; a slanted
two-point stroke per leg, hand-built dash segments and the polyline 29–33 ms; `fillRect` dashes in a
turned frame 13 ms. the price is a butt joint at a corner and one more piece of context state to hand
back: restore the field frame after each line and assert that whatever is drawn next sees it. a
zero-length leg would turn the frame by NaN, which a canvas ignores; none turned up in 2 564 414 traced
paths, so the stroke carries no guard — count an edge case before guarding it.

## measure a canvas frame by flushing it, not by pacing or by a tight loop (2026-11-10)
canvas calls are recorded and rastered later, so timing `canvasDraw` measures the recording (0.08 ms
here) and a loop of draws with one readback at the end measures nothing reproducible. frame pacing in
headless Chromium is no better: on software GL the page stalls for 0.5–1 s every 1.5 s from about 22 s
after load on an unchanged tree, so a stall proves nothing about a change. what works: step the frames
by hand (replace `requestAnimationFrame`, call `mainFrame(t)` on a fixed clock, seed `Math.random`),
read one pixel back after each frame so the canvas must raster it now, and ask for the context with
`willReadFrequently: false` — a canvas that is read back without it is moved to the CPU, where the cost
under test does not exist (0.71 ms a frame for solid lines, 0.90 ms for per-leg dashes). print the
WebGL renderer string beside the numbers: SwiftShader figures rank the variants, they do not say what
a GPU pays.

## an exact fit test on float32 heights is a coin toss at the bottom edge (2026-11-10)
ball positions are `Float32Array`s. a ball lying on the bottom screen edge holds `fround(h − r)`, and
`y + r <= openingBottom` with the opening parked on that edge passes or fails on the rounding of that
one radius: 160 of 400 balls skimming the bottom edge were turned back by an opening they fit, while
the top edge, where the height is the radius itself, passed them all. give a fit test a slack far below
a pixel (`APERTURE_FIT_SLACK`, 0.001) and use the same constant wherever the rule is restated — the
tracer refused 39 of 40 radii rolling along the bottom edge without it. the regression test needs radii
a float32 cannot hold: `9 + k * 0.25` is exact and passed without the fix, `9 + k * 0.237` failed.

## a forecast's worth is what came true, per flight left; it dies at the mean free path (2026-11-10)
a straight-line forecast in a field with ball contacts is right 94 % of the time with under 100 shares
to fly and 30 % at 600–700 (24 balls; 90 % and 17 % at 36). with contacts off the same tracer matches
the stepped simulation in 4442 of 4451 shots, so the loss is all contacts, and it follows the kinetic
mean free path `area / (√2 · 4r · count)`: 526 shares at 24 balls and 351 at 36, while the two tables
fall by e every 525 and 364 shares of flight. measure it by settling every pending forecast of a ball
with the next thing the divider does to that ball, binned by the flight left when the forecast was made
(`experiments/forecast_probe.js`), and fade the cue on the same axis so brightness is the trust. the
shipped reach is a fixed 700 shares tuned on 24 balls; a fade of `exp(−flight / path)` should hold at
any ball count and size (checked at 24 and 36 only) and stays at full brightness with contacts off.

## a prediction that tests the fit at one instant counts crossings that never happen (2026-11-10)
the divider takes a ball only if the whole body stays inside the opening from first touch to the
centre line. `bot.js` tests the height where the centre meets the centre line, one radius of flight
later, so a ball still drifting into the opening is counted although the plate turns it back at first
touch: 124 of 797 such arrivals over six seeded 600 s runs (16 %, 10–26 % per run, the probe's
`forecast_centre_line`); evenly spread directions predict about r / (opening − 2r), 16 % at the default
sizes. a crossing has two heights and both have to be inside the lane. the mirror case — in at first
touch, onto a lip before the centre line — is a hit that ends inside the divider; the ball's shadow on
the plate has no height there, so the cue lights the tip of the lip instead.

## mutate the code to learn what a new smoke protects (2026-11-10)
a smoke written beside its feature passes by construction. twenty one-line mutations of the tracer, the
cue and the fit slack were run against `forecast_smoke.js`; one went unnoticed — the tracer without the
slack, because no shot rolled along the bottom edge — and became a check. drive the list from a
throwaway script that restores each file from a copy in a `finally`, and compare checksums afterwards.

## running the page in the sandbox's Chromium (2026-11-10)
`@sparticuz/chromium` starts without the host's `libnspr4`/`libnss3` when it believes it is on Lambda:
with `AWS_LAMBDA_JS_RUNTIME=nodejs22.x` set for `node experiments/layout_browser.js` the package unpacks
its own copies (delete `/tmp/chromium` first if it was unpacked without the variable). the launch
segfaults now and then and the identical retry works, so rerun once before diagnosing. for pictures
that can be compared between two trees, replace `requestAnimationFrame` and seed `Math.random` in an
init script, call `mainFrame(1000 + k * 1000 / 60)` yourself and screenshot at fixed frame numbers;
real-time captures of two trees never show the same frame.

## right mouse is not an aim button (2026-11-10)
a right-button hold opens the context menu and the gesture dies; use the middle button (button 1) and prevent `mousedown`/`auxclick` so desktop Chromium does not start autoscroll. keep pointer movement as the aim and the button as the pull, so the same press/release pair works for mouse, and give touch one deliberate pair (hold = pull, tap = push) instead of two fingers.

## mode hooks instead of mode checks (2026-11-10)
scattering `if (mode === ...)` through simulation, trajectory and canvas breaks the standard field's forecasts. one mode owner installs optional hooks at stable boundaries (control step, before/after ball motion, divider contact, trace passage, draw layers); with no hook every standard call runs with its old arguments. a mode's passage predicate must be shared by the divider hook and `trajTrace`, otherwise a drawn pass and an actual pass disagree.
