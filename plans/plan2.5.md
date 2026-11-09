# 2.5 — Both denominators, priced scarcity, and a bot that reads the plan

## Outcome

An objective can measure the same threshold against two totals, and both kinds are generated and
playable:

- **side** — "40% of the left chamber is hot": the percentage is a share of the named chamber.
- **total** — "90% of every red ball is on the left": the percentage is a share of that category on the
  whole canvas.

A colour category is now one of: `hot`, `cold`, one of the six palette colours, or one of the six
adjacent palette ranges (`red/orange`, `orange/yellow`, `yellow/cyan`, `cyan/blue`, `blue/violet`,
`violet/red`). A range is the hue window a "similar to this colour" target covers; with six palette
hues every window is one colour or two neighbours, so the discrete set is the whole grammar.

Difficulty is banded on crossings and guarded twice: a demand ceiling rejects jobs that only one or
two balls can supply, and the whole-canvas immediate form has its own higher floor because its
crossings arrive about twice as fast. The bot derives the value of each crossing from the same
pricing, so both denominators and all four directions of traffic are read by one rule, and an
objective that is already met now defends itself instead of standing still.

Measured over seeded matches in `experiments/bot_match.js`:

| match | completions/min before | after | harmful crossings | `<` completions |
| --- | --- | --- | --- | --- |
| solo, 30 × 90 s | 0.69 | 0.89 | 177 → 111 | 3 → 25 |
| two bots, 20 × 90 s | 1.07 | 1.17 | 428 → 564 | 6 → 21 |

Objective kinds completed solo: side 27, whole-canvas 13, hold 17, immediate 23. The two-bot harm
rises because the participants' objectives now oppose each other in play rather than in deadlock:
crossings rose from 18.8 to 33.7 per minute and the hole travels further.

## Design

### Two denominators, one predicate

`tasksMeets(match, total, cmp, thresh)` is unchanged: the strict comparison is what keeps 1/2 from
being either `>50%` or `<50%`. What changes is which total the caller passes.

- side: `total = simDist.left` (or right), `match = tasksCatSide(cat, isLeft)`.
- total: `total = tasksCatTotal(cat)`, the same `match`.

The view carries both (`denom` is the total the objective is read against, `sideTotal` stays for the
chamber count), so the card, the hold panel and the goal view cannot disagree about the fraction.

### Cost with either denominator

`tasksCostFrom(cat, cmp, thresh, sn, sc, nAll, nCat, measure, out)` is the same single loop over the
named chamber's size `s` that plan 0.4 proved: the cheapest unit-L1 walk to a satisfying `(s, m)` from
the live `(sn, sc)`. Only the run of satisfying `m` changes, because the inequality is applied to
`measure ? nCat : s`:

- side: the run is `m > thresh% of s` (or `<`), so it moves with `s`.
- total: the run is `m > thresh% of nCat`, the same for every `s`, and the loop then picks the split
  nearest the current chamber, which is the minimal move. An empty chamber is allowed because the
  denominator is the category total; an absent category has a zero denominator and is never satisfied.

For the whole-canvas measure the cost therefore collapses to `|cut - sc|`: only matching balls change
the fraction, and the cheapest plan moves exactly those. The rest of the walk (goal view, progress
bar, quota reading) needs no special case.

### Demand: the crossings a scarce job costs

Crossings alone under-price the draft's "`>N%` of the left should be green, but there are only two
green balls" case: moving two named balls is cheap in crossings and expensive in traffic, because
every crossing has to wait for one of the two.

`tasksDemand` prices each quota by the live balls per supplying ball:

```
needCat * nAll / supplyCat + needOther * nAll / supplyOther
```

with `supply` the number of balls that can make that crossing at all (category balls outside the named
chamber for entries, inside for exits, and the matching complement for the other balls).

### Bands, floors and the ceiling

| label | crossings | measured solo completion time |
| --- | --- | --- |
| `easy` | 3 – 5 | 21.8 s |
| `normal` | 6 – 10 | 36.5 s |
| `hard` | 11 – 17 | 49.7 s |
| `expert` | 18 – `tasksCostMax()` | — (only reachable near a full field) |

- **Crossings set the label.** Over 90 completed seeded objectives, crossings ordered completion times
  (15 s / 21 s / 24 s at 3-4 / 5-7 / 8+ crossings). Demand did not: its top band was faster than its
  middle band, because one scarce ball is a short job when only one crossing is needed. Demand is a
  guard, not a label.
- **Demand ceiling** `min(54, 1.5 * live)`: rejects the objectives that need almost every ball of a
  rare category, which is the draft's stated concern.
- **Crossing ceiling** `min(27, 0.75 * live)`, unchanged from 0.4.
- **Two floors.** `TASK_COST_MIN = 3` keeps the outcome off a coin flip. The whole-canvas immediate
  form is floored one crossing higher: it only needs its own category to cross, and its measured
  median completion was 5.5 s against 21.4 s for a chamber-share objective of the same cost.
- The label is drawn first and the candidate inside it, so a band's width never decides its frequency.
  The comparator and the denominator are each drawn by equal chance inside the label and only then
  narrowed to what exists, so neither `>` nor the chamber-share reading becomes the default quest.

### A crossing's value is a cost delta

`tasksCrossValue(cat, cmp, thresh, isLeft, measure, isCat, entering)` returns `-1`, `0` or `1` by
pricing the same walk before and after one imagined crossing. This replaces the sign-of-two-quotas
rule from 2.4 and removes every edge case it had:

- a crossing that leaves the split satisfied is `0`, not damage — 2.4 called every matching ball
  leaving a `>` objective harmful even when the share stayed above the threshold;
- a crossing that cannot happen (a category ball in an empty chamber, more category balls outside than
  balls outside) is `0`;
- the whole-canvas measure scores every non-matching crossing `0`, because it cannot move that
  fraction. The quota rule would have counted those as harm.

### Aim, defence and the contested hole

- **One baseline, one rule.** The lane the hole already holds is the baseline; another lane must beat
  it by `BOT_SWITCH_SEC` of travel. When nothing scores above zero the bot looks at the lanes beside
  each predicted crossing, out of that ball's reach, and drives there only if that sheds traffic. That
  single rule replaces 2.4's separate hold-defence path and also fixes the play that read as "the bot
  ignores its own task": with no positive lane it stood still and let a crossing end a hold.
- **Wait on real traffic.** If no crossing is imminent, look up to 10 seconds for the first helpful
  crossing, including a non-category ball for a side-share objective. With imminent traffic and a
  remaining category quota, the same search can supplement the scoring horizon. A later predicted
  return assumes the earlier crossing happened and cannot justify a wait by itself. A stale lane
  gets no switch bonus when there is no imminent traffic.
- **Geometry stays physical.** Store each ball's true crossing height and clamp only candidate hole
  centres. Size prediction buffers for three crossings per ball, not just one.
- **Harm is weighted, not equal.** A crossing that loses ground costs `BOT_HARM = 1.6` of a gained
  crossing, because the travel spent arriving is not recovered.
- **The horizon is 2.5 s.** Measured on this grammar, 4 s and 2.5 s complete the same number of
  objectives within noise (26 vs 27 over 20 × 90 s) while 2.5 s drives less; the previous 4 s spent
  its store on crossings that never happened. Collision-blind prediction is still the limit, but it
  was not the reason a bot played the wrong objective.
- **The turn follows the plan.** A contested hole is allocated to the bot with the more to gain, the
  owner keeps it while it still has a plan (not only while it is moving), and a rival must be worth
  `BOT_PREEMPT ×` the owner's gain to take it early. For an owner with a negative defensive score,
  the preemption baseline is zero so a worse negative score cannot seize the hole.

## Files and ownership

- `tasks.js` — the category grammar (hot, cold, palette colours, palette ranges), the predicate, the
  view fields (`measure`, `denom`), generation over the larger candidate space, the label vocabulary.
- `taskcost.js` — the priced walk, the crossing value, demand and the difficulty bands.
- `bot.js` — the four priced crossing values, the aim baseline and its defensive pass, the turn rule.
- `quest.js`, `preview.js`, `goalview.js` — the denominator in the card, the panel and the goal label.
- `index.html` — one more script tag, after `tasks.js`.
- `experiments/task_smoke.js`, `bot_smoke.js`, `preview_smoke.js`, `scoreboard_smoke.js`,
  `difficulty_sweep.js`, `bot_match.js` — the new grammar, the crossing values and the measured
  completion times per label.

## Validation

- L0: `node --check` on every touched file.
- L1: `task_smoke` 61, `bot_smoke` 49, `preview_smoke` 58, `scoreboard_smoke` 28, `sim_smoke` 44,
  `force_smoke` 80 — fail 0.
- L2: `difficulty_sweep` at 36 balls — in-band share 0.629, no distribution without an in-band
  candidate, assigned labels 14/14/17/15 (easy/normal/hard/expert).
- `bot_match` solo 30 × 90 s and two bots 20 × 90 s, before and after, same seeds and harness.

## Dependencies and next step

Requires 2.4 (signed quotas, crossing-time aim, thresholds 10-90) and 0.4 (the priced walk). The
bot's remaining error is prediction: with collisions on, a 2.5 s lane forecast is still optimistic, and
a collision count in the lane score is the next measurable step. On the product side, the settings
table still lacks ball size, the collision checkbox and the light theme, and no plan file covers them.
