// owns: player table, independent bot checkboxes, scores and live ball-setting smoke checks
// edit for: scoreboard controls, score lifecycle, bot-mask URLs, ball sliders

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const settings = apis['settings.js'];
const players = apis['players.js'];
const input = apis['input.js'];
const force = apis['force.js'];
const tasks = apis['tasks.js'];
const tcost = apis['taskcost.js'];
const bot = apis['bot.js'];
const panels = apis['forcepanel.js'];
const score = apis['scoreboard.js'];
const quest = apis['quest.js'];
const DT = sim.FIXED_DT;

let pass = 0;
let fail = 0;

function check(name, ok) {
	if (ok) pass++;
	else {
		fail++;
		console.log('FAIL ' + name);
	}
}

function near(a, b, tol = 0.01) {
	return Math.abs(a - b) <= tol;
}

function reset() {
	input.inputRelease();
	settings.settingsApply(settings.settingsDefaults, false);
	sim.simSetSpawnRate(0);
	sim.simInit();
	tasks.tasksInit();
	tasks.tasksAttach(0);
	force.forceInit();
	bot.botInit();
	input.inputRebind();
	panels.forcePanelPaint();
	score.scoreboardPaint();
	quest.questRepaint();
}

function warmPalette() {
	for (let p = 0; p < 8; p++) if (tasks.tasksCatHas(0, p) === 1) return p;
	return 0;
}

function place(i, x, palette) {
	const b = sim.simBalls;
	b.x[i] = x;
	b.y[i] = 400;
	b.vx[i] = 0;
	b.vy[i] = 0;
	b.r[i] = 12;
	b.palette[i] = palette;
	b.count = i + 1;
	sim.simFillDist();
}

function row(id) {
	return score.scoreboardUi.rows[id];
}

function modeText() {
	return stubs.els['score-mode'].textContent;
}

reset();
check('table: both slots are visible while only player 1 is active', score.scoreboardUi.rows.length === 2
	&& row(0).el.getAttribute('data-active') === 'true' && row(1).el.getAttribute('data-active') === 'false'
	&& row(0).score.textContent === '0' && row(1).score.textContent === '—');
check('table: each checkbox names its player', row(0).checkbox.getAttribute('aria-label') === 'Player 1 is a bot'
	&& row(1).checkbox.getAttribute('aria-label') === 'Player 2 is a bot');
check('table: solo mode is explained', modeText() === 'Solo · you control Player 1');

const persistentRow = row(0).el;
row(1).checkbox.checked = true;
row(1).checkbox.dispatch('change');
score.scoreboardPaint();
panels.forcePanelPaint();
quest.questPaint();
check('checkbox: checking an open slot joins a bot', players.players.count === 2
	&& players.players.type[1] === players.PLAYER_BOT && settings.settingsState.bots === 2
	&& row(1).el.getAttribute('data-active') === 'true');
check('character: the bot row names the character next to the player', (() => {
	const char = bot.botCharOf(1);
	return char !== null && row(1).badge.hidden === false && row(1).badge.textContent === char.icon
		&& row(1).badge.title === char.name + ' · ' + char.hint
		&& row(1).badge.getAttribute('data-char') === char.id;
})());
check('character: the human row keeps an empty badge', row(0).badge.hidden === true);
// the objective sits in the same column as the control that serves it: card, then panel, per player
check('layout: each player column is an objective above that player\'s force panel', (() => {
	const root = stubs.els['force-panels'];
	if (root.children.length !== players.players.count) return false;
	for (let id = 0; id < root.children.length; id++) {
		const pair = root.children[id].children;
		if (pair.length !== 2) return false;
		if (pair[0].className !== 'quest' || pair[1].className !== 'force-panel') return false;
		if (pair[0].children[1].className !== 'quest-bar') return false;
	}
	return true;
})());

check('table: controller changes keep the same rows and add player prefixes', row(0).el === persistentRow
	&& stubs.els['task-list'].children[0].children[0].children[1].className === 'quest-arrow'
	&& stubs.els['task-list'].children[0].children[0].children[2].textContent.indexOf('P1 ') === 0);

row(0).checkbox.checked = true;
row(0).checkbox.dispatch('change');
score.scoreboardPaint();
panels.forcePanelPaint();
check('checkbox: both players can be bots', settings.settingsState.bots === 3
	&& players.players.type[0] === players.PLAYER_BOT && players.players.type[1] === players.PLAYER_BOT
	&& modeText() === 'Bot match · spectating');
check('bot match: both force panels are read-only', row(0).checkbox.checked && row(1).checkbox.checked
	&& panels.forcePanels.rows[0].slider.disabled && panels.forcePanels.rows[1].slider.disabled);
check('character: both bot rows show their own character', (() => {
	for (let id = 0; id < 2; id++) {
		const char = bot.botCharOf(id);
		if (!char || row(id).badge.hidden || row(id).badge.getAttribute('data-char') !== char.id) return false;
	}
	return true;
})());
const ignoredPointer = stubs.els.canv.dispatch('pointerdown', { pointerId: 1, button: 0, clientY: 100 });
for (const fn of stubs.listeners.keydown || []) fn({ code: 'Space', target: { tagName: 'DIV' }, preventDefault() {} });
check('bot match: pointer and keyboard cannot claim a slot', !ignoredPointer.defaultPrevented
	&& !input.inputControls(0) && !input.inputControls(1) && force.forceState.held[0] === 0 && force.forceState.held[1] === 0);

reset();
settings.settingsSetBot(1, true, false);
sim.simBalls.count = 0;
place(0, 300, warmPalette());
place(1, 900, warmPalette());
tasks.tasksAssign(0, 'left', 'hot', '>', 30, 'immediate');
tasks.tasksAssign(1, 'right', 'hot', '>', 30, 'immediate');
tasks.tasksStep(DT);
score.scoreboardPaint();
check('score: both slots can complete on the same step', tasks.tasksScore[0] === 1 && tasks.tasksScore[1] === 1
	&& row(0).score.textContent === '1' && row(1).score.textContent === '1');

reset();
sim.simBalls.count = 0;
place(0, 300, warmPalette());
place(1, 900, 5);
tasks.tasksAssign(0, 'left', 'hot', '>', 30, 'hold');
const holdSteps = Math.round(tasks.TASK_HOLD_SEC / DT);
for (let i = 0; i < holdSteps - 1; i++) tasks.tasksStep(DT);
check('score: an unfinished hold awards nothing', tasks.tasksScore[0] === 0);
tasks.tasksStep(DT);
score.scoreboardPaint();
check('score: a completed hold awards one point', tasks.tasksScore[0] === 1 && row(0).score.textContent === '1');
settings.settingsSetBot(0, true, false);
score.scoreboardPaint();
check('score: changing controller preserves the slot score', tasks.tasksScore[0] === 1 && row(0).score.textContent === '1');

reset();
sim.simBalls.count = 0;
place(0, 300, warmPalette());
place(1, 900, 5);
tasks.tasksAssign(0, 'left', 'hot', '>', 30, 'hold');
for (let i = 0; i < 60; i++) tasks.tasksStep(DT);
sim.simBalls.x[0] = 900;
sim.simFillDist();
tasks.tasksStep(DT);
check('score: an interrupted hold awards nothing', tasks.tasksScore[0] === 0 && tasks.tasksHold[0] === 0);

reset();
input.inputSetValue(0, 60);
tasks.tasksScore[0] = 7;
stubs.els['score-restart'].dispatch('click');
check('restart: scores, field and stores reset while settings stay', tasks.tasksScore[0] === 0
	&& sim.simBalls.count === sim.BALL_START_COUNT && force.forceState.energy[0] === force.FORCE_CAPACITY
	&& settings.settingsState.bots === 0 && row(0).score.textContent === '0');
for (const fn of stubs.listeners.keydown || []) fn({ code: 'Space', target: { tagName: 'DIV' }, preventDefault() {} });
check('restart: a human selection is projected into the fresh store', force.forceState.held[0] === 1
	&& force.forceState.mag[0] > 0);
for (const fn of stubs.listeners.keyup || []) fn({ code: 'Space' });

reset();
settings.settingsSetBot(1, true, false);
settings.settingsSetBot(0, true, false);
settings.settingsSetBot(1, false, false);
panels.forcePanelPaint();
score.scoreboardPaint();
check('channels: a lone human in slot 2 receives the pointer and Space', input.inputState.mouse === 1
	&& input.inputState.keys === 1 && input.inputChannel(1) === 'mouse' && input.inputApplyKey() === 'Space'
	&& panels.forcePanels.rows[1].kind === 'Mouse' && modeText() === 'Player 1 is a bot · you control Player 2');
stubs.els.canv.dispatch('pointerdown', { pointerId: 2, button: 0, clientY: 100 });
check('channels: the lone human can move from the field', force.forceState.held[1] === 1
	&& force.forceState.dir[1] === -1 && force.forceState.held[0] === 0);
stubs.els.canv.dispatch('pointerup', { pointerId: 2 });
settings.settingsSetBot(0, false, false);
settings.settingsSetHumans(2, false);
check('channels: two humans split pointer and arrows', settings.settingsState.bots === 0
	&& input.inputState.mouse === 0 && input.inputState.keys === 1);

reset();
while (sim.simBalls.count < 24) sim.simSpawn();
stubs.els['settings-balls'].value = '12';
stubs.els['settings-balls'].dispatch('input');
check('balls slider: lowering the limit trims the live field and updates its output', sim.simBallConfig.count === 12
	&& sim.simBalls.count === 12 && stubs.els['settings-balls-value'].textContent === '12');
check('balls slider: a population change reprices active objectives without scoring', tasks.tasksScore[0] === 0
	&& (tasks.tasksView[0].waiting || tcost.tasksInBand(tasks.tasksView[0].cost, tasks.tasksView[0].demand,
		tasks.tasksView[0].measure === 'total' ? 1 : 0, tasks.tasksView[0].mode === 'hold' ? 1 : 0)));
stubs.els['settings-balls'].value = '18';
stubs.els['settings-balls'].dispatch('input');
check('balls slider: raising the limit does not reset the field', sim.simBalls.count === 12);
sim.simSetSpawnRate(24);
for (let i = 0; i < 120; i++) sim.simStep(DT);
check('balls slider: new arrivals fill the raised limit', sim.simBalls.count === 18);
const vx = sim.simBalls.vx[0];
const vy = sim.simBalls.vy[0];
stubs.els['settings-ball-speed'].value = '210';
stubs.els['settings-ball-speed'].dispatch('input');
check('speed slider: live velocities scale and the output follows', sim.simBallConfig.speedShare === 210
	&& near(sim.simBalls.vx[0], vx * 210 / 180) && near(sim.simBalls.vy[0], vy * 210 / 180)
	&& stubs.els['settings-ball-speed-value'].textContent === '21 %/s');
const changedUrl = new URL(stubs.win.location.href);
check('sliders: changes persist under stable URL keys', changedUrl.searchParams.get('balls') === '18'
	&& changedUrl.searchParams.get('speed') === '210');

check('normalization: ball controls clamp and reject invalid values', settings.settingsNormalize('balls', '1') === 6
	&& settings.settingsNormalize('balls', '999') === 36 && settings.settingsNormalize('balls', 'bad') === 24
	&& settings.settingsNormalize('ballSpeed', '1') === 50 && settings.settingsNormalize('ballSpeed', '999') === 350
	&& settings.settingsNormalize('ballSpeed', '177') === 175 && settings.settingsNormalize('ballSpeed', '') === 180);
const parsed = settings.settingsFromSearch('?bots=3&balls=12&speed=210');
settings.settingsApply(parsed, false);
settings.settingsWriteUrl();
const restoredUrl = new URL(stubs.win.location.href);
check('URL: a copied bot match restores controllers and ball settings', players.players.count === 2
	&& settings.settingsState.bots === 3 && sim.simBallConfig.count === 12 && sim.simBallConfig.speedShare === 210
	&& restoredUrl.searchParams.get('bots') === '3' && restoredUrl.searchParams.get('balls') === '12'
	&& restoredUrl.searchParams.get('speed') === '210' && !restoredUrl.searchParams.has('humans'));
settings.settingsApply(settings.settingsDefaults, false);
settings.settingsWriteUrl();
check('URL: all defaults are omitted', stubs.win.location.search === '');

console.log('scoreboard_smoke pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
