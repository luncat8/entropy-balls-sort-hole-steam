# 0.7 — Whole-body bot crossings and live forecast reach

## Outcome

Bot lane predictions use the same divider fit as the simulation: a candidate passage must fit the complete ball at first touch and at the centre line. This removes crossings the bot previously counted from a centre-line-only fit. The bot policy is split into focused source files using pure moves, with no change to its scoring, tuning or decisions.

Forecast opacity is derived from the live field's mean free path, so the fade follows actual ball count and radii while contacts are enabled. For 24 balls in the standard field, the expected reach is about 526 field shares. With contacts disabled, a forecast is an exact simulation rule trace and does not fade due to a collision distance that does not apply.

## Design

### Whole-body crossing fit

For each predicted crossing, retain both the first-touch event and the centre-line crossing. Use the predicted folded vertical position at each time. A candidate hole lane is payable only when:

1. it can arrive before the ball first touches the divider;
2. the ball's complete vertical extent fits the opening (including the shared aperture-fit slack) at first touch; and
3. the complete body also fits at the centre line.

The lane score continues to value the crossing at its centre-line time. The first-touch position/time is a feasibility constraint, not an extra crossing. A ball already within its first-touch distance uses its current state as the first-touch event, rather than a negative predicted time. The hole remains treated as stationary at the candidate lane for this forecast, as in the current policy.

Use the same fit bounds as `simDividerTouch` and `trajThrough`; keep the rules synchronized and test a ball that fits at the centre but clips a lip on its way across. Do not alter prediction of subsequent repeated crossings except to apply the same fit check to each event.

### Split policy code without behavior changes

Move complete, contiguous declarations into a bot-owned policy file, preserving names, order dependencies and the public API used by `main.js` and the smoke tests. Keep participant/character lifecycle, force arbitration and bot actions in `bot.js`; move crossing prediction and priced-plan helpers together. Add the new file adjacent to `bot.js` in `index.html` script order, after the declarations it consumes. Do not combine cleanup, tuning, or feature changes with the move.

### Live mean-free-path fade

For live balls with radii `r[i]`, use the two-dimensional hard-disk estimate:

`meanFreePath = fieldArea / (4 * sqrt(2) * sum(r[i]))`.

This is equivalent to the current count-times-mean-radius form and is expressed internally in CSS pixels; convert test expectations to field shares using the field scale. Draw opacity as `FORECAST_ALPHA * exp(-distance / meanFreePath)`, and stop tracing beyond four mean free paths. Recompute from current balls so spawn/removal, radius variety and resize are reflected. If ball collisions are disabled, use infinite reach and constant forecast opacity. Retain the same path reach and opacity distance so forecasts do not pop at the trace boundary.

## Files and ownership

- `bot.js` and one new bot-owned source file — pure policy split plus first-touch fit data and scoring eligibility.
- `index.html` — new classic script load order.
- `canvas.js` — confirm the live mean-free-path input, fade, and trace limit; change only if evidence finds a mismatch.
- `experiments/bot_smoke.js` — first-touch lip clip, centre-line fit, contact-time and regression cases.
- `experiments/forecast_smoke.js` — reach values, radius/count/resize updates, fade and contacts-off behavior.
- `AGENTS.md` — ownership map and current workstream if files or responsibilities move.
- `plans/plan0.6.md` — update the forecast's shipped behavior and accepted limits to match the live-reach implementation.

## Manual pass list

- A bot declines a lane where a ball fits at the centre line but hits a lip between first touch and the centre line; an opening that fits at both points remains eligible.
- A moving ball already touching the divider is not given a negative arrival time and the bot does not claim a crossing it cannot affect.
- With contacts enabled, forecast fade gets shorter as ball count or summed radii increase and adjusts immediately after a resize.
- At 24 balls in the standard field, the calculated mean-free-path is approximately 526 shares; opacity at one mean-free-path is `e^-1` of full opacity.
- With contacts disabled, the trace has no collision-based fade or finite-distance cutoff.
- Bot character, energy/rest, lane choice and contested-hole behavior remain unchanged outside the improved fit eligibility.

## Validation

- L0: `node --check` on every touched JavaScript file.
- L1: `node experiments/bot_smoke.js` and `node experiments/forecast_smoke.js`.
- L2: full smoke suite and browser layout checks because classic script load order changes.
