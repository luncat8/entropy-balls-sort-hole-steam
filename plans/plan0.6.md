# 0.6 — Forecast lines: a dashed path to the divider

## Outcome

Every ball that is flying at the divider shows what the divider will do to it. A dashed line in the
ball's colour runs from the ball along its flight, turns where the ball will bounce off the top or
bottom of the screen, and ends at the divider in one of two ways:

- **hit** — the line stops on the plate and the plate lights up in the ball's colour over the height
  the ball will cover (the *predicted position* cue);
- **pass** — the line runs through the opening and stops once the body has cleared the divider. There
  is no mark, because nothing is touched.

The dashes stand still in the field and the ball eats them, so the balls stay the only moving things on
screen. Brightness is trust: line and mark fade linearly with the flight still ahead and vanish at a
reach of 700 shares (0.7 of the field scale), so a far forecast is a hint and a near one is a promise.
`experiments/forecast_probe.js` (seed 1, 1200 × 800, ball contacts on) measures how often a forecast
comes true, by the flight left when it was made:

| flight left, shares | 0–100 | 100–200 | 200–300 | 300–400 | 400–500 | 500–600 | 600–700 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| right, 24 balls | 94 % | 77 % | 63 % | 53 % | 43 % | 36 % | 30 % |
| right, 36 balls | 90 % | 68 % | 51 % | 39 % | 30 % | 23 % | 17 % |
| brightness at mid-bin, of full | 93 % | 79 % | 64 % | 50 % | 36 % | 21 % | 7 % |

With ball contacts off the forecast is the simulation: 4442 of 4451 random shots end the way the
stepped simulation ends them (99.8 %), with a mean height error of 0.43 px at the plate.

## Design

### The trace — `trajectory.js`

`trajTrace(x, y, vx, vy, r, reach, out)` runs the simulation's own rules ahead for one ball with the
hole standing still, and writes the centre's path into a preallocated `trajPath` (`n`, `x[]`, `y[]`,
`end`, `dist`, `side`). It returns `TRAJ_NONE`, `TRAJ_HIT` or `TRAJ_PASS`.

- The centre turns one radius off a screen edge; each turn is a path point (`simWallBounce`).
- The ball first touches the divider one radius before its centre line. `dist` is the flight length to
  that touch — the number the reach, the fade and the dash pattern are all measured from.
- It gets through only if the whole body stays inside the opening from first touch to the centre line,
  the test `simDividerTouch` applies on every step. A pass runs on to one radius past the centre line.
  Otherwise the path ends where the plate stops the centre: at first touch for a plate hit, inside the
  divider for a ball that enters the opening and drifts onto a lip.
- An opening parked on a screen edge has no lip on that side: the ball bounces on the edge inside it.
- No forecast for a ball flying away from the divider, along it, already touching it, or whose first
  touch lies past the reach. Ball contacts, hole motion and everything after the divider are not traced.

The tracer and the two simulation functions state one rule twice; change them together.
`experiments/forecast_smoke.js` holds them together: a seeded sweep of random shots, each traced and
then stepped to its end.

### One fit rule — `simulation.js`

The fit test allows `APERTURE_FIT_SLACK` (0.001 px) on both lips. A ball lying on a screen edge holds a
float32 height, so an exact comparison turns back two in five balls that skim the bottom edge into an
opening parked there, while the top edge lets every one through. The tracer applies the same slack.

### The cue — `canvas.js`

`canvasDrawForecasts` traces each ball once and draws both cues from that trace, so the mark and the
line that leads to it cannot disagree. Nothing is drawn under a held goal view, which is a still frame.

- Opacity is `FORECAST_ALPHA · (1 − dist / reach)` with `FORECAST_ALPHA` 0.85 for line and mark alike.
  A forecast never reaches the opacity of a ball.
- Width 2 px, dash 8 px, gap 8 px. They are pixels, like every stroke: a pattern has to stay readable,
  not scale with the field.
- The dash offset is `span − (dist + gap) mod span`: the pattern is counted back from the first touch,
  where a whole dash ends, so it does not move while the ball flies.
- Each leg is stroked on its own as a horizontal two-point line in a frame turned along it, with the
  dash offset carried from leg to leg, and the field frame is restored after every forecast.
  Chromium's GPU canvas dashes exactly that shape in a shader and cuts any other dashed path into
  pieces on the CPU every frame. `experiments/forecast_raster.js`, mean frame cost under software GL:

  | field, balls | cues off | per leg | one dashed polyline |
  | --- | --- | --- | --- |
  | 1920 × 1080, 24 | 1.9 ms | 6.7 ms | 18.1 ms |
  | 1920 × 1080, 36 | 2.1 ms | 7.7 ms | 23.4 ms |
  | 2560 × 1440, 36 | 2.8 ms | 11.8 ms | 34.3 ms |
  | 390 × 844, 24 | 1.3 ms | 3.5 ms | 7.6 ms |

- `canvasFillWallPatch` shades the plate over the ball's height, clipped to the plates. A ball that
  only clips a lip would shade next to nothing, so the plate nearer to it is always marked at least one
  wall thickness tall from its lip. The impact mark left after a hit uses the same rectangle.

### Settings copy — `index.html`

The two checkboxes keep their names and defaults (both on). A note under them says what the player
cannot guess: a line through the hole is a pass, and brightness is distance.

## Accepted limits

- The reach is one number, tuned on 24 balls with contacts on. It does not follow the ball count, the
  ball size or the collision switch: at 36 balls a line is brighter than its trust, and with contacts
  off an exact forecast still fades.
- The hole is traced where it stands. Moving it changes hit into pass on the next frame, which is the
  feedback the player steers by.
- Two legs meet at a bounce with square ends instead of a mitre: a pixel of overlap inside the corner.
- The path holds ten points: a flight with more than five bounces before the divider gives no forecast,
  and a ball still bouncing inside an edge gate when the points run out reports a hit. The reach ends a
  flight long before either.
- `bot.js` keeps its own crossing forecast, which tests the fit only where the centre meets the centre
  line. In a settled 24-ball field one such crossing in six never happens: the plate turns the ball back at first
  touch (124 of 797 over six seeds, 10–26 % per run; the probe's `forecast_centre_line` line).

## Files and ownership

- `trajectory.js` — the trace: path events, end states, point budget.
- `simulation.js` — `APERTURE_FIT_SLACK` in the divider fit test.
- `canvas.js` — forecast constants, `canvasDrawForecasts`, `canvasStrokeForecast`, `canvasFillWallPatch`.
- `index.html` — script order (`trajectory.js` after `simulation.js`) and the settings note.
- `experiments/forecast_smoke.js` — trace against the stepped simulation, cue shape, anchoring, fade.
- `experiments/sim_smoke.js` — the edge-gate fit; `experiments/vmload.js` — the fake canvas records
  the dash offset of each call.
- `experiments/forecast_probe.js` — the trust table, the exactness figure, the centre-line figure.
- `experiments/forecast_raster.js` — the raster table.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: `forecast_smoke` (29 checks), `sim_smoke` (edge gate on both screen edges).
- L2: every smoke suite and `layout_browser` (the script list changed).
- Evidence: `node experiments/forecast_probe.js [seed] [w] [h] [balls]` prints the trust table, the
  exactness line and the centre-line line (18 s); `node experiments/forecast_raster.js [w] [h] [balls]`
  prints one row of the raster table (24 s, needs the browser tooling of plan gui.2).
- Manual:
  - a ball flying at a plate: the dashes stand still, the ball eats them, the mark is where it lands;
  - drag the hole across a ball's path: its line flips between ending on the plate and running through;
  - a ball that bounces off the top or bottom first: the line turns one radius off the edge;
  - far lines are faint and brighten on approach; a line fades in from nothing, it never pops in;
  - park the hole on the top and on the bottom edge: balls skimming that edge pass, and their lines
    run through;
  - a ball clipping a lip lights the tip of that lip;
  - each checkbox removes only its own cue; holding a quest shows no cue at all;
  - on a phone and on a dense screen the dashes are crisp and every line starts on its ball.

## Next step

Teach `bot.js` the whole-body fit: a crossing has two heights, at first touch and at the centre line,
and both have to lie inside the lane. That removes the one predicted crossing in six that the plate
turns back. Then derive the reach from the mean free path of the live field, so brightness matches
trust at any ball count and with contacts off. The ball-gun mode of `draft-mode-push-ball.md` asks for
passes only and for lines of 3–6 segments: the first is a filter on the trace's result, the second its
reach, and the ten-point path already holds six legs before the divider.
