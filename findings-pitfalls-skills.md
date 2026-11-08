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
