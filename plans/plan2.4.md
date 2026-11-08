# 2.4 — A bot that reads the objective

## Outcome

A bot plays the objective the card states, in the direction the card states it, at the lane the ball
will actually cross. Measured over seeded 90 s matches in `experiments/bot_match.js`:

| match | completions/min before | after | net helpful crossings/min before | after |
| --- | --- | --- | --- | --- |
| solo, 8 seeds | 0.25 | 1.00 | 4.83 | 10.17 |
| two bots, 6 seeds | 0.56 | 1.00 | 7.11 | 10.44 |

The share of crossings that help the objective rises from 64% to 75%, and the hole travels slightly
less (4747 → 4086 px per minute). Half the quest grammar ("less than") becomes playable instead of
being generated almost never.

## Design

- **A quota is signed.** `tasksCheapest` returns a satisfying split; the two counts still to fill are
  `needCat = match - catNow` and `spareOther = otherNow - otherTarget`. For `>X%` both are
  non-negative: matching balls enter, other balls leave. For `<X%` both are non-positive and the
  progress is the mirror crossing — a matching ball leaving the named chamber. A crossing predicate
  that only tests "entering && needCat > 0" therefore scores every crossing of a `<` objective as
  harmful, which is why those objectives were generated but never solved. The predicate reads the
  sign of each quota, not just its size.
- **A crossing happens at its own time.** The lane a ball crosses at is `y + vy * t` folded between
  the horizontal walls, evaluated at the crossing time. Folding at the current time instead aims the
  hole at the ball's present height, one crossing behind — every diagonal ball was aimed at where it
  already was.
- **The opening has a size.** A ball passes only if its whole body fits, so a lane counts a crossing
  within `aperture / 2 - radius` of its centre. The full half-height aims at lanes where the plate
  still blocks the ball.
- **Arrival is part of the plan.** A crossing that happens before the hole can reach the lane is a
  ball that bounces off the plate, so a lane is scored from its arrival time: crossings earlier than
  the travel are ignored and the value discount starts at arrival. Lane travel is priced at the
  bot's own magnitude, `speed * BOT_MAG`.
- **A satisfied hold only has to survive.** With nothing left to fill, every lane scores at or below
  zero and the normal score can never pick one, so a bot holding a two-second split sat wherever it
  happened to be and lost the hold to any harmful crossing. The hold path scores lanes by the
  crossings that would end the hold (`botCrossHurts`: the crossing that pushes the named chamber's
  share back across the comparator) and treats the lane the hole already holds as the baseline, so
  only a lane that is safer by more than the drive is taken.
- **The weights are units, not taste.** One crossing is worth `BOT_CROSS_SEC = 3.2` seconds of hole
  travel, and `BOT_DECAY_SEC = 1.5` sets how fast a later crossing loses value. Both were measured
  with `BOT_TUNE`: the previous 1.2 s left most lanes at a negative score at `BOT_MAG = 0.8` and the
  bot stood still. `BOT_MAG` is 0.8 rather than 1 because a store refills at a flat rate, so a slow
  drive is worth more crossings per energy — but a slow drive also arrives late, so the arrival gate
  and the magnitude have to be tuned together.
- **The quest grammar covers both directions.** With thresholds 30–70 and comparators drawn from a
  flat candidate pool, `<X%` is already satisfied on a random field 81% of the time; only ~7 of 80
  candidates per direction were playable against ~58 for `>X%`, so a card almost always said
  "greater than". The threshold table now spans 10–90 and the comparator is drawn by equal chance
  inside the chosen difficulty label, which makes `<` appear in the list (48 of 300 generated
  objectives) instead of being an accident of the field.
- **The side arrow is its own glyph.** The side is the fastest thing to read on a card, so it is a
  dedicated `quest-arrow` element at 24 px (19–21 px in the two compact layouts) rather than a
  character in the sentence. `questObjectiveText` still builds the one-line form for the hover panel
  and the goal label.

## Files and ownership

- `bot.js` — signed quotas, crossing-time fold, per-ball lane width, arrival gate, hold defence,
  measured weights and magnitude.
- `tasks.js` — threshold table, comparator-normalised candidate draw, larger candidate table.
- `quest.js` / `index.html` — the card's arrow element and its type scale in both compact layouts.
- `experiments/bot_smoke.js` — crossing-height, less-than quota, and hold-defence checks.
- `experiments/bot_match.js` — completion counts split by comparator and mode.
- `experiments/task_smoke.js`, `experiments/preview_smoke.js` — card text now reads arrow and words
  from separate elements.

## Validation

- L0: `node --check` on every touched JavaScript.
- L1: `bot_smoke` 49 checks, `task_smoke` 58, `preview_smoke` 58 — fail 0.
- L2 numbers: the table above, same harness and same seeds before and after
  (`git archive HEAD` of the previous commit run against the new harness).
- Manual: both arrows are legible at a glance on a 1280 px and a short viewport; a bot left alone
  completes about one objective a minute; a two-second hold task is now defended by moving off the
  lane instead of losing the hold.

## Dependencies and next step

Requires 2.3 (plan quota, repeat crossings, contest turns) and 0.5 (aperture size as a setting).
Next: the bot still ignores ball-to-ball collisions inside its four-second horizon, which is the
largest remaining error in its prediction; a shorter horizon for colliding fields, or a collision
count in the score, is the next measurable step.
