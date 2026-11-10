# Entropy Balls plans

These plans turn `draft.txt` into implementable slices. The numbers identify subjects; the order below is the dependency order, not a release/version sequence.

## Build order

1. ~~0.1 — Field simulation and canvas~~ — done: [plan](../archive/0.1-plan.md), [worklog](../archive/0.1-worklog.md).
2. ~~0.2 — Sorting objectives and progression~~ — done: [plan](../archive/0.2-plan.md), [worklog](../archive/0.2-worklog.md).
3. ~~0.4 — Objective difficulty~~ — done: [plan](../archive/0.4-plan.md), [worklog](../archive/0.4-worklog.md).
4. ~~1.1 — Quest goal preview~~ — done: [plan](../archive/1.1-plan.md), [worklog](../archive/1.1-worklog.md).
5. ~~0.3 — Hole force and energy~~ — done (force GUI in place).
6. ~~gui.1 — Settings and status UI~~ — done: [plan](plangui.1.md), [worklog](../archive/gui.1-worklog.md). Settings persistence and contextual live/preview status in the settings drawer.
7. [1.0 — Task queue](plan1.0.md): deferred task list and task claiming, after the single-task loop is proven.
8. ~~2.0 — Two players and bot~~ — done: [plan](plan2.0.md), independent objectives and shared controls.
9. ~~2.1 — Bot opponent policy~~ — done: [plan](plan2.1.md), lane aim and energy rests.
10. ~~2.2 — Player scoreboard and independent bots~~ — done: [plan](plan2.2.md), independent bots and live ball tuning.
11. ~~2.3 — Bot plan aim~~ — done: bots aim at the split a task needs instead of at traffic.
12. ~~2.4 — A bot that reads the objective~~ — done: signed quotas (`<` objectives), crossing-time
    aim, arrival gate, hold defence, thresholds 10-90, large side arrow on the card.
13. ~~2.5 — Both denominators, priced scarcity, a bot that reads the plan~~ — done: [plan](plan2.5.md),
    [worklog](../archive/2.5-worklog.md). Chamber-share and whole-canvas objectives, palette-range
    categories, difficulty with a demand ceiling, crossing values in the bot.
14. ~~0.5 — Aperture and energy settings~~ — done: [plan](plan0.5.md). Hole size/speed and energy cost/storage controls with URL persistence.
15. [draft coverage](draft-coverage.md): what `draft.txt` asks for, what ships, what is still open.
16. ~~gui.2 — Full-screen field and edge HUD~~ — done: [plan](plangui.2.md), [worklog](../archive/gui.2-worklog.md). Responsive settings drawer, saved disclosure preferences and left/right player columns.
17. ~~gui.3 — The screen is the field; ball size and collisions~~ — done: [plan](plangui.3.md),
    [worklog](../archive/gui.3-worklog.md). Borderless screen-sized field with a central divider, ball
    size/variety and the collision switch as settings.
18. ~~gui.4 — A field-relative game~~ — done: [plan](plangui.4.md),
    [worklog](../archive/gui.4-worklog.md). Every size and speed is a share of the field scale, so a
    phone plays like a desktop.
19. ~~2.6 — Bot characters~~ — done: [plan](plan2.6.md), [worklog](../archive/2.6-worklog.md).
    A slot draws a profit bot or a denier, shown as an icon and tint next to the player's name.
20. ~~0.6 — Forecast lines~~ — done: [plan](plan0.6.md), [worklog](../archive/0.6-worklog.md).
    A dashed path from each ball to the divider, through screen-edge bounces, ending in a mark on the
    plate or a run through the opening, and fading with the flight still ahead.
21. ~~0.7 — Whole-body bot crossings and live forecast reach~~ — done: [plan](plan0.7.md), [worklog](../archive/0.7-worklog.md). Bot lanes require whole-body fit at first touch and centre line; forecast fade follows live mean free path.
22. [3.0 — Colored-wall territory mode](plan3.0.md): separate URL-selectable mode with persistent color wall, color-matched passages and capture.
23. [3.1 — Ball-gun capture mode](plan3.1.md): separate URL-selectable mode with gravity-ray pull, predicted push and asymmetric player roles.

## Shared product decisions

- The play area is divided into left and right chambers by a vertical central wall. Its only passage is a movable aperture.
- Balls are circles. They travel without drag, reflect off the outer walls and solid portions of the divider, and can cross chambers only through the aperture. Ball-to-ball collision response is a setting.
- A task measures a fraction against one of two totals: the balls on the specified side (chamber share) or every ball of that category on the canvas (whole-canvas share). The category is hot, cold, a named palette colour, or a range of two adjacent palette colours. The comparator, the threshold, the side and the total are all drawn from the field's playable candidates. “Hot” and “cold” are visual categories, not a simulated temperature. A color task names a particular color. Each task carries a difficulty label derived from the fewest balls it needs to cross the divider; tasks that are already true, or that need more crossings than the field can pay for, are never assigned.
- Progress is evaluated on fixed simulation steps. Each generated task requires either immediate satisfaction or a continuous two-second hold; a new task follows completion. An empty side never completes a task. Difficulty is banded on the fewest crossings the objective needs; a scarcity-scaled ceiling rejects objectives that only one or two balls can supply.
- The control model is explicit signed push/pull along the aperture’s vertical track. Pointer hold/touch hold activates it; mouse wheel and a visible slider adjust force magnitude. This avoids relying on ambiguous pointer gestures.
- Settings and live gameplay values have one owner each, and the browser URL is the shareable settings representation. The design remains local and file:// friendly, with classic script tags and no build or network dependency.
- Single-player starts with one human. The player table exposes both slots; either can be a bot, and two bots can play while the user spectates. Each participant keeps its own task, input channel and energy store. A bot plays a character drawn when it takes its slot — profit (its own completions) or denier (the opponent's crossings are charged to the lane it chooses) — shown as an icon and tint beside the player's name.

## Manual completion checklist

- At narrow and wide viewport sizes, the divider stays central and the whole screen is playable field.
- Balls remain inside the field, pass only through the opening, and do not acquire drift from drag.
- A forecast line ends on the plate where its ball lands, or runs through the opening when the ball will pass; its dashes stand still, and it brightens as the ball gets near.
- The task's displayed category, side, comparator, threshold and denominator agree with the measured ball distribution, and its difficulty label is shown.
- Holding a quest item draws the goal on the canvas and opens its panel; the field stops while held and resumes on release, pointer cancellation, or focus loss.
- The goal drawn on the canvas satisfies the held objective, rings only the balls that have to cross, and states its split and crossing count.
- Every target swatch agrees with the selected appearance mode, and each mode option previews its own shape: one ball, a row of balls, or a palette bar.
- Holding a force control spends energy; releasing it stops force immediately. Each participant’s energy regenerates only as specified by storage/source settings.
- Opening a copied URL restores settings without requiring a server; gameplay state is not persisted.
- Mouse and touch controls both activate and release cleanly; status/help does not cover the field or primary controls.
- Bot and human controls can be distinguished and each participant uses their own energy budget.
- The score table counts completed quests, both bot checkboxes work independently, and New round resets play without changing settings.
- Ball count, average speed, ball size, random sizes and ball collisions update the live field and restore from a copied URL.
