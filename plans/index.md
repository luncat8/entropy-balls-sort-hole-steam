# Entropy Balls plans

These plans turn `draft.txt` into implementable slices. The numbers identify subjects; the order below is the dependency order, not a release/version sequence.

## Build order

1. ~~0.1 — Field simulation and canvas~~ — done: [plan](../archive/0.1-plan.md), [worklog](../archive/0.1-worklog.md).
2. ~~0.2 — Sorting objectives and progression~~ — done: [plan](../archive/0.2-plan.md), [worklog](../archive/0.2-worklog.md).
3. ~~0.4 — Objective difficulty~~ — done: [plan](../archive/0.4-plan.md), [worklog](../archive/0.4-worklog.md).
4. [1.1 — Quest goal preview](plan1.1.md): hold a quest to draw the goal on the canvas and open its panel, pick how target colors are drawn.
5. [0.3 — Hole force and energy](plan0.3.md): add held push/pull controls and the energy budget.
6. [gui.1 — Settings and status UI](plangui.1.md): expose simulation parameters, URL persistence, and in-game help/status.
7. [1.0 — Task queue](plan1.0.md): deferred task list and task claiming, after the single-task loop is proven.
8. [2.0 — Two players and bot](plan2.0.md): independent objectives, shared field and force controls, optional bot.

## Shared product decisions

- The play area is divided into left and right chambers by a vertical central wall. Its only passage is a movable aperture.
- Balls are circles. They travel without drag, reflect off the outer walls and solid portions of the divider, and can cross chambers only through the aperture. Ball-to-ball collision response is a setting.
- A task measures the fraction of balls on a specified side that belong to the specified category. “Hot” and “cold” are visual categories, not a simulated temperature. A color task names a particular color. Each task carries a difficulty label derived from the fewest balls it needs to cross the divider; tasks that are already true, or that need more crossings than the field can pay for, are never assigned.
- Progress is evaluated on fixed simulation steps. Each generated task requires either immediate satisfaction or a continuous two-second hold; a new task follows completion. An empty side never completes a task.
- The control model is explicit signed push/pull along the aperture’s vertical track. Pointer hold/touch hold activates it; mouse wheel and a visible slider adjust force magnitude. This avoids relying on ambiguous pointer gestures.
- Settings and live gameplay values have one owner each, and the browser URL is the shareable settings representation. The design remains local and file:// friendly, with classic script tags and no build or network dependency.
- Single-player starts with one participant using the same per-player task, input and energy interfaces intended for two-player and bot modes. Bot selection and the second participant are deferred.

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
