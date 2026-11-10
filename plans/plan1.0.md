# 1.0 — Deferred task queue

## Outcome

Replace the single active objective with a small continuously replenished task list. A player can claim one unclaimed task; claiming reserves it for that player and keeps it visible until solved or explicitly abandoned.

## Design

- `tasks.js` remains the owner of objective predicates and lifecycle. Add a fixed-size queue (small enough to display at once) and stable task ids; avoid unbounded generation or allocation in the simulation loop.
- Generate new tasks until the configured visible queue size is reached. Only generate on initialization, claim/complete/abandon events, or explicit queue maintenance—not every frame. Do not copy the draft's fallback generator loop: its `|| guard > 50` condition is inverted, so reaching the guard can prolong rather than stop the loop. Use bounded candidate scans and surface an explicit empty/waiting state when no playable candidate exists.
- Task state is `open`, `claimed`, or `complete`. A task can be claimed once; a claimed task retains its claimant. Completing it removes it from active work and replenishes the open list. Do not auto-claim or silently transfer tasks.
- In single-player, the player can claim one task at a time. The progress predicate remains the 0.2 definition and is evaluated from the shared distribution. Claimed task progress is shown separately from open task summaries.
- If all available tasks are claimed, show that no open task is available until a task completes or is abandoned. Abandoning returns the task to `open`; it does not reset the field or objective definition.
- Queue length and generated task data are not settings in this slice. Use a small fixed queue size and the existing seeded/injectable generator so tests can assert replenishment without depending on randomness.
- `tasks.js` owns queue state and transitions; `status.js` or a dedicated task-view feature owns presentation. Keep DOM concerns out of task rules.

## Files and ownership

- `tasks.js` — extend objective lifecycle with bounded queue and claim transitions.
- `status.js` — present queue summaries and claim/abandon actions, or add `task-list.js` if the list has enough behavior to merit its own owner.
- `main.js` — wire events only.
- Update `AGENTS.md` ownership map if a presentation file is split out.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: deterministic tests for queue refill, queue cap, exclusive claim, abandon/reopen, completion/replenishment, and the no-open-task state.
- Manual: claim a task, verify it stays assigned, complete and abandon tasks, and ensure new tasks appear without duplicates or a queue growing beyond its cap.

## Dependencies and next step

Deferred after 0.2 and intentionally not required for the first playable single-task loop. The queue is a single-player feature; implement 2.0 separately so multiplayer ownership rules do not complicate this first queue version.
