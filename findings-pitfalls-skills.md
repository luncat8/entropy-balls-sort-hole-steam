# findings — pitfalls and reusable lessons

## running global-script pages under node (2026-11-08)
classic scripts share one global scope in the browser and in `vm.runInContext`, so a loader that reads index.html's script list and runs each file in one context reproduces page wiring for tests. give the context stubs for `document`, `window`, `requestAnimationFrame`, and a `module` object so the `typeof module` export guards populate per-file apis. guard the boot tail with `typeof document` so bare `require` of any file stays clean. see experiments/vmload.js.

## canvas fillStyle without per-frame strings (2026-11-08)
fillStyle/strokeStyle only accept strings, and building them per frame violates the no-allocation rule. build the css string once when the color is created (ball spawn, impact record) and keep it beside the packed rgb; the draw loop then only assigns cached strings.

## palette hues plus random S/L for readable sorting (2026-11-08)
random full-wheel hues make "sort the reds" tasks unreadable and mostly infeasible. six palette hues (three per temperature band) with random saturation 0.60-0.90 and lightness 0.50-0.75 keep categories crisp while every ball still looks distinct. warm/cold stays a hue-boundary test in color.js, not a palette table.

## deterministic physics smoke vs time-based generation (2026-11-08)
time-based spawn writes into deterministic stepping tests (stray balls record stray impacts). give simulation a rate setter — it is also the seam for the gui.1 generation slider — and set it to 0 in the test fixture. also: `simAdvance` caps catch-up at 0.25 s per call by design, so long test runs must loop small advances instead of one big one.

## canvas state across draw layers (2026-11-08)
Canvas 2D styles persist until reassigned: a forecast's `globalAlpha` can silently make the later ball pass translucent even if alpha is reset at frame end. Reset context state before each layer that expects defaults; tests should record style values at draw-call time, not only inspect the final context.
