# Deferred — task list with sign-up

Parked from the draft. Not implemented in the 0.1.x milestone. Read when the
core loop (0.1.0–0.1.5) is playable.

## Scope

- Maintain a list of 3–5 generated tasks at all times; refill when one is taken
  or solved.
- A player can sign to a task; signing assigns that task to the player and
  removes it from the open list.
- Tasks in the list are the same shape as 0.1.3.
- UI: a panel listing open tasks with a "sign" button per task and the player's
  currently signed task.

## Open questions

- Whether a player may hold more than one signed task at a time.
- Whether solving a signed task awards more than an unsigned auto-generated one.
- Whether the list is shared between players or per player.

Resolve these when picking the work up; the core task generator (0.1.3) is
unaffected either way.
