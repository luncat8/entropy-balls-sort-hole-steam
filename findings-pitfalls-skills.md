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
