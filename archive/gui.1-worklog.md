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
