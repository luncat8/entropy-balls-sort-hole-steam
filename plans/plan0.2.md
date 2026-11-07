# 0.2 — Sorting objectives and progression

## Outcome

A single-player objective loop that asks the player to accumulate a chosen share of a ball category in the left or right chamber. The current task is visible, its progress updates from live simulation state, and solving it immediately generates the next task.

## Design

- `tasks.js` owns task definitions, generation, progress evaluation, completion, and task presentation data. It reads the simulation through a narrow function call from runtime code; it does not inspect another feature's private storage.
- Each task contains: destination side (`left` or `right`), category (`hot`, `cold`, or a named color), comparison (`greater-than` or `less-than`), and a percentage threshold. Generate thresholds in a useful bounded range rather than 0% or 100% edge cases.
- Assign each ball immutable category metadata when it is created. “Hot” and “cold” are category labels with distinct colors; color-category tasks select a named palette entry. Do not model temperature or let display color silently change the task predicate.
- The percentage denominator is all currently live balls. The numerator is live balls matching the requested category that are in the requested chamber. If there are no live balls, progress is 0% and no task completes.
- “Greater than” and “less than” are strict comparisons, matching the draft's `>x%` / `<x%`. Show the operator and threshold explicitly. Progress is the measured percentage, not a promise that the threshold is already met.
- Evaluate after each simulation update and complete immediately on the first satisfied update. Single-player keeps one active task; create its successor only after completion. Use an injectable/random source so task rules can be tested deterministically.
- Task generation must not create impossible wording: categories are selected from the configured palette/categories and side/comparator/threshold are always populated. A task may be difficult but remains mathematically satisfiable with live balls.
- `main.js` wires task evaluation to simulation updates and passes a compact view model to the UI. `canvas.js` continues to own field drawing; task display is not embedded in the canvas renderer.

## Files and ownership

- New `tasks.js` — objective rules and task lifecycle.
- `main.js` — boot/wiring only; connect simulation outputs, task state, and UI.
- Add `AGENTS.md` ownership-map entries for new source files.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: deterministic tests for exact-threshold strictness, category and side counts, zero-ball behavior, both comparison operators, and task replacement after completion.
- Manual: verify each displayed task against a deliberately arranged distribution and confirm the successor appears exactly once when solved.

## Dependencies and next step

Requires 0.1 ball metadata and chamber membership. Follow with 0.3; both force control and the task loop then use the same stable simulation interface.
