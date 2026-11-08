# 2.1 — Bot opponent policy

## Outcome

With `bot` enabled, the second participant plays on its own: it reads the shared field, moves the
aperture through the normal force API, spends only its own energy store, and lets go while it
waits or recharges. A human can watch every request in the read-only player 2 panel.

## Design

- `bot.js` owns the policy and its per-slot state. It has no DOM, no input listeners and no
  simulation access beyond the read-only field arrays and the aperture's height and speed.
- Players: `settings.js` writes `bot=1` when the second slot is a bot. A bot only takes the second
  slot while one human plays; a human in that slot always wins it, and the bot checkbox is disabled
  while two humans are on. Enabling or disabling the bot rebuilds the participant list, clears each
  slot's policy state, and restarts objectives on the live slots.
- Each fixed step, for every `PLAYER_BOT` slot: re-aim at most every 0.2 s, then submit the request.
  The policy runs on the same fixed-step control hook as the human channels, so its energy is
  priced per fixed step exactly like a held slider.
- A predicted crossing is a ball's next meeting with the divider, including a ball that has to
  bounce off the outer wall first; its height is folded between the horizontal walls. A crossing is
  *wrong way* when the ball sits on the side where the objective can lose it: a matching ball in
  the named chamber leaving, or a non-matching ball there entering, for a "greater than" task, and
  the mirror of that for "less than".
- The hole parks in the lane with the best net traffic: every predicted crossing inside one
  aperture height counts for a ball, a wrong-way one against it, and the drive to that lane costs
  time. The lane the hole already holds is scored the same way and is kept unless a rival is
  clearly better, so the hole does not chase noise across the field.
- Energy: the policy holds at 80% force and rests once its share of the store falls to 15%,
  resuming at 55%. Resting, a satisfied or waiting objective, no positive lane, and arriving at the
  target all release the request, which keeps the selection for the next hold.

## Files and ownership

- New `bot.js` — predicted crossings, lane choice, aim hysteresis, energy rests.
- `settings.js` — the `bot` key, its URL encoding, the checkbox, and the participant rebuild.
- `main.js` — one control hook that runs both human channels and the bot per fixed step.
- `index.html` — script order after `players.js`/`force.js`, and the `settings-bot` control.
- `players.js`, `force.js`, `forcepanel.js`, `tasks.js` unchanged by this slice: participant type,
  requests, energy, panels and per-slot objectives already serve a bot.

## Validation

- L0: `node --check` on every touched file.
- L1: `experiments/bot_smoke.js` — lane choice for an incoming, a returning and a wrong-way ball,
  ignoring another category, releasing on a waiting or satisfied objective and on an empty field,
  the request shape and magnitude, the rest/resume hysteresis, one fixed step driving the bot
  through the hook, human slots untouched, and the `bot` setting rebuild with its URL round trip.
- L2: `sim_smoke`, `task_smoke`, `preview_smoke`, `force_smoke`, because the settings table, the
  participant rebuild and the fixed-step hook are shared. Measured in a dense field: a lane-seeking
  bot lets through more helpful crossings than a parked hole, and more than a policy that chases the
  soonest matching ball.
- Manual: enable the bot, watch its panel follow its own aim, and confirm both stores stay separate.

## Dependencies and next step

Requires the participant slots, force/energy layer and per-slot objectives of 2.0. Next: the
deferred task queue of 1.0, or a bot difficulty setting if the aim proves too strong against a human.
