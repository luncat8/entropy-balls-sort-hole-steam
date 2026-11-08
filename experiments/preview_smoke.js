// owns: plan 1.1 smoke for target appearance modes, the hold panel and the canvas goal view
// edit for: mode coverage, goal layout checks, hold lifecycle

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs, document } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const tasks = apis['tasks.js'];
const quest = apis['quest.js'];
const goal = apis['goalview.js'];
const preview = apis['preview.js'];
const main = apis['main.js'];

let pass = 0;
let fail = 0;
let sampleScratch = null;

function check(name, ok) {
	if (ok) pass++;
	else {
		fail++;
		console.log('FAIL ' + name);
	}
}

// the vm loader runs main.js, which boots the page itself, so booting again would double every listener
function boot() {
	main.mainFrame(16.7);
	sampleScratch = document.createElement('span');
}

function item(id) {
	return stubs.els['task-list'].children[id];
}

function panel() {
	return stubs.els['quest-panel'];
}

function field(name) {
	return panel().querySelector('[data-field="' + name + '"]');
}

function radio(mode) {
	return stubs.els['preview-mode'].inputs.find(r => r.value === mode);
}

function select(mode) {
	for (const r of stubs.els['preview-mode'].inputs) r.checked = r.value === mode;
	radio(mode).dispatch('change');
}

// the drawing helpers are exercised on a scratch element, never on the live option samples
function previewSampleEl() {
	return sampleScratch;
}

// the field is frozen during a hold, so the fixture can place balls and repaint without them moving
function fixture(placements) {
	sim.simSetSpawnRate(0);
	sim.simInit();
	sim.simBalls.count = 0;
	for (let i = 0; i < placements.length; i++) {
		const p = placements[i];
		sim.simBalls.x[i] = p[0];
		sim.simBalls.y[i] = p[1];
		sim.simBalls.vx[i] = 0;
		sim.simBalls.vy[i] = 0;
		sim.simBalls.r[i] = 14;
		sim.simBalls.palette[i] = p[2];
		sim.simBalls.rgb[i] = 0x445566;
		sim.simBalls.css[i] = '#445566';
	}
	sim.simBalls.count = placements.length;
	sim.simFillDist();
}

const LEFT = 300;
const RIGHT = 900;
const CAT_RED = 2;
const CAT_VIOLET = 7;

boot();

check('list: one item per attached task', stubs.els['task-list'].children.length === tasks.TASK_SLOTS);
check('default: smooth palette is selected and wired', preview.preview.mode === 'smooth'
	&& preview.preview.modeIndex === 2
	&& radio('smooth').checked
	&& stubs.els['preview-mode'].inputs.filter(r => r.checked).length === 1);
check('panel: hidden until an item is held', panel().hidden === true);
check('goal: no goal view before a hold', goal.goalField.on === false && stubs.els['quest-goal'].hidden === true);

const hue = new Uint16Array(6);
check('hues: hot is exactly the warm palette', (() => {
	const n = tasks.tasksCatHues('hot', hue);
	return n === 3 && Array.from(hue.slice(0, n)).join(',') === '0,35,60';
})());
check('hues: cold is exactly the cool palette', (() => {
	const n = tasks.tasksCatHues('cold', hue);
	return n === 3 && Array.from(hue.slice(0, n)).join(',') === '190,225,270';
})());
check('hues: a named color is a single hue', (() => {
	const n = tasks.tasksCatHues('violet', hue);
	return n === 1 && hue[0] === 270;
})());
check('palette: category membership matches the hue list', (() => {
	const warm = [0, 1, 2, 3, 4, 5].filter(p => tasks.tasksCatHas(0, p)).join(',');
	const cool = [0, 1, 2, 3, 4, 5].filter(p => tasks.tasksCatHas(1, p)).join(',');
	const red = [0, 1, 2, 3, 4, 5].filter(p => tasks.tasksCatHas(CAT_RED, p)).join(',');
	return warm === '0,1,2' && cool === '3,4,5' && red === '0'
		&& tasks.tasksCatHas(CAT_VIOLET, 5) === 1;
})());

check('shapes: the three modes are three shapes', preview.PREVIEW_MODES.join(',') === 'mean,range,smooth');
check('labels: the three option labels sit beside their radios', stubs.els['preview-mode'].inputs
	.every((radio, i) => radio.parentNode.children[1] === preview.preview.samples[i]));
check('shapes: mean draws exactly one ball', (() => {
	const el = previewSampleEl();
	preview.previewFill(el, 'preview-sample', hue, 1, 'mean');
	return el.children.length === 1 && el.className === 'preview-sample target target-mean';
})());
check('shapes: range draws a row of balls', (() => {
	const el = previewSampleEl();
	preview.previewFill(el, 'preview-sample', hue, 1, 'range');
	return el.children.length === preview.PREVIEW_RANGE_STEPS && el.className.indexOf('target-range') > 0;
})());
check('shapes: smooth draws one gradient bar', (() => {
	const el = previewSampleEl();
	preview.previewFill(el, 'preview-sample', hue, 1, 'smooth');
	const bg = el.children[0].style.background;
	return el.children.length === 1 && bg.startsWith('linear-gradient') && el.className.indexOf('target-smooth') > 0;
})());
check('shapes: the three modes differ in color count', (() => {
	const counts = ['mean', 'range', 'smooth'].map(mode => {
		const el = previewSampleEl();
		preview.previewFill(el, 'preview-sample', hue, 3, mode);
		return el.children.length;
	});
	return counts[0] === 1 && counts[1] === preview.PREVIEW_RANGE_STEPS && counts[2] === 1;
})());
check('shapes: a single hue still spans its envelope', (() => {
	const el = previewSampleEl();
	preview.previewFill(el, 'preview-sample', hue, 1, 'range');
	const colors = new Set(el.children.map(c => c.style.background));
	return colors.size === el.children.length;
})());
check('shapes: nothing is drawn for an empty target', (() => {
	const el = previewSampleEl();
	preview.previewFill(el, 'preview-sample', hue, 0, 'smooth');
	return el.children.length === 0 && el.className.indexOf('target-empty') > 0;
})());

const sampleEls = preview.preview.samples;
check('samples: every option label previews its own shape', (() => {
	const classes = sampleEls.map(el => el.className);
	return classes.every(c => c.indexOf('target-empty') < 0)
		&& classes[0].indexOf('target-mean') > 0
		&& classes[1].indexOf('target-range') > 0
		&& classes[2].indexOf('target-smooth') > 0;
})());
check('samples: the row counts per option are 1, 5 and 1', sampleEls[0].children.length === 1
	&& sampleEls[1].children.length === preview.PREVIEW_RANGE_STEPS
	&& sampleEls[2].children.length === 1);

check('ramp: two hues interpolate end to end', preview.previewHueAt([190, 270], 2, 0) === 190
	&& preview.previewHueAt([190, 270], 2, 1) === 270
	&& preview.previewHueAt([190, 270], 2, 0.5) === 230);
check('ramp: the mean is circular, not arithmetic', preview.previewMean([350, 10], 2) === 0
	&& preview.previewMean([190, 270], 2) === 230);
check('ramp: the envelope matches the spawn constants',
	apis['color.js'].BALL_SAT_MIN === 0.6 && apis['color.js'].BALL_SAT_MAX === 0.9
	&& apis['color.js'].BALL_LIGHT_MIN === 0.5 && apis['color.js'].BALL_LIGHT_MAX === 0.75);
check('ramp: the range row runs dark to pale across the envelope', (() => {
	const row = [];
	for (let i = 0; i < preview.PREVIEW_RANGE_STEPS; i++) row.push(preview.previewRangeColor(hue, 1, i));
	return new Set(row).size === preview.PREVIEW_RANGE_STEPS;
})());

// the need count must agree with the predicate the objective is evaluated by
// six left (4 red, 2 violet), four right: the red target needs a specific count on a known chamber
fixture([[LEFT, 400, 0], [LEFT, 400, 0], [LEFT, 400, 0], [LEFT, 400, 0], [LEFT, 200, 5],
	[LEFT, 200, 5], [RIGHT, 400, 0], [RIGHT, 200, 5], [RIGHT, 200, 5], [RIGHT, 200, 5]]);
tasks.tasksAssign(0, 'left', 'red', '>', 60, 'immediate');
check('need: greater-than threshold rounds up', tasks.tasksNeed(tasks.tasksView[0]) === 4
	&& tasks.tasksView[0].sideTotal === 6);
tasks.tasksAssign(0, 'left', 'red', '<', 60, 'immediate');
check('need: less-than threshold rounds down', tasks.tasksNeed(tasks.tasksView[0]) === 3);
tasks.tasksAssign(0, 'left', 'red', '>', 70, 'immediate');
const needMid = tasks.tasksNeed(tasks.tasksView[0]);
check('need: is the smallest count the predicate accepts', (() => {
	const v = tasks.tasksView[0];
	return tasks.tasksMeets(needMid, v.sideTotal, 0, v.threshold)
		&& !tasks.tasksMeets(needMid - 1, v.sideTotal, 0, v.threshold);
})());

quest.questPaint();
const held = item(0);
held.dispatch('pointerdown', { pointerId: 1 });
check('hold: pressing an item opens the panel', panel().hidden === false && preview.preview.open === true);
check('hold: panel shows the objective text', field('title').textContent === quest.questObjectiveText(tasks.tasksView[0]));
check('hold: panel names the difficulty and the mode', ['easy', 'normal', 'hard', 'expert']
	.some(label => field('detail').textContent.indexOf(label) === 0));
check('hold: dots show the count the goal needs', field('dots').childElementCount === tasks.tasksNeed(tasks.tasksView[0]));
check('hold: dots show the current count as filled', (() => {
	let on = 0;
	for (const dot of field('dots').children) if (dot.className === 'on') on++;
	return on === Math.min(tasks.tasksView[0].match, tasks.tasksNeed(tasks.tasksView[0]));
})());

// the goal view: the field is replaced by a split that satisfies the held objective
check('goal: holding opens the goal view', goal.goalField.on === true && stubs.els['quest-goal'].hidden === false);
check('goal: the goal layer is the drawn ball layer', goal.goalBallsFor() === goal.goalBalls);
check('goal: the goal layer mirrors the live population', goal.goalBalls.count === sim.simBalls.count);
check('goal: uncharted balls keep their exact field position', (() => {
	for (let i = 0; i < goal.goalBalls.count; i++) {
		if (goal.goalBalls.moved[i]) continue;
		if (goal.goalBalls.x[i] !== sim.simBalls.x[i] || goal.goalBalls.y[i] !== sim.simBalls.y[i]) return false;
	}
	return true;
})());
check('goal: the goal split satisfies its own predicate', (() => {
	const v = tasks.tasksView[0];
	const isLeft = v.side === 'left';
	let side = 0, match = 0;
	const cat = tasks.tasksCatFromName(v.category);
	for (let i = 0; i < goal.goalBalls.count; i++) {
		const left = goal.goalBalls.x[i] < sim.simField.wallX;
		if (left !== isLeft) continue;
		side++;
		if (tasks.tasksCatHas(cat, sim.simBalls.palette[i])) match++;
	}
	return tasks.tasksMeets(match, side, v.cmp === '>' ? 0 : 1, v.threshold);
})());
// a moved ball leaves the chamber it was in; it need not land in the named one, because a crossing can
// be a ball that was in the way leaving as well as a needed ball arriving
check('goal: every moved ball crossed the divider', (() => {
	for (let i = 0; i < goal.goalBalls.count; i++) {
		if (!goal.goalBalls.moved[i]) continue;
		const wasLeft = sim.simBalls.x[i] < sim.simField.wallX;
		const isLeftNow = goal.goalBalls.x[i] < sim.simField.wallX;
		if (wasLeft === isLeftNow) return false;
	}
	return true;
})());
check('goal: moved balls stay inside the field', (() => {
	for (let i = 0; i < goal.goalBalls.count; i++) {
		if (!goal.goalBalls.moved[i]) continue;
		const b = goal.goalBalls;
		if (b.x[i] < sim.simField.wallT || b.x[i] > sim.simField.w - sim.simField.wallT) return false;
		if (b.y[i] < 0 || b.y[i] > sim.simField.h) return false;
	}
	return true;
})());
check('goal: the label states the split and the crossing count', (() => {
	const text = stubs.els['quest-goal'].textContent;
	return text.indexOf('goal ' + goal.goalPlan.match + '/' + goal.goalPlan.side) >= 0
		&& text.indexOf(goal.goalField.moved + ' ball') >= 0;
})());
check('goal: the panel still reports the count it needs', (() => {
	const v = tasks.tasksView[0];
	return tasks.tasksNeed(v) === field('dots').childElementCount;
})());

// the canvas must draw the goal layer, not the live one, and mark crossings
check('render: the goal layer reaches the canvas', (() => {
	const cv = apis['canvas.js'];
	stubs.ctx2d.calls.length = 0;
	cv.canvasDraw(0);
	let dim = 0, solid = 0, rings = 0;
	for (const call of stubs.ctx2d.calls) {
		if (call.method === 'arc') {
			if (call.globalAlpha === cv.GOAL_DIM_ALPHA) dim++;
			else if (call.globalAlpha === 1) solid++;
		}
		if (call.method === 'stroke') rings++;
	}
	return dim > 0 && solid === goal.goalField.moved && rings === goal.goalField.moved;
})());
check('render: the live field draws no rings and no dimming', (() => {
	const cv = apis['canvas.js'];
	goal.goalClose();
	stubs.ctx2d.calls.length = 0;
	cv.canvasDraw(0);
	let dim = 0, rings = 0;
	for (const call of stubs.ctx2d.calls) {
		if (call.method === 'arc' && call.globalAlpha === cv.GOAL_DIM_ALPHA) dim++;
		if (call.method === 'stroke') rings++;
	}
	return dim === 0 && rings === 0;
})());

// the plan the view draws is the plan the difficulty prices
check('goal: drawn crossings equal the difficulty cost', (() => {
	const v = tasks.tasksView[0];
	return goal.goalField.moved === tasks.tasksCost(tasks.tasksCatFromName(v.category),
		v.cmp === '>' ? 0 : 1, v.threshold, v.side === 'left');
})());

// a goal that needs a very rare color on the named side still resolves, or says why it cannot
fixture([[LEFT, 400, 0], [LEFT, 400, 0], [LEFT, 400, 1], [LEFT, 400, 2], [RIGHT, 400, 0],
	[RIGHT, 400, 1], [RIGHT, 400, 2], [RIGHT, 400, 3], [RIGHT, 400, 4], [RIGHT, 400, 5],
	[RIGHT, 400, 5], [RIGHT, 400, 4], [RIGHT, 400, 3], [RIGHT, 400, 2]]);
tasks.tasksAssign(0, 'left', 'violet', '>', 40, 'immediate');
goal.goalOpen(0);
check('goal: a rare named color resolves into the named chamber', (() => {
	let violetLeft = 0;
	for (let i = 0; i < goal.goalBalls.count; i++) {
		if (goal.goalBalls.x[i] >= sim.simField.wallX) continue;
		if (sim.simBalls.palette[i] === 5) violetLeft++;
	}
	return goal.goalBallsFor() === goal.goalBalls
		&& violetLeft >= tasks.tasksNeed(tasks.tasksView[0]);
})());

quest.questPaint();
select('mean');
check('hold: switching mode repaints the open panel', panel().firstElementChild.className.indexOf('target-mean') > 0
	&& panel().firstElementChild.children.length === 1);
select('range');
check('hold: the panel follows the range shape', panel().firstElementChild.children.length === preview.PREVIEW_RANGE_STEPS);
select('smooth');
check('hold: the panel follows the smooth shape', panel().firstElementChild.className.indexOf('target-smooth') > 0);

held.dispatch('pointerup', { pointerId: 1 });
check('hold: release closes the panel', panel().hidden === true && preview.preview.open === false);
check('hold: release closes the goal view', goal.goalField.on === false && stubs.els['quest-goal'].hidden === true);
check('hold: the live field is drawn again', goal.goalBallsFor() === null);

held.dispatch('pointerdown', { pointerId: 1 });
held.dispatch('pointercancel', { pointerId: 1 });
check('hold: pointer cancellation closes the panel', panel().hidden === true && goal.goalField.on === false);

held.dispatch('keydown', { code: 'Space' });
check('hold: keyboard opens the panel', panel().hidden === false && goal.goalField.on === true);
held.dispatch('keyup', { code: 'Space' });
check('hold: keyboard release closes the panel', panel().hidden === true && goal.goalField.on === false);
held.dispatch('keydown', { code: 'KeyA' });
check('hold: other keys do not open the panel', panel().hidden === true);

held.dispatch('pointerdown', { pointerId: 1 });
held.dispatch('blur');
check('hold: focus loss closes the panel', panel().hidden === true && goal.goalField.on === false);

check('list: items keep the objective words', item(0).children[1].children[0].textContent
	=== quest.questObjectiveText(tasks.tasksView[0]));

// the frame keeps the field still while a goal is shown, so the picture cannot drift from the plan
fixture([[LEFT, 400, 0], [RIGHT, 400, 5], [LEFT, 300, 0], [RIGHT, 300, 5]]);
quest.questPaint();
const still = item(1);
still.dispatch('pointerdown', { pointerId: 1 });
const frozenX = sim.simBalls.x[0];
main.mainFrame(1000);
main.mainFrame(2000);
check('frame: the field does not advance while a goal is shown', sim.simBalls.x[0] === frozenX);
still.dispatch('pointerup', { pointerId: 1 });

console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;

