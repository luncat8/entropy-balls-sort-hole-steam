# 2.2 — Player scoreboard and independent bots

## Outcome

A compact player table shows both slots, their completed-quest scores and a Bot checkbox for each. Either slot can be automated, including both at once. The remaining human receives the pointer and the single-human shortcuts. Ball count and average speed are adjustable in Settings and share the same URL persistence as the other settings.

## Design

- `scoreboard.js` owns the table, its two persistent rows, controller checkboxes, mode hint and restart button. It reads participant types and completed-quest counts; controller changes go through `settingsSetBot(id, on, true)`. Repainting compares cached values instead of rebuilding rows or writing DOM every frame.
- Player 1 starts human and alone. Player 2's row remains visible: checking Bot joins a bot, while the second-player setting joins a human. Unchecking an active bot makes that slot human. Turning the second player off removes that slot and clears its bot bit. Scores survive controller changes; New round clears scores, objectives, energy and the field without changing settings.
- `settings.js` stores `bots` as a two-bit mask: bit 0 is player 1, bit 1 is player 2. `bots=3` restores a two-bot match; zero is omitted. A nonzero second bit implies two participants. Enabling a second human clears only the second bit. There is no separate settings-panel bot checkbox.
- `playersInit(humans, bots)` constructs the roster and assigns each slot's controller. A roster change releases input, rebuilds the roster, gives both participants full independent stores, resets bot policy state and reattaches objectives only to live slots. It does not reset the field or scores.
- Input channels follow humans, not fixed slot numbers: the first human owns pointer/wheel, the second human owns arrows and Right. A lone human owns both channels and Space even in slot 2. With two bots no human channel is active; both force panels remain readable but disabled.
- When two bots aim in opposite directions, a two-second alternating priority lets one drive while the other releases and recharges. Aligned requests still combine; a resting or arrived bot reserves no turn.
- Each completed immediate objective or successful two-second hold adds one point before its replacement is generated. Waiting, an interrupted hold, changing controllers and changing ball settings never award points. Both slots can score on the same simulation step.
- `simulation.js` owns the live ball configuration. The count slider is a population limit, 6–36, default 24 (previously 36). Initial population and generation rate scale with that limit: the defaults start at 9 instead of 13 and reach the limit at the same pace. Lowering the limit removes excess balls immediately; raising it lets new balls arrive gradually. A population change regenerates active objectives so their difficulty cannot refer to balls that no longer exist, without clearing scores.
- Average ball speed is 50–350 px/s in 5 px/s steps, default 175 (previously 210). Changing it scales every existing velocity without changing direction; new balls sample the same relative speed distribution around the chosen average. The speed change does not reset objectives, scores, energy or positions.
- `main.js` wires the scoreboard restart hook and paint call. The table and objectives share a top-right HUD; narrow screens keep the table compact, place force panels side by side and keep the settings panel scrollable. Checkbox labels name their player, scores use tabular numerals, and sliders expose current values through adjacent outputs.

## Files and ownership

- New `scoreboard.js`; update the ownership map in `AGENTS.md`.
- `players.js`, `input.js`, `forcepanel.js` — controller-aware roster and human channel assignment.
- `tasks.js` — completion counters and objective regeneration after a population change.
- `settings.js`, `simulation.js`, `index.html` — bot mask, numeric settings, live ball configuration, table markup/styles and script order.
- `main.js` — boot, paint and restart wiring only.

## Validation

- L0: syntax checks on touched JavaScript.
- L1: scoreboard smoke covers all four bot masks, joining/removing player 2, human fallback in slot 2, no human input in a bot match, score increments for immediate/hold tasks, score preservation on controller changes, restart, checkbox synchronization and URL round trips.
- L1: simulation/settings smoke covers the lower defaults, count bounds, immediate trimming/gradual growth, objective regeneration, uniform velocity scaling, spawn speeds, invalid-value fallback and default omission.
- L2 because the document shell and boot wiring change: all existing smoke suites, plus a two-bot run with separate stores and completed quests.
- Manual: wide and narrow layouts; keyboard-toggle both checkboxes; watch two bots; switch either back to human; adjust both sliders while playing; reload a copied URL; hold/release a quest; New round; no overlap with force controls.

## Next step

Measure bot-versus-bot fairness over seeded matches before adding difficulty levels; the deferred task queue remains independent of this control surface.
