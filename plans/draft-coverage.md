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
| slider ball generation | open | spawn rate is a constant; the count limit is a different knob |
| slider ball size, same or random size | shipped | `ballSize` 0.6–2.6 % mean radius with a random-sizes switch, gui.3; a share of the field since gui.4 |
| average ball speed | shipped | `ballSpeed`, 5–35 %/s since gui.4 |
| checkbox ball collisions | shipped | `collisions` setting driving `simSetBallCollisions`, gui.3 |
| white/dark theme, hole as background color | open | one dark theme is hard-coded in the canvas and CSS |

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
| draw the trajectory of balls heading for the wall, in the ball's color | shipped | `canvas.js` |
| predicted position and trajectory lines, off by default where noted | shipped | `canvas.js` |
| slow fade hit spot after a hit | shipped | `canvas.js` |

## Status and help

| draft asks for | status | where |
| --- | --- | --- |
| status bar for constant info and current help | shipped | `status.js`, gui.1: live/preview state with per-slot controller help inside the gui.2 drawer; numeric task/energy values remain in their feature panels |

## What is open, and is it planned?

Two different things are missing, and they are not the same kind of missing:

- **Planned, with a plan file.** The task queue, task claiming and the open/claimed/complete states
  (`plan1.0.md`).
- **Deferred by a recorded decision, with no plan file.** The white/dark theme and the spawn-rate
  slider. Each needs a styling or simulation change before a control can exist, so a plan file would be
  a one-line table entry plus that change. "A player signs to a task" is part of 1.0 and is not needed
  while every live slot already owns one objective.

The remaining unplanned draft features are the theme and the generation slider. The near-target quest
category and both percentage denominators ship in 2.5; ball size and collisions ship in gui.3.

Everything else in `draft.txt` ships. Nothing in the draft is blocked by an architectural gap: each
open item is a table row or a control.

## Why the gaps are gaps

- The settings list was trimmed on purpose in gui.1: aperture size/speed, energy rates, ball size,
  collision reflections and theme were deferred so the settings table could ship with a proven URL
  format. Adding a key is one table entry (`SETTINGS_KEYS`) plus one normalize/encode branch; gui.3 and
  0.5 filled in four of them that way.
- The task queue (1.0) was deferred behind the two-slot objective model. 2.0–2.2 gave each slot its
  own objective, which is a stronger version of "one task per player" for the two-player game; the
  queue is only needed if a player must choose among several open tasks.
- Status content inside the settings drawer owns live/preview state and contextual control help. Counts, hold progress and
  energy stay in their feature panels so the same changing numbers do not compete for attention.
- The quest grammar was complete in 2.4 except for one dimension the draft names explicitly: which
  total the percentage is read against. 2.5 added it rather than leaving it as an accident of the
  predicate, because the same threshold is a different objective under each reading.

## Next step

gui.3 closed the ball-size, random-size and collision gaps. Plan 2.5 closed the two denominator gaps: a
threshold can now be read against the named chamber or against every ball of the category, and the six
palette ranges cover the draft's "similar to a random color" target. The light theme and the
ball-generation slider are the settings left; the bot's next measurable gain is pricing ball-to-ball
collisions in its lane score, because a 2.5 s forecast is still optimistic in a colliding field.
