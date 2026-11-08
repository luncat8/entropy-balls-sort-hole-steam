// owns: plan 1.1 smoke for target appearance modes and the hold preview panel
// edit for: mode coverage, sample checks, hold lifecycle

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const tasks = apis['tasks.js'];
const quest = apis['quest.js'];
const preview = apis['preview.js'];
const main = apis['main.js'];

let pass = 0;
let fail = 0;

function check(name, ok) {
	if (ok) pass++;
	else {
		fail++;
		console.log('FAIL ' + name);
	}
}

function boot() {
	main.mainBoot();
	main.mainFrame(16.7);
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

boot();

check('list: one item per attached task', stubs.els['task-list'].children.length === tasks.TASK_SLOTS);
check('default: smooth palette is selected and wired', preview.preview.mode === 'smooth'
	&& preview.preview.modeIndex === 2
	&& radio('smooth').checked
	&& [...stubs.els['preview-mode'].inputs].filter(r => r.checked).length === 1);
check('panel: hidden until an item is held', panel().hidden === true);

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

check('modes: the three representations differ', (() => {
	const modes = preview.PREVIEW_MODES.map(m => preview.previewRange(hue, 1, m));
	return new Set(modes).size === 3;
})());
check('modes: mean is one flat color', /^#[0-9a-f]{6}$/.test(preview.previewRange(hue, 1, 'mean')));
check('modes: range and smooth are gradients', (() => {
	const r = preview.previewRange(hue, 3, 'range');
	const s = preview.previewRange(hue, 3, 'smooth');
	return r.startsWith('linear-gradient') && s.startsWith('linear-gradient') && r !== s;
})());
check('modes: a single hue still spans its envelope', (() => {
	const stops = preview.previewRange(hue, 1, 'smooth').split(',').length;
	const unique = new Set(preview.previewRange(hue, 1, 'smooth').split(','));
	return stops > 2 && unique.size > 2;
})());

// the ramp itself: hue order, circular neighbours, and the envelope ends
check('ramp: two hues interpolate end to end', preview.previewHueAt([190, 270], 2, 0) === 190
	&& preview.previewHueAt([190, 270], 2, 1) === 270
	&& preview.previewHueAt([190, 270], 2, 0.5) === 230);
check('ramp: the mean is circular, not arithmetic', preview.previewMean([350, 10], 2) === 0
	&& preview.previewMean([190, 270], 2) === 230);
check('ramp: the envelope matches the spawn constants',
	apis['color.js'].BALL_SAT_MIN === 0.6 && apis['color.js'].BALL_SAT_MAX === 0.9
	&& apis['color.js'].BALL_LIGHT_MIN === 0.5 && apis['color.js'].BALL_LIGHT_MAX === 0.75);

check('samples: every option label previews its own representation', (() => {
	const seen = stubs.els['preview-mode'].inputs.map(r => r.parentNode.style['--sample']);
	return seen.every(s => s && s !== 'transparent') && new Set(seen).size === 3;
})());

// the need count must agree with the predicate the objective is evaluated by
sim.simSetSpawnRate(0);
sim.simInit();
sim.simBalls.count = 0;
for (let i = 0; i < 10; i++) {
	sim.simBalls.x[i] = i < 4 ? 300 : 900;
	sim.simBalls.y[i] = 400;
	sim.simBalls.r[i] = 12;
	sim.simBalls.palette[i] = i < 2 ? 0 : 5;
	sim.simBalls.css[i] = '#000000';
}
sim.simBalls.count = 10;
sim.simFillDist();
tasks.tasksAssign(0, 'left', 'red', '>', 60, 'immediate');
check('need: greater-than threshold rounds up', tasks.tasksNeed(tasks.tasksView[0]) === 3
	&& tasks.tasksView[0].sideTotal === 4);
tasks.tasksAssign(0, 'left', 'red', '<', 60, 'immediate');
check('need: less-than threshold rounds down', tasks.tasksNeed(tasks.tasksView[0]) === 2);
tasks.tasksAssign(0, 'left', 'red', '>', 50, 'immediate');
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
check('hold: panel names the difficulty and the need', field('detail').textContent.indexOf('hard') === 0
	|| field('detail').textContent.indexOf('expert') === 0
	|| field('detail').textContent.indexOf('normal') === 0
	|| field('detail').textContent.indexOf('easy') === 0);
check('hold: dots show the count the goal needs', field('dots').childElementCount === tasks.tasksNeed(tasks.tasksView[0]));
check('hold: dots show the current count as filled', (() => {
	let on = 0;
	for (const dot of field('dots').children) if (dot.className === 'on') on++;
	return on === Math.min(tasks.tasksView[0].match, tasks.tasksNeed(tasks.tasksView[0]));
})());

select('mean');
check('hold: switching mode repaints the open panel', panel().firstElementChild.style.background
	=== preview.previewRange((() => { const h = new Uint16Array(6); const n = tasks.tasksCatHues('red', h); return h; })(), 1, 'mean'));

held.dispatch('pointerup', { pointerId: 1 });
check('hold: release closes the panel', panel().hidden === true && preview.preview.open === false);

held.dispatch('pointerdown', { pointerId: 1 });
held.dispatch('pointercancel', { pointerId: 1 });
check('hold: pointer cancellation closes the panel', panel().hidden === true);

held.dispatch('keydown', { code: 'Space' });
check('hold: keyboard opens the panel', panel().hidden === false);
held.dispatch('keyup', { code: 'Space' });
check('hold: keyboard release closes the panel', panel().hidden === true);
held.dispatch('keydown', { code: 'KeyA' });
check('hold: other keys do not open the panel', panel().hidden === true);

held.dispatch('pointerdown', { pointerId: 1 });
held.dispatch('blur');
check('hold: focus loss closes the panel', panel().hidden === true);

check('list: items keep the objective words', item(0).children[1].children[0].textContent
	=== quest.questObjectiveText(tasks.tasksView[0]));

console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
