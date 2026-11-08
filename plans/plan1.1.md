# 1.1 — Quest goal preview

## Outcome

A quest item states its objective in words and in color. Holding the item open shows what the goal looks like: the target color range, the minimum composition that satisfies the objective, and the current count. How the target range is drawn is a display choice with three representations, and each option shows its own representation in its label.

## Design

### Target appearance

The target of an objective is a set of palette hues plus the envelope every ball is generated in, so a preview can only be honest if it reads those from their owners instead of restating them.

- `color.js` owns the envelope: `BALL_SAT_MIN/MAX` and `BALL_LIGHT_MIN/MAX`. `simulation.js` spawn reads them, so the preview and the field cannot drift apart. `color.js` also owns `colorMeanHue`, the circular mean used by the mean representation.
- `tasks.js` owns category membership and exposes `tasksCatHues(name, out)`: the hues of `hot`, `cold`, or one palette color, written into a caller buffer. A preview therefore never decides what counts as warm or cold.

Three representations sample one function, `t` in `[0, 1]` across the possible range:

| mode | default | drawing |
| --- | --- | --- |
| `mean` | | one ball of the mean hue at the middle of the envelope |
| `range` | | five balls stepping the range, lightness alternating across the envelope |
| `smooth` | yes | a continuous gradient across the whole range |

- A multi-hue target spans its hues. A single-hue target has no hue span, so its range runs through the saturation/lightness envelope instead: dark and saturated through light and pale. Each representation reads that the same way, so `smooth` is never a flat rectangle.
- The mode is a radio group next to the existing draw options, and each label carries a small live sample of its own representation. The default is `smooth`.
- Swatch strings are built when the objective, mode, or category changes, never per frame.

### Quest list and hold preview

- `quest.js` owns the list: one item per attached participant task, each with a swatch in the current mode, the objective text, and a difficulty/progress line. Items are built once and repainted only when an integer digest of the task state changes, so the per-frame cost stays near zero.
- Pressing and holding an item opens one reused panel beside the list: the objective, its difficulty and mode, a large swatch of the target range, the count the goal needs as a row of dots with the current count filled, and a release, pointer cancellation, or focus loss closes it.
- The panel is styled in the page, not positioned by script, and the stylesheet moves it to the bottom edge below `1150px`, where a side panel would cover the divider.
- Items take pointer capture so a release outside the item still closes the panel, and they accept Space/Enter held on the focused item.
- The panel needs the count the objective actually requires, the same quantity the difficulty score enumerates: `floor(threshold * total / 100) + 1` for `>`, and `floor((threshold * total - 1) / 100)` for `<`. `tasks.js` exposes it as `tasksNeed`, so the panel and the cost function agree by construction.

### Wiring

- `tasks.js` owns rules and the view model and knows nothing about painting or presses. `quest.js` owns items and reports a hold through `questSetPaintHook(hook)`. `preview.js` registers that hook plus `questSetSwatches(fn)` for the swatch function, so the list never renders a swatch itself.
- `main.js` connects and boots them; it calls `questPaint()` per frame.
- `preview.js` reads tasks only through `tasksView`, `tasksHueView`, `tasksNeed`, and `tasksCatHues`.

## Files and ownership

- `color.js` — ball color envelope constants, `colorMeanHue`.
- `simulation.js` — spawn reads the envelope constants.
- `tasks.js` — `tasksCatHues`, `tasksNeed`, target hues in the view model.
- New `quest.js` — list items, swatches, press gestures, repaint scheduling.
- New `preview.js` — appearance modes, samples, hold panel.
- `index.html` — appearance radios, quest list and panel styles, script order.
- `main.js` — wiring only.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: `tasksNeed` is the smallest count its own predicate accepts; the hue set of `hot`, `cold`, and each palette color; the three representations differ and `smooth` produces a gradient; a single-hue target still spans its envelope; the ramp interpolates in hue order and means hues circularly; `smooth` is the wired default with one radio checked; press opens and release, cancellation, focus loss, and Space/Enter close; dot count and filled count; switching mode repaints the open panel; items keep the objective words.
- L2: `sim_smoke`, `task_smoke`, `difficulty_sweep`, and a boot check that the page builds a quest item and a panel without `NaN` or `undefined`.
- Manual: hold each quest item and confirm the panel matches the field, switch representations and watch the swatch and panel follow, and confirm a release outside the panel closes it.

## Dependencies and next step

Requires 0.2 objectives and 0.4 labels. Independent of 0.3 and gui.1; gui.1 later persists the chosen representation in the URL.
