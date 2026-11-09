# gui.1 worklog

## 2026-11-08 settings panel, two-human switch

plan id gui.1 (settings slice, after the force GUI of 0.3)
changed:
- settings.js feature — `SETTINGS_KEYS` table (`friction`, `humans`), one normalize/encode/URL path, load and apply on boot
- players.js feature — `playersInit(humans)` builds human slots; `playersAdd` still adds bots
- input.js feature — per-participant channel state (`mouse`, `keys`), per-player holds and requests, two-human binding (↑↓ select, hold → apply)
- forcepanel.js feature — channel labels (`Mouse`/`Arrows`), channel-aware rebuild detection and hints
- tasks.js / quest.js feature — `tasksRestart` keeps objectives on live slots only; `P1`/`P2` prefix with two humans
- index.html feature — `settings-humans` control, keys-only slider class, channel marker colour, script order (players, force, input)
- main.js fix — settings load after the force layer exists, since it rebuilds participants
- experiments/force_smoke.js feature — channel, apply-key, panel and settings round-trip checks; tests follow the new per-player signatures

validation: L0 `node --check` on all touched files; L1 force_smoke pass=77 fail=0; L2 sim_smoke pass=37, task_smoke pass=54, preview_smoke pass=58, all fail=0
decisions: channels are participant ids, so the bot/human switch, energy and panels need no new concept; the human count is written to the URL like friction and rebuilds participants only when it changes; player 2 owns the arrows because player 1 keeps the pointer and wheel, which avoids a second binding for the same key; keys-only slider ignores the pointer so a click cannot move a keyboard-owned value while ↑↓ still reach the window
pitfalls: a test loop must read `players.players.count` (`players.count` is undefined and silently skips the body); a module-level `const players` in an experiment shadows the game global — see findings
next: status strip (task progress, energy, contextual help) on the gui.1 seams, or a bot policy for the `PLAYER_BOT` slot

## 2026-11-08 ball count and average speed settings
plan id gui.1 (ball tuning slice; player controls are 2.2)
changed:
- settings.js feature — `balls` / `ballSpeed` keys, clamping, `speed` URL key, live slider bindings
- simulation.js feature — count limit 24 (initial 9), average speed 175, live trim/velocity scaling
- index.html feature — labelled range controls with adjacent outputs
validation: L1 sim_smoke pass=44 fail=0, scoreboard_smoke pass=27 fail=0; shared L2/browser evidence in 2.2 worklog
decisions: count is a population limit, not a round reset; lowering it reprices active objectives, raising it fills through generation; speed scales existing vectors without turning them
next: remaining draft sliders (aperture, energy, ball size) on the same settings path

## 2026-11-09 status and contextual controls
plan id gui.1
changed: status.js feature — cached live/preview message, per-slot pointer/keyboard/bot guidance, inactive-slot hiding
changed: index.html feature — normal-flow footer below a contained play-space, bounded wrapping help
changed: canvas.js fix — observe canvas resize when help changes the available field height
changed: main.js wiring — initialize and feed status through public channel queries and the preview flag
changed: experiments/status_smoke.js and vmload.js tests — status lifecycle, controller switches, restart, unchanged-frame writes
validation: L0 touched JS; L2 smoke suites 352 passed, 0 failed; difficulty sweep 60 seeds, in_band_share=0.629, distributions_without_in_band=0/60
validation: real-browser/manual pass pending — bundled Chromium cannot launch because host libnspr4.so is missing; no browser layout or file:// rendering result claimed
decisions: retain numeric status in existing feature panels instead of duplicating task/energy readouts; reserve footer space rather than overlaying controls; canvas observes layout-driven resizing
review: previous 0.5 code and smoke assertions already cover shipped aperture/energy controls; corrected stale plan-index status and contradictory draft coverage prose
next: verify the gui.1 manual pass list in a browser, then design ball-size and collision settings before implementing those unplanned controls
