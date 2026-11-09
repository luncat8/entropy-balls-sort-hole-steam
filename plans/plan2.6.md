# 2.6 — Bot characters

## Outcome

Every bot plays a character, drawn when it takes its slot:

- **Profit** (gold, 💰) — plays for its own completions. This is the tuned policy of plan 2.5: a lane
  is worth the crossings it moves toward its own objective and costs what it moves away.
- **Denier** (red, 🚫) — plays for its own completions *and* charges the lane for the crossings the
  opponent would gain from, so it gives up a crossing of its own to close one of theirs.

The draw is uniform and independent per slot, so any combination can meet — two profit bots, two
deniers, or one of each. The character is shown next to the player's name: as an icon in the player
table, as the icon and the name in the bot's force column, in both cases in the character's tint.

Measured over seeded two-bot matches in `experiments/bot_match.js` (`BOT_CHARS`, 40 seeds × 90 s,
completions per slot):

| match | player 1 | player 2 | total |
| --- | --- | --- | --- |
| profit vs profit | 56 | 28 | 84 |
| profit vs denier | 43 | 26 | 69 |
| denier vs profit | 42 | 31 | 73 |
| denier vs denier | 47 | 26 | 73 |

A denier opponent costs the profit bot a quarter of its completions (56 → 43, 28 → 31 for the other
slot) while a denier keeps its own within a few points of a profit bot's (26 against 28), so the
character trades a little own progress for a larger cut of the opponent's. The two-player harness
favours player 1 structurally; the denier narrows that gap (ratio 0.60 against 0.50) instead of
outscoring it. Crossings per minute and the share of time the hole is held barely move (28.6 → 28.2,
0.140 → 0.145), so the difference is *which* lanes the hole serves, not how hard it drives.

With one slot, a denier is metric-for-metric identical to a profit bot: there is nothing to deny.

## Design

### A character is the lane score's second term

`botLaneScore(n, yc)` already prices a lane as the time-discounted crossings it serves minus the drive
to it. Each crossing now carries two signed values: the bot's own (`botCrossValue`) and the opponent's
(`botCrossValueRival`). The own value is read as before — a gain counts at full worth, a loss at the
tuned harm weight — and the opponent's contributes only when it is a gain, times the character's
`rival` weight:

```
net = Σ discount · (ownScore(v) + rivalScore(w)) − travel
ownScore(v) = v > 0 ? v : v · harm          // +1 gain, −1.6 loss
rivalScore(w) = w > 0 ? w · rival : 0       // 0 or −0.75 for the denier
```

`rival` is 0 for a profit bot, so its lane score is the tuned baseline untouched.

### Denial is refusal, not spite

A denier is not paid for crossings that *cost* the opponent. Steering the hole at those was tried
first (the opponent's loss counted as a gain) and it burned both objectives: the lane that hurts the
opponent's plan usually hurts the bot's own, so two deniers traded spite and completed almost nothing
(3 completions over 20 × 90 s, 17 matches with no completion at all). Charging only the opponent's
gains keeps denial honest and the match alive (73 completions, no more dead matches than the baseline).

### The opponent's plan

`botPlanOpen(id, plan)` now writes into a plan it is given, so `botRivalPlan` is priced by the same
code as the bot's own from `tasksView[rivalId]`. A slot with no objective, a waiting objective, or a
character whose `rival` weight is zero leaves the rival plan inactive and the lane score reads the
bot's own crossings alone. A human opponent has an objective like any other, so a denier closes lanes
against a human too.

The two plans share one prediction list: `botPredict` stores the category membership of each crossing
for the bot and for the opponent, because a crossing is the same ball at the same height and time for
both — only the category that counts differs.

### Contest and energy are unchanged

`botState.gain` is the lane score the character produced, and the contest already allocates the hole by
gain, so a denier's denial competes for the turn on the same terms as a profit bot's progress. Rests,
magnitudes and the dead zone stay shared: a character is a preference about lanes, not a different
energy budget.

### Draw and display

`botChar` holds one character index per slot, `-1` meaning "not drawn". `botRollChars` draws with
`botRand` for a bot that has none and clears the slot for a human, so a new round or a settings change
keeps the character of a bot that stays in its slot and rolls a new one for a slot that becomes a bot.
`botSetRand` seeds the draw for experiments and smoke tests.

`scoreboard.js` shows the icon in the player's row; `forcepanel.js` shows the icon and the character's
name in the header of the bot's column; `game.css` tints both through `data-char`. A human slot has no
badge at all.

### Weights

| character | `rival` | own gain | own loss |
| --- | --- | --- | --- |
| Profit | 0 | 1 | 1.6 (`botTune.harm`) |
| Denier | −0.75 | 1 | 1.6 |

The denial weight was swept −0.5 … −1.5 (`BOT_TUNE={"rival":x}` scales the table value, 40 seeded
matches per point). The opponent of a mixed denier lost 43 completions at every step from −0.5 up: the
suppression saturates early. The mirror match is what the weight costs — 73 completions at −0.75
against the 84 of two profit bots, 56 at −1.0, 46 at −1.25 — so −0.75 is the last weight where two
deniers still play a baseline-rate match.

## Manual pass list

- Turning a slot's Bot checkbox on shows an icon in the player table and the icon with the name in that
  player's force column; the tint matches the character.
- The character stays the same across New round and across settings changes that keep the bot; turning
  the bot off and on again draws a new one.
- Two bot slots can show the same character or one of each.
- A two-bot match with a denier visibly costs the other bot completions while the denier still
  completes its own objectives.
- A human slot never shows a badge; the badge fits the table and the column at narrow and short
  viewports.
