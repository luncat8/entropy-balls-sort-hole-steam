# 0.2 — Sorting objectives and progression

## Outcome

Each participant has an independently generated objective: change the composition of one chamber and meet the objective either immediately or for a continuous interval. The initial game has one participant; the task interface supports more without assuming a global current task.

## Design

- `tasks.js` owns objective definitions, generation, evaluation and lifecycle, keyed by stable participant id. It consumes a simulation-provided distribution snapshot, not private ball storage. Participant creation and control ownership belong to `players.js`.
- A task specifies side, category (`hot`, `cold`, or one named palette color), strict comparator (`>` or `<`), threshold and completion mode (`immediate` or `hold`). Randomly choose either mode at generation; a hold requires two continuous simulation seconds. Show the mode and hold progress in the task view.
- The percentage is matching balls on the chosen side divided by all balls on that side, based on center position. An empty side has no percentage and never satisfies either operator. Display the numerator and denominator so the meaning is clear.
- Evaluate once per fixed step. An immediate task completes on the first satisfying step. For a hold task, accumulate fixed-step time only while satisfied; reset it when false or the side is empty. Complete once at two seconds, replace only that participant's task, and evaluate the replacement no earlier than the next step.
- Balls retain immutable hot/cold and color metadata. Use the six-color palette from 0.1, with three colors per temperature category. Temperature is a label, not a physical property.
- Generate from bounded candidate thresholds and categories using an injectable random source. With the current live category counts, reject a task if no nonempty distribution of those balls across the two sides could meet it or if it is already satisfied when assigned. Account for discrete counts, strict comparisons, and absent categories. If no candidate exists, show a waiting state and retry only when the distribution or population changes; do not loop indefinitely. New ball generation may later change feasibility.
- Keep per-participant task and hold state separate; share the evaluator and generator. The UI receives a read-only view model. The second participant and bots are not required in this slice.

## Files and ownership

- New `tasks.js` — task rules, generation and per-participant lifecycle.
- New `players.js` — participant identity, type and lifecycle; initialize one human participant.
- `main.js` — boot and wiring only. Update the `AGENTS.md` ownership map.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: test side denominator, strict thresholds, empty sides, immediate and continuous-hold completion/reset, replacement timing, absent categories and discrete feasibility, bounded waiting/retry, and independent state for two participant ids.
- Manual: arrange distributions, check displayed counts and both completion modes, and verify a successor appears once.

## Dependencies and next step

Requires 0.1 ball metadata and distribution access. Continue with 0.3 energy-limited per-participant controls.
