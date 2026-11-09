# AGENTS.md

## style

- use a single tab indentation. LF end.
const $ = id => document.getElementById(id);

- avoid deep nesting of braces { } and long if-else.
- flatten with early returns, helper functions, or flat data tables.

- avoid duplication of code.

- avoid allocations in the hot path (per-frame loop, sim, render).
- no new {}, [], object literals, closures, or string concat in the frame loop.
- reuse preallocated buffers / typed arrays / scratch objects.
- allocate once at setup, mutate in place per frame.
- these are not strict rules, use best.

- comments say why and decisions only. what-code-does belongs in names.
- 0-2 comments per function is normal. 3+ usually means names or structure are wrong — rename or restructure, don't comment.
- no banners, no commented-out code, no TODOs in code — that goes to plan or findings instead.

good:
	// 2x step: halves samples, still >60fps (plan 0.3, log 11-02)
not good:
	// increment i
	// loop over items

- no legacy support, no old versions, no outdated browsers, no leftovers and no over protecting from unreal edge cases. we need clean architecture.

good:
obj.action(obj.data)
obj.data.action()

not good:
getObj().data().action()

## runtime

- file:// friendly, classic <script> tags, no modules, no build.
- guard module.exports so files also run under node.
- no internet links: vendor any lib as a local js file.

## architecture

- index.html defines script load order. plain top-level globals, no per-file IIFE, no modules.
- one composer file owns root, $, shared objects and the boot tail. it implements nothing.
- feature files own their state and DOM refs. never reach into another file's internals.
- shared code gets a named owner. no junk drawers: no state.js, utils.js, misc.js, common.js.
- no definition-time cross-file reads: other files' code is called from inside functions only.
- top-level names must not collide with index.html ids (window[id] binding). check before adding any global. on collision: rename the newer binding; collision patterns -> findings.

## files

- every source file starts with a 1-2 line header:
	// owns: input handling and rebinding
	// edit for: key maps, bind changes
- relevance is decided from head -12. never read a full file just to learn what it is.

- keep this map updated when ownership changes:
	main.js — owns boot/wiring only. edit for load order, boot, wiring.
	simulation.js — owns field, balls, aperture position/bounds, physics, ball color generation, distribution snapshot. edit for constants, spawn, stepping, snapshot fields. the aperture's velocity is the drive force.js funds; simulation never reads a request.
	color.js — owns color conversions, warm/cold/near-target tests, the ball color envelope and circular hue mean. edit for palette hues, hue boundaries, distance metric, envelope.
	canvas.js — owns canvas sizing/drawing, impact/forecast buffers and visual cue controls. edit for cue options and draw styles.
	force.js — owns per-participant hole requests, energy stores, funding, the combined drive and the store readout. edit for energy rates, funding rules, readout.
	bot.js — owns bot policy: the value of each kind of crossing, predicted crossings (every repeat, at the height and time it happens), lane aim with an arrival gate and a baseline defence, energy rests and one-owner turns when bots contest the hole. edit for heuristics, aim horizon, rest thresholds, scoring weights, contest turns. it reads tasks.js's view and taskcost.js's values and writes only through force.js; never reads input.
	input.js — owns both human control channels: the pointer/wheel channel (player 1) and the keys channel (player 2 with two humans), their selections and holds. edit for bindings, strengths, hold gestures, channel assignment.
	players.js — owns participant identity, type and lifecycle. edit for the roster, controller mask, adding bots.
	tasks.js — owns objective rules, the category grammar (hot, cold, palette colours, palette ranges), generation, completion scores, per-participant lifecycle and the task view model (side, measure, counts, need, progress). edit for predicates, candidates, threshold table, hold duration, scores, progress measure.
	taskcost.js — owns the priced walk from the live distribution to a satisfying split, the per-crossing value, the scarcity demand and the difficulty bands, floors and ceilings. edit for cost/demand arithmetic, band edges, floors, crossing values.
	scoreboard.js — owns the player table, per-slot bot checkboxes, mode readout and restart control. edit for score columns, controller controls, table copy.
	preview.js — owns quest target appearance modes, their shapes and samples, the hold preview panel and its mode radios. edit for appearance modes, target shapes, panel copy.
	goalview.js — owns the held-quest goal view: which balls cross, goal layout, goal label. edit for goal layout, crossing rules, goal copy.
	settings.js — owns the settings table, defaults, URL persistence and controls. edit for settings keys, URL keys, ball count/speed and friction controls.
	status.js — owns live/preview status and per-slot contextual control help. edit for status copy and controller guidance.
	drawer.js — owns responsive settings disclosure, dismissal and per-layout localStorage preferences. edit for drawer behavior.
	game.css — owns game/HUD presentation. edit for full-screen field, edge player columns, score and drawer styles.
- new code goes to its owner, never appended "because the file is already there". no owner exists -> new file + header + map entry.
- file > ~500 lines = defect. split by feature within the same plan.
- moves are pure moves: contiguous ranges, snap to enclosing declarations, no behavior change.
- refactor or dedup mixed into a move = defect. separate plan, record the idea as a finding.

- findings-pitfalls-skills.md — notes and pitfalls for LLM agents. write here if found a good way to do something.
- archive/ — implemented plans and their worklogs.

## plans

- plan*.md is NOT the implementation log. final plan = standalone design artifact, written as if implemented today: no references to chat, to what was tried, or to what was done. usable for a fork or reimplementation.
- plan numbers (0.1, gui.1) identify subjects, not version or execution order. ok to continue old numbers by subject and implement in any useful order.
- drafts (0.1.x-draft.md) — human thoughts about goals and design. user prompts may be stored as drafts to keep a reference of the global task.

## worklogs

- worklog = index + evidence, not a diary. it has two future readers: the agent bisecting a regression into this change, and whoever forks or reimplements.
- worklog is named after its plan: archive/0.1.0-plan.md -> archive/0.1.0-worklog.md.
- entry <= 15 lines:
	plan id
	changed: file + nature (move/feature/fix), one line each
	validation: what ran, result, key numbers
	decisions and why — the only part anyone rereads
	pitfalls: one line here, full note in findings
	next step suggestion
- never record: plan restatement, attempt narrative, code walkthrough. git already has the diff.
- placement of process text:
	archive/ — how it was done
	findings — reusable lessons
	README — how to run only, <=10 lines, changes only when run instructions change
	in-game help / tooltips — written as if the product shipped today
- dev-process text anywhere else (README, in-game help, UI, tooltips) = defect.
- "we added a button to sum a and b" never exists outside archive/.

## experiments

- experiments/ — node measurement scripts, never loaded by the page.
- logs are machine format: fixed keys, fixed units, one line per metric.
	fps_pre=58 fps_post=61 step=2x plan=0.3
	a log a human must parse is a defect.
- comparison = a ~15-line node script: diff two logs by key, flag |delta| > 5%. conclusion (1 sentence + numbers) -> findings, raw stays in logs.
- keep only runs that produced a decision. prune the rest when the plan closes.

## validation

- scope = blast radius of the change. never "run everything to be safe".
	L0	node --check on touched files. every edit batch. seconds.
	L1	targeted smoke of the touched area (dom_smoke etc.). after a behavior change or a code move.
	L2	full suite + manual pass list. plan completion, handoff, or shared/boot files touched (index.html, load order, composer).
- leaf file touched -> L1 max. shared/boot touched -> L2.
- previous stage's validation stands until something it covers changes. no reruns to feel safe.
- batch checks at checkpoints, never per file inside one move. full tests after every work = CPU defect.
- manual pass list (what to verify by hand: look, sound, feel) lives in the plan.
- one file per commit (bisectable).

## workflow

- start work with review of the previous task: it was done by another agent and you can find a better way or real issues.
- same review polices compliance — comment budget, worklog format, placement. fix in place, one line in your own worklog. no test reruns: previous stage already validated it, rerun only what your fix itself touches.
- review the next step plan. improve it only with a concrete reason, then implement.
- record steps and validation in `archive/*-worklog.md` per `## worklogs`.
- end the job with a next step suggestion.

## current workstream

[rewritten each phase, never accumulated. only constraints that matter right now. delete lines that stopped mattering.]

plans 2.5 and 0.5 are in place. task cards mount inside each player's force column, above that player's panel; `#task-list` is only the pre-column mount point.
a card carries the side as a 24 px arrow glyph, a progress bar measured in priced crossings (then hold time), and a difficulty meta line.
an objective reads its threshold against one of two totals: the named chamber's balls (`>40% hot`) or every ball of the category on the canvas (`>90% of red`). the bot scores a crossing by the priced distance it removes, so both totals and all four traffic directions use one rule.
the difficulty label bands crossings; a scarcity demand rejects "only two green balls exist" jobs, and the whole-canvas immediate form is floored one crossing higher because its crossings arrive twice as fast.
plans/draft-coverage.md is the answer to "is this in the plan or still missing" — update it when a draft feature ships.
gui.2 uses a full-screen canvas with a centred, fully fitted field (no cropping) and a central divider. Player 1 is anchored left, Player 2 right, score top-right. Settings/help overlay compact screens and default to a left drawer on wide screens; drawer.js stores separate wide/compact visibility preferences. status.js lives inside the drawer, not a footer. Numeric task/energy readouts stay in their feature panels.

## housekeeping

- this file is editable law: fix a rule that produced a bad outcome in place; prune dead rules when a plan closes. target < 150 lines — the "don't waste context" rule applies here too.
