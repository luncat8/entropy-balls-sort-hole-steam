# draft coverage

What `draft.txt` asks for, what ships, and where the rest is planned. Written as a status
document: read it when asking "is this in the plan or still missing?".

Status words: **shipped**, **partial**, **planned** (a plan file names it), **open** (no plan yet).

## Settings panel

| draft asks for | status | where |
| --- | --- | --- |
| settings save to the URL | shipped | `settings.js`, gui.1 |
| slider hole size | shipped | `holeSize`, 6–24 % of the field scale, plans 0.5 and gui.4 |
| slider max hole speed | shipped | `holeSpeed`, 20–140 %/s, plans 0.5 and gui.4 |
| slider energy consumption to move the hole | shipped | `energyCost`, plan 0.5 |
| slider energy storage | shipped | `energyStore`, plan 0.5 |
| slider ball generation | shipped | `settings.js` and `simulation.js`; field-relative count-scaled spawn rate, URL-persisted |
| slider ball size, same or random size | shipped | `ballSize` 0.6–2.6 % mean radius with a random-sizes switch, gui.3; a share of the field since gui.4 |
| average ball speed | shipped | `ballSpeed`, 5–35 %/s since gui.4 |
| checkbox ball collisions | shipped | `collisions` setting driving `simSetBallCollisions`, gui.3 |
| white/dark theme, hole as background color | open | one dark theme is hard-coded in the canvas and CSS |
| Copy-link button in settings | shipped | `index.html`, `settings.js`; clipboard API with visible URL fallback |

## Force and hole control

| draft asks for | status | where |
| --- | --- | --- |
| two players with a bot checkbox each | shipped | `players.js`, `scoreboard.js`, plan 2.2 |
| push and pull the hole, energy with storage and a constant source | shipped | `force.js`, plan 0.3 |
| vertical force slider, green zero mark, force by distance | shipped | `forcepanel.js` |
| energy storage bar with a red two-second usage segment | shipped | `forcepanel.js` |
| wheel changes force, press slider or field to apply | shipped | `input.js` |
| pointer direction when the field is pressed | shipped | `input.js` |
| force panels show what a bot applies | shipped | `forcepanel.js`, plan 2.2 |
| two humans: mouse and ↑↓ with Right to apply | shipped | `input.js`, plan gui.1 |
| friction force checkbox | shipped | `settings.js` |

## Quests and the task list

| draft asks for | status | where |
| --- | --- | --- |
| quest generator over side, comparator, category, threshold | shipped | `tasks.js`, plan 0.4; thresholds 10–90 and both comparators drawn by equal chance in plan 2.4 |
| share of the named side ("60% of the left is red") | shipped | `tasks.js`, plan 2.5; the chamber is the denominator |
| share of every such ball on the canvas (">90% of all red balls must be on the left") | shipped | `tasks.js` + `taskcost.js`, plan 2.5; the category total is the denominator |
| "similar to random color" as a category | shipped | plan 2.5; six palette ranges (`red/orange` … `violet/red`) are the hue windows six palette hues can produce, and the preview draws the range |
| difficulty metric, label at generation, no free or impossible tasks | shipped | `taskcost.js`, plans 0.4 and 2.5; label from crossings, demand ceiling for scarce categories, two floors |
| hold quests and immediate quests | shipped | `tasks.js`, plan 0.2 |
| task list kept full, a player signs to a task | **partial** | `plan1.0.md`. Both live slots already hold one objective each, so the list is never empty while a slot is playing. The queue, the `open/claimed/complete` states, exclusive claiming and abandon are not built: generation is per slot, not per queue |
| hold a list item to preview a winning field | shipped | `goalview.js`, `preview.js`, plan 1.1 |
| target color as ball / range / smooth rectangle | shipped | `preview.js` |
| new game task once all tasks are solved | shipped | every completion generates a replacement immediately |
| visual progress of a task | shipped | per-card bar in `quest.js`; bar counts paid crossings, then the hold |
| either side, either comparator, hot/cold or a named color | shipped | `tasks.js`; `<` objectives are now generated at a playable rate (2.4) |
| side readable at a glance on the card | shipped | `quest.js` `quest-arrow`, 24 px glyph, plan 2.4 |

## Bots

| draft asks for | status | where |
| --- | --- | --- |
| two bot characters: one plays for its own profit, one for the opponent's denial | shipped | `bot.js`, plan 2.6; one lane score, the denier charges the crossings the opponent would gain from |
| a random character per bot, any combination | shipped | `bot.js` `botRollChars`: one uniform, independent draw per bot role |
| show the character as an icon or colour near the player (bot) name | shipped | `scoreboard.js` icon pill, `forcepanel.js` icon and name, both tinted by `data-char` in `game.css` |

## Field and drawing

| draft asks for | status | where |
| --- | --- | --- |
| field split by a movable-wall hole, balls reflect off walls | shipped | `simulation.js`, plan 0.1; the field is the whole screen and the screen edge is the wall, gui.3 |
| balls fly without friction | shipped | `simulation.js` |
| random ball colors with good saturation and light | shipped | `color.js`; six palette hues with random S/L, not a full wheel |
| warm/cold/near-target color tests | shipped | `color.js` |
| draw the trajectory of balls heading for the wall, in the ball's color | shipped | `trajectory.js` traces, `canvas.js` draws: a dashed line through screen-edge bounces that ends on the plate or runs through the hole, and fades with the flight left, plan 0.6 |
| predicted position and trajectory lines, off by default where noted | shipped | `canvas.js`: the plate mark (the ball's diameter, or the tip of a lip it clips) and the line come from one trace; both on by default, plan 0.6 |
| slow fade hit spot after a hit | shipped | `canvas.js`, off by default; marks the same rectangle the forecast did |

## Status and help

| draft asks for | status | where |
| --- | --- | --- |
| status bar for constant info and current help | shipped | `status.js`, gui.1: live/preview state with per-slot controller help inside the gui.2 drawer; numeric task/energy values remain in their feature panels |

## Additional mode drafts

| draft asks for | status | where |
| --- | --- | --- |
| Colored-wall territory mode, with persistent central-wall paint, neutral balls leaving no mark, and player-colored ownership | planned | [plan 3.0](plan3.0.md) |
| Matching-color passages plus a universal top passage; players move their guns along their own colored territory | planned | [plan 3.0](plan3.0.md) |
| One player steers the aperture while the other uses a pointer ball gun | planned | [plan 3.1](plan3.1.md) |
| Gravity-ray pull that weakens with distance and aim error; push refusal when a predicted path passes the hole | planned | [plan 3.1](plan3.1.md) |
| Show the selected ball's predicted path and filter other-ball forecasts to likely passes | planned | [plan 3.1](plan3.1.md) |
| Bot whole-body fit at first touch and centre line, policy split, and field-relative live fade | shipped | [plan 0.7](plan0.7.md), [worklog](../archive/0.7-worklog.md) |

## What is open, and is it planned?

Two different things are missing, and they are not the same kind of missing:

- **Planned, with a plan file.** The task queue, task claiming and the open/claimed/complete states
  (`plan1.0.md`).
- **Open, with no plan file.** The light theme. The spawn-rate slider is already implemented and
  URL-persisted. "A player signs to a task" is part of 1.0 and is not needed while every live slot
  already owns one objective.

The only remaining unplanned feature from `draft.txt` is the light theme. The generation slider and
copy-link button are already shipped; the task queue has its own deferred plan. The near-target quest
category and both percentage denominators ship in 2.5; ball size and collisions ship in gui.3.

Everything else in `draft.txt` ships. Nothing in the draft is blocked by an architectural gap: each
open item is a table row or a control.

## Why the gaps are gaps

- Settings have one key/default table and generic URL read/write loops, while normalization, encoding,
  binding and apply behavior remain explicit per setting. The generation slider already uses this path;
  a broader table-driven refactor is only worthwhile when the next setting needs it. The light theme is
  the one remaining setting-level gap from `draft.txt`.
- The task queue (1.0) was deferred behind the two-slot objective model. 2.0–2.2 gave each slot its
  own objective, which is a stronger version of "one task per player" for the two-player game; the
  queue is only needed if a player must choose among several open tasks.
- Status content inside the settings drawer owns live/preview state and contextual control help. Counts, hold progress and
  energy stay in their feature panels so the same changing numbers do not compete for attention.
- The quest grammar was complete in 2.4 except for one dimension the draft names explicitly: which
  total the percentage is read against. 2.5 added it rather than leaving it as an accident of the
  predicate, because the same threshold is a different objective under each reading.

## Next step

The two additional mode drafts are planned separately: plan 3.0 defines persistent colored-wall
territory and plan 3.1 defines the asymmetric ball-gun duel. Plan 0.7 closes the next forecast/bot
accuracy gap by checking whole-body fit at first touch and centre line, then verifies the already-live
mean-free-path fade (526 shares at 24 balls). The existing settings already include a generation slider,
URL-backed table keys and a copy-link fallback; the remaining small settings feature from the earlier
draft is a light theme. The task queue remains optional: implement plan 1.0 only if players need to
choose among several simultaneous objectives, and preserve its bounded queue/state-machine design
rather than reusing an unreviewed generator loop.
