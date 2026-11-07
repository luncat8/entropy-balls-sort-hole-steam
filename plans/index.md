# Entropy Balls plans

These plans turn `draft.txt` into implementable slices. The numbers identify subjects; the order below is the dependency order, not a release/version sequence.

## Build order

1. [0.1 — Field simulation and canvas](plan0.1.md): establish the playable field, balls, movable central aperture, and impact visualization.
2. [0.2 — Sorting objectives and progression](plan0.2.md): define measurable tasks, completion, and single-player task renewal.
3. [0.3 — Hole force and energy](plan0.3.md): add held push/pull controls and the energy budget.
4. [gui.1 — Settings and status UI](plangui.1.md): expose simulation parameters, URL persistence, and in-game help/status.
5. [1.0 — Task queue](plan1.0.md): deferred task list and task claiming, after the single-task loop is proven.
6. [2.0 — Two players and bot](plan2.0.md): independent objectives, shared field and force controls, optional bot.

## Shared product decisions

- The play area is divided into left and right chambers by a vertical central wall. Its only passage is a movable aperture.
- Balls are circles. They travel without drag, reflect off the outer walls and solid portions of the divider, and can cross chambers only through the aperture. Ball-to-ball collision response is a setting.
- A task measures the fraction of all live balls of a specified category on a specified side. “Hot” and “cold” are visual categories, not a simulated temperature. A color task names a particular color.
- Progress is evaluated continuously; a task completes as soon as its stated percentage comparison is true. A new task follows completion in single-player.
- The initial control model is explicit push/pull with a target point on the aperture's vertical track. Pointer hold/touch hold activates it; mouse wheel and a visible slider adjust force magnitude. This avoids relying on ambiguous pointer gestures.
- Settings and live gameplay values have one owner each, and the browser URL is the shareable settings representation. The design remains local and file:// friendly, with classic script tags and no build or network dependency.

## Manual completion checklist

- At narrow and wide viewport sizes, both chambers and the central passage remain visible and usable.
- Balls remain inside the field, pass only through the opening, and do not acquire drift from drag.
- The task's displayed category, side, comparator, and threshold agree with the measured ball distribution.
- Holding a force control spends energy; releasing it stops force immediately. Energy regenerates only as specified by storage/source settings.
- Reloading a copied URL restores settings without changing gameplay state or requiring a server.
- Mouse and touch controls both activate and release cleanly; status/help does not cover the field or primary controls.
- Bot and human controls can be distinguished and neither can bypass the shared energy limit.
