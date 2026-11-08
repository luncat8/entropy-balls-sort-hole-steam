# 2.3 — Bot plan aim

## Outcome

A bot plays toward the split its objective actually needs, keeps the hole in a lane that is worth
holding, and never lets two bots pull the shared hole back and forth. Measured over seeded 90 s
matches, a solo bot's net helpful crossings rise from 0.67 to 1.47 per minute while its hole travels
2.2× less, and a two-bot match goes from 0 completed objectives to 0.67 per minute.

## Design

- **The objective is a split, not a direction.** `tasksCheapest` already prices the fewest crossings
  that reach a satisfying split. The bot reads that same plan: `needCat` is how many matching balls
  still have to enter the named chamber, `spareOther` how many non-matching balls may still leave it.
  A crossing is progress while either quota holds. A matching ball already in the chamber is quota,
  not traffic: opening for it loses the objective, which the previous per-ball rule could not express.
  The previous rule also ignored "less than" objectives and checked only the first crossing.
- **Predict every crossing, not the next one.** A ball that crosses the divider is in the other
  chamber moving away, so it returns after twice that chamber's width; with equal chambers the
  interval repeats and the lane advances by `vy` times it. `botPredict` lists up to three crossings
  per ball inside the horizon and flips the direction each time. This is the structure a hole can
  exploit: a lane that collects repeat crossings beats one that waits for a single ball.
- **Score lanes by crossings, discounted by arrival.** Each crossing in the aperture contributes
  `+1` when it moves the plan forward and `-1` when it moves it back, discounted by
  `1 / (1 + t / decay)`, times a crossing weight, minus the travel time to the lane. One crossing is
  worth about a second of hole travel, so a real lane beats standing still — with a smaller weight
  every possible lane scored below zero and the bot never moved.
- **A satisfied hold is still a job.** When the split is met but the task needs a two-second hold,
  the bot keeps the ledger and parks where harmful crossings are fewest instead of releasing the
  field to the traffic during the hold.
- **Parking is free; driving is not.** A bot standing in a lane with no harmful crossing predicted
  keeps that lane without spending energy. A lane that ties the current one never pulls the hole off
  it. Energy allows about four seconds of drive per recharge cycle, so unnecessary travel is the
  main way a bot loses.
- **One owner per contested hole.** Two bots aiming in opposite directions cancel while both pay.
  The first bot to want the hole owns it until it parks (then the other bot gets its turn) or until
  a long turn expires. A parked bot reserves no turn, and aligned requests still combine.
- `botTune` holds every number the policy decides with so a measurement can sweep them;
  `botSetTuning` rejects unknown or non-finite keys.

## Files and ownership

- `bot.js` — plan quota, multi-crossing prediction, lane score, safe-lane hold, contest ownership.
- `tasks.js` — no rule change; the bot reads `tasksView` and `tasksCheapest`'s plan.
- `experiments/bot_smoke.js` — plan, repeat-crossing and contest checks.
- `experiments/bot_match.js` — seeded match measurement (completions, crossing ledger, travel).

## Validation

- L0: `node --check` on touched JavaScript.
- L1: `bot_smoke` — 42 checks, including the quota reading, a crossing that loses the quota raising
  no lane, repeated crossings flipping chamber, and one-owner contest turns.
- L2: `bot_match` over seeded matches, before and after in the same harness:
  - solo, 5 × 90 s: net crossings 0.67 → 1.47 per minute, travel 11036 → 5108 px per minute.
  - two bots, 4 × 90 s: completions 0 → 4 total, net crossings 3.00 → 6.33 per minute.
- Manual: enable one bot and watch it park in a lane and hold it; enable both and confirm the hole
  is driven by one bot at a time rather than jittering.

## Dependencies and next step

Requires 2.1 (policy and rests) and 2.2 (per-slot objectives). Next: the aperture size is now a
setting, so a difficulty level can be expressed as "aperture share" rather than as policy constants.
