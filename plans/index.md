# Entropy Balls plans

These plans turn `draft.txt` into implementable slices. The numbers identify subjects; the order below is the dependency order, not a release/version sequence.

## Build order

1. ~~0.1 — Field simulation and canvas~~ — done: [plan](../archive/0.1-plan.md), [worklog](../archive/0.1-worklog.md).
2. ~~0.2 — Sorting objectives and progression~~ — done: [plan](../archive/0.2-plan.md), [worklog](../archive/0.2-worklog.md).
3. ~~0.4 — Objective difficulty~~ — done: [plan](../archive/0.4-plan.md), [worklog](../archive/0.4-worklog.md).
4. ~~1.1 — Quest goal preview~~ — done: [plan](../archive/1.1-plan.md), [worklog](../archive/1.1-worklog.md).
5. ~~0.3 — Hole force and energy~~ — done (force GUI in place).
6. [gui.1 — Settings and status UI](plangui.1.md): settings table and URL persistence include friction, players, ball count and speed; the status strip remains.
7. [1.0 — Task queue](plan1.0.md): deferred task list and task claiming, after the single-task loop is proven.
8. ~~2.0 — Two players and bot~~ — done: [plan](plan2.0.md), independent objectives and shared controls.
9. ~~2.1 — Bot opponent policy~~ — done: [plan](plan2.1.md), lane aim and energy rests.
10. ~~2.2 — Player scoreboard and independent bots~~ — done: [plan](plan2.2.md), independent bots and live ball tuning.
11. ~~2.3 — Bot plan aim~~ — done: bots aim at the split a task needs instead of at traffic.
12. ~~2.4 — A bot that reads the objective~~ — done: signed quotas (`<` objectives), crossing-time
    aim, arrival gate, hold defence, thresholds 10-90, large side arrow on the card.
13. [0.5 — Aperture and energy settings](plan0.5.md): hole size, hole speed, energy cost and storage.
14. [draft coverage](draft-coverage.md): what `draft.txt` asks for, what ships, what is still open.

## Shared product decisions

- The play area is divided into left and right chambers by a vertical central wall. Its only passage is a movable aperture.
- Balls are circles. They travel without drag, reflect off the outer walls and solid portions of the divider, and can cross chambers only through the aperture. Ball-to-ball collision response is a setting.
- A task measures the fraction of balls on a specified side that belong to the specified category. “Hot” and “cold” are visual categories, not a simulated temperature. A color task names a particular color. Each task carries a difficulty label derived from the fewest balls it needs to cross the divider; tasks that are already true, or that need more crossings than the field can pay for, are never assigned.
- Progress is evaluated on fixed simulation steps. Each generated task requires either immediate satisfaction or a continuous two-second hold; a new task follows completion. An empty side never completes a task.
- The control model is explicit signed push/pull along the aperture’s vertical track. Pointer hold/touch hold activates it; mouse wheel and a visible slider adjust force magnitude. This avoids relying on ambiguous pointer gestures.
- Settings and live gameplay values have one owner each, and the browser URL is the shareable settings representation. The design remains local and file:// friendly, with classic script tags and no build or network dependency.
- Single-player starts with one human. The player table exposes both slots; either can be a bot, and two bots can play while the user spectates. Each participant keeps its own task, input channel and energy store.

## Manual completion checklist

- At narrow and wide viewport sizes, both chambers and the central passage remain visible and usable.
- Balls remain inside the field, pass only through the opening, and do not acquire drift from drag.
- The task's displayed category, side, comparator, and threshold agree with the measured ball distribution, and its difficulty label is shown.
- Holding a quest item draws the goal on the canvas and opens its panel; the field stops while held and resumes on release, pointer cancellation, or focus loss.
- The goal drawn on the canvas satisfies the held objective, rings only the balls that have to cross, and states its split and crossing count.
- Every target swatch agrees with the selected appearance mode, and each mode option previews its own shape: one ball, a row of balls, or a palette bar.
- Holding a force control spends energy; releasing it stops force immediately. Each participant’s energy regenerates only as specified by storage/source settings.
- Opening a copied URL restores settings without requiring a server; gameplay state is not persisted.
- Mouse and touch controls both activate and release cleanly; status/help does not cover the field or primary controls.
- Bot and human controls can be distinguished and each participant uses their own energy budget.
- The score table counts completed quests, both bot checkboxes work independently, and New round resets play without changing settings.
- Ball count and average speed sliders update the live field and restore from a copied URL.
