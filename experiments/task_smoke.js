// owns: plan 0.2/0.4/1.1 smoke for distribution, tasks, difficulty, participants, quest list
// edit for: predicate, lifecycle, difficulty, list item, and waiting checks

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const tasks = apis['tasks.js'];
const tcost = apis['taskcost.js'];
const quest = apis['quest.js'];
const players = apis['players.js'];

let pass = 0;
let fail = 0;

function check(name, ok) {
	if (ok) pass++;
	else {
		fail++;
		console.log('FAIL ' + name);
	}
}

function reset() {
	sim.simSetSpawnRate(0);
	sim.simInit();
	sim.simBalls.count = 0;
	sim.simFillDist();
	players.playersInit();
	tasks.tasksInit();
	tasks.tasksSetRand(Math.random);
}

// the quest list items are built lazily on the first paint; helpers keep the checks readable
function questItems() {
	quest.questPaint();
	return stubs.els['task-list'].children;
}

// the side arrow is its own element so the card can draw it large; the line reads arrow then words
function questText(id) {
	const items = questItems();
	if (!items[id]) return '';
	const head = items[id].children[0];
	return head.children[1].textContent + ' ' + head.children[2].textContent;
}

function questArrow(id) {
	const items = questItems();
	return items[id] ? items[id].children[0].children[1] : null;
}

function questMeta(id) {
	const items = questItems();
	return items[id] ? items[id].children[2].textContent : '';
}

function questBar(id) {
	const items = questItems();
	return items[id] ? items[id].children[1].children[0] : null;
}

function place(i, x, palette) {
	sim.simBalls.x[i] = x;
	sim.simBalls.y[i] = 400;
	sim.simBalls.vx[i] = 0;
	sim.simBalls.vy[i] = 0;
	sim.simBalls.r[i] = 12;
	sim.simBalls.palette[i] = palette;
	sim.simBalls.rgb[i] = 0;
	sim.simBalls.css[i] = '#000000';
	if (sim.simBalls.count <= i) sim.simBalls.count = i + 1;
}

// fills from index 2 up to count 14 so generation has a population above the difficulty floor
function fillBalls(x, count) {
	for (let i = 2; i < count; i++) place(i, x, i % 2 ? 5 : 0);
}

const LEFT = 300;
const RIGHT = 900;
const DT = sim.FIXED_DT;
const CAT_HOT = 0;
const CAT_COLD = 1;
const CAT_RED = 2;
const CAT_BLUE = 6;
const CMP_GT = 0;
const CMP_LT = 1;

reset();
place(0, LEFT, 0);
place(1, LEFT, 0);
place(2, LEFT, 5);
place(3, RIGHT, 0);
place(4, RIGHT, 5);
sim.simFillDist();
check('dist: side totals from center', sim.simDist.left === 3 && sim.simDist.right === 2 && sim.simDist.total === 5);
check('dist: red left/right', sim.simDist.leftPalette[0] === 2 && sim.simDist.rightPalette[0] === 1);
check('dist: hot/cold split', sim.simDist.leftHot === 2 && sim.simDist.leftCold === 1 && sim.simDist.rightHot === 1 && sim.simDist.rightCold === 1);
check('side denominator: left red 2/3', tasks.tasksCatSide(CAT_RED, true) === 2 && sim.simDist.left === 3);
check('side denominator: right red 1/2', tasks.tasksCatSide(CAT_RED, false) === 1 && sim.simDist.right === 2);

check('strict: 1/2 is not >50', !tasks.tasksMeets(1, 2, CMP_GT, 50));
check('strict: 1/2 is not <50', !tasks.tasksMeets(1, 2, CMP_LT, 50));
check('strict: 2/3 is >50', tasks.tasksMeets(2, 3, CMP_GT, 50));
check('strict: 1/3 is <50', tasks.tasksMeets(1, 3, CMP_LT, 50));
check('empty side never meets > or <', !tasks.tasksMeets(0, 0, CMP_GT, 50) && !tasks.tasksMeets(0, 0, CMP_LT, 50));

reset();
place(0, LEFT, 4);
place(1, LEFT, 4);
place(2, LEFT, 4);
sim.simFillDist();
check('absent: >50% red is infeasible', !tcost.tasksFeasible(CAT_RED, CMP_GT, 50));
check('absent: <50% red is feasible', tcost.tasksFeasible(CAT_RED, CMP_LT, 50));
check('absent: >50% hot is infeasible', !tcost.tasksFeasible(CAT_HOT, CMP_GT, 50));
check('absent: <50% hot is feasible', tcost.tasksFeasible(CAT_HOT, CMP_LT, 50));

reset();
place(0, LEFT, 0);
place(1, LEFT, 1);
place(2, LEFT, 2);
sim.simFillDist();
check('all-hot: <50% hot is infeasible', !tcost.tasksFeasible(CAT_HOT, CMP_LT, 50));
check('all-hot: >50% hot is feasible', tcost.tasksFeasible(CAT_HOT, CMP_GT, 50));
check('all-hot: >50% cold is infeasible', !tcost.tasksFeasible(CAT_COLD, CMP_GT, 50));

reset();
place(0, LEFT, 0);
place(1, LEFT, 5);
sim.simFillDist();
check('discrete: 1 red of 2 can still exceed 50 by isolating it', tcost.tasksFeasible(CAT_RED, CMP_GT, 50));
check('discrete: 1/2 does not already meet >50', !tasks.tasksMeets(1, 2, CMP_GT, 50));

reset();
check('wait: empty population has no candidate', !tcost.tasksFeasible(CAT_HOT, CMP_GT, 50));
tasks.tasksAttach(0);
check('wait: attach on empty enters waiting', tasks.tasksView[0].waiting === true);
const genWait = tasks.tasksGenCount();
const revWait = sim.simDist.rev;
tasks.tasksStep(DT);
check('wait: same rev does not retry', tasks.tasksGenCount() === genWait && sim.simDist.rev === revWait && tasks.tasksView[0].waiting);
place(0, LEFT, 0);
place(1, RIGHT, 5);
fillBalls(LEFT, 12);
sim.simFillDist();
check('wait: population change bumps rev', sim.simDist.rev !== revWait);
tasks.tasksStep(DT);
check('wait: retry assigns a feasible unsatisfied task', tasks.tasksView[0].waiting === false && tasks.tasksGenCount() === genWait + 1);
check('wait: assigned task is not already met', tasks.tasksView[0].satisfied === false);

reset();
place(0, LEFT, 0);
place(1, LEFT, 5);
place(2, RIGHT, 0);
sim.simFillDist();
tasks.tasksAssign(0, 'left', 'hot', '>', 50, 'immediate');
check('assign: 1/2 hot is not >50', tasks.tasksView[0].satisfied === false && tasks.tasksView[0].match === 1 && tasks.tasksView[0].sideTotal === 2);
const gen0 = tasks.tasksGenCount();
tasks.tasksStep(DT);
check('immediate: unsatisfied does not complete', tasks.tasksGenCount() === gen0 && tasks.tasksView[0].category === 'hot');
sim.simBalls.x[1] = RIGHT;
sim.simFillDist();
tasks.tasksStep(DT);
check('immediate: first satisfying step replaces the task', tasks.tasksGenCount() === gen0 + 1);
check('immediate: replacement is not evaluated this step', tasks.tasksView[0].waiting || tasks.tasksView[0].satisfied === false);

reset();
place(0, LEFT, 0);
place(1, RIGHT, 5);
sim.simFillDist();
tasks.tasksAssign(0, 'left', 'hot', '>', 30, 'hold');
check('hold: currently satisfied 1/1 >30', tasks.tasksView[0].satisfied);
const holdGen = tasks.tasksGenCount();
const holdSteps = Math.round(tasks.TASK_HOLD_SEC / DT);
for (let k = 0; k < holdSteps - 1; k++) tasks.tasksStep(DT);
check('hold: still active just under two seconds', tasks.tasksGenCount() === holdGen && tasks.tasksHold[0] < tasks.TASK_HOLD_SEC);
tasks.tasksStep(DT);
check('hold: completes at two seconds', tasks.tasksGenCount() === holdGen + 1);

// a whole-canvas objective is read against every ball of the category, not the chamber: three of
// four violet on the left is 75% of them all but only 21% of that chamber's fourteen balls
function violetField() {
	reset();
	place(0, LEFT, 5);
	place(1, LEFT, 5);
	place(2, LEFT, 5);
	place(3, RIGHT, 5);
	for (let i = 4; i < 14; i++) place(i, LEFT, 0);
	sim.simFillDist();
}
violetField();
tasks.tasksAssign(0, 'left', 'violet', '>', 70, 'immediate', 'total');
const genTotal = tasks.tasksGenCount();
check('measure total: the category is the denominator', tasks.tasksView[0].denom === 4 && tasks.tasksView[0].satisfied);
tasks.tasksStep(DT);
check('measure total: a met whole-canvas split scores', tasks.tasksGenCount() === genTotal + 1);
violetField();
tasks.tasksAssign(0, 'left', 'violet', '>', 70, 'immediate', 'side');
check('measure total: the same split read against the chamber is not met', !tasks.tasksView[0].satisfied);
const genSide = tasks.tasksGenCount();
tasks.tasksStep(DT);
check('measure total: and a chamber reading does not score', tasks.tasksGenCount() === genSide);
tasks.tasksAssign(0, 'left', 'violet', '>', 70, 'hold', 'total');
for (let k = 0; k < 60; k++) tasks.tasksStep(DT);
check('measure total: the hold accumulates on the category share', tasks.tasksHold[0] > 0.4);

reset();
place(0, LEFT, 0);
place(1, RIGHT, 5);
sim.simFillDist();
tasks.tasksAssign(0, 'left', 'hot', '>', 30, 'hold');
for (let k = 0; k < 60; k++) tasks.tasksStep(DT);
check('hold: accumulated while satisfied', tasks.tasksHold[0] > 0);
sim.simBalls.x[0] = RIGHT;
sim.simFillDist();
tasks.tasksStep(DT);
check('hold: resets when unsatisfied', tasks.tasksHold[0] === 0 && tasks.tasksGenCount() === 0);

reset();
place(0, LEFT, 0);
sim.simFillDist();
tasks.tasksAssign(0, 'right', 'hot', '>', 30, 'hold');
tasks.tasksHold[0] = 1;
tasks.tasksStep(DT);
check('hold: empty side resets and never completes', tasks.tasksHold[0] === 0 && tasks.tasksView[0].side === 'right' && tasks.tasksView[0].mode === 'hold');

reset();
place(0, LEFT, 0);
place(1, RIGHT, 5);
sim.simFillDist();
tasks.tasksAssign(0, 'left', 'hot', '>', 30, 'immediate');
tasks.tasksAssign(1, 'right', 'cold', '>', 30, 'hold');
const gBoth = tasks.tasksGenCount();
tasks.tasksStep(DT);
check('two ids: immediate completes independently', tasks.tasksGenCount() === gBoth + 1);
check('two ids: hold participant still holding', tasks.tasksView[1].mode === 'hold' && tasks.tasksView[1].category === 'cold' && tasks.tasksHold[1] > 0);

reset();
players.playersInit();
check('players: one human at boot', players.players.count === 1 && players.players.type[0] === players.PLAYER_HUMAN);
const id1 = players.playersAdd(players.PLAYER_BOT);
check('players: second id is stable and distinct', id1 === 1 && players.players.count === 2 && players.players.type[1] === players.PLAYER_BOT);
check('players: cap stops a third', players.playersAdd(players.PLAYER_HUMAN) === -1 && players.players.count === 2);

reset();
place(0, LEFT, 0);
place(1, RIGHT, 5);
sim.simFillDist();
tasks.tasksAssign(0, 'left', 'red', '<', 40, 'immediate');
quest.questPaint();
check('quest item: the side arrow is a dedicated large glyph',
	questArrow(0).className === 'quest-arrow' && questArrow(0).textContent === '←');
check('quest item: shows side cmp threshold category and counts',
	questText(0).indexOf('←') !== -1
	&& questText(0).indexOf('<40%') !== -1
	&& questText(0).indexOf('red') !== -1
	&& questText(0).indexOf('1/1') !== -1);


reset();
place(0, LEFT, 0);
place(1, LEFT, 0);
place(2, LEFT, 0);
sim.simFillDist();
check('cost: a met objective costs nothing', tcost.tasksCost(CAT_RED, CMP_GT, 50, true) === 0);
check('cost: red <50% of an all red left is unreachable', tcost.tasksCost(CAT_RED, CMP_LT, 50, true) === -1);
check('cost: absent category with > is unreachable', tcost.tasksCost(CAT_BLUE, CMP_GT, 50, true) === -1);
check('cost: absent category with < is already met', tcost.tasksCost(CAT_BLUE, CMP_LT, 50, true) === 0);

reset();
fillBalls(LEFT, 14);
place(0, RIGHT, 0);
place(1, RIGHT, 0);
sim.simFillDist();
check('band: floor rejects a one ball task', !tcost.tasksInBand(1, 1, 0, 0) && !tcost.tasksInBand(2, 2, 0, 0));
check('band: cheapest playable label is easy', tcost.tasksInBand(tcost.TASK_COST_MIN, tcost.TASK_COST_MIN, 0, 0)
	&& tcost.tasksBand(tcost.TASK_COST_MIN) === 0);
check('band: the whole-canvas immediate form needs one more crossing',
	!tcost.tasksInBand(tcost.TASK_COST_MIN, tcost.TASK_COST_MIN, 1, 0)
	&& tcost.tasksInBand(tcost.TASK_COST_MIN + 1, tcost.TASK_COST_MIN + 1, 1, 0));
check('band: cap follows the live population', tcost.tasksCostMax() === Math.min(27, (sim.simDist.total * 0.75) | 0));
check('band: above the cap is rejected', !tcost.tasksInBand(tcost.tasksCostMax() + 1, 0, 0, 0));
check('band: a scarce job is rejected even inside the crossing cap',
	!tcost.tasksInBand(tcost.TASK_COST_MIN, tcost.tasksDemandMax() + 1, 0, 0));

reset();
// the prompt case: 2 violet of 14 whole canvas, left holds 1 of them beside 11 reds, so 60% of
// left being violet needs every red shipped out and the far violet shipped in
place(0, LEFT, 5);
place(1, RIGHT, 5);
for (let i = 2; i < 14; i++) place(i, LEFT, 0);
sim.simFillDist();
const rareCost = tcost.tasksCost(tasks.tasksCatFromName('violet'), CMP_GT, 60, true);
const commonCost = tcost.tasksCost(tasks.tasksCatFromName('red'), CMP_GT, 60, false);
check('rare category: 60% violet costs every other ball', rareCost >= 11);
check('rare category: the common category that is already ahead is cheaper', commonCost < rareCost);
check('rare category: the expensive target still gets a label', tcost.tasksBand(rareCost) >= 0);
// the draft case: a share of a chamber that only two balls can ever fill is a long job, and the
// crossing count alone would not say so
const scarceDemand = tcost.tasksDemand(tasks.tasksCatFromName('violet'), CMP_GT, 60, true, 0);
check('rare category: the demand prices the scarcity the crossings miss', scarceDemand > 0);

reset();
fillBalls(LEFT, 14);
sim.simFillDist();
const seen = {};
for (let k = 0; k < 40; k++) {
	tasks.tasksInit();
	tasks.tasksAttach(0);
	const v = tasks.tasksView[0];
	if (v.waiting) continue;
	seen[v.difficulty] = 1;
	if (!tcost.tasksInBand(v.cost, v.demand, v.measure === 'total' ? 1 : 0, v.mode === 'hold' ? 1 : 0)) {
		check('assign: every generated task is in band', false);
	}
	if (v.satisfied) check('assign: no generated task is already met', false);
	if (!tasks.TASK_LABEL_NAME.includes(v.difficulty)) check('assign: difficulty is a known label', false);
}
check('assign: generation labels tasks', Object.keys(seen).length > 0);

reset();
place(0, LEFT, 0);
place(1, RIGHT, 5);
sim.simFillDist();
tasks.tasksAssign(0, 'left', 'red', '<', 40, 'immediate');
quest.questPaint();
check('quest item: shows the difficulty label', ['easy', 'normal', 'hard', 'expert'].includes(questMeta(0).split(' ')[0]));

reset();
// left holds two blues, right a red and two yellows: one red in and one blue out is the priced walk
place(0, LEFT, 4);
place(1, LEFT, 4);
place(2, RIGHT, 0);
place(3, RIGHT, 2);
place(4, RIGHT, 2);
sim.simFillDist();
tasks.tasksAssign(0, 'left', 'red', '>', 50, 'immediate');
quest.questPaint();
check('quest bar: starts at zero progress', questBar(0).style.width === '0%' && tasks.tasksView[0].cost === 3);
sim.simBalls.x[2] = LEFT;
sim.simFillDist();
quest.questPaint();
check('quest bar: crossing work moves the bar', questBar(0).style.width === '33%', questBar(0).style.width);
// the priced walk finishes: the red arrives and both blues leave, so the chamber is all red
sim.simBalls.x[0] = RIGHT;
sim.simBalls.x[1] = RIGHT;
sim.simBalls.x[2] = LEFT;
sim.simFillDist();
quest.questPaint();
check('quest bar: a met objective fills the bar', tasks.tasksView[0].satisfied
	&& questBar(0).style.width === '100%'
	&& stubs.els['task-list'].children[0].getAttribute('data-done') === 'true');

// Exercise the generator rather than just manual assignments for both grammars and comparators.
reset();
for (let i = 0; i < 24; i++) place(i, i % 4 < 2 ? LEFT : RIGHT, i % 6);
sim.simFillDist();
let seed = 12345;
tasks.tasksSetRand(() => {
	seed = (seed * 1664525 + 1013904223) >>> 0;
	return seed / 4294967296;
});
const generated = { side: 0, total: 0, gt: 0, lt: 0, invalid: 0 };
for (let i = 0; i < 100; i++) {
	tasks.tasksAttach(0);
	const v = tasks.tasksView[0];
	if (v.waiting || v.satisfied || !tcost.tasksInBand(v.cost, v.demand,
		v.measure === 'total' ? 1 : 0, v.mode === 'hold' ? 1 : 0)) generated.invalid++;
	else {
		generated[v.measure]++;
		generated[v.cmp === '>' ? 'gt' : 'lt']++;
	}
}
check('generation: both denominators and comparators are offered',
	generated.side > 0 && generated.total > 0 && generated.gt > 0 && generated.lt > 0);
check('generation: no already-satisfied, infeasible or out-of-band tasks', generated.invalid === 0);

// Exhaust the small count space against the actual predicate, including empty chambers and categories.
let costMismatch = 0;
for (let n = 0; n <= 7; n++) {
	for (let cat = 0; cat <= n; cat++) {
		for (let side = 0; side <= n; side++) {
			for (let match = Math.max(0, cat - (n - side)); match <= Math.min(cat, side); match++) {
				for (let measure = 0; measure <= 1; measure++) {
					for (let cmp = 0; cmp <= 1; cmp++) {
						for (const threshold of [10, 50, 90]) {
							let expected = -1;
							for (let goalSide = 0; goalSide <= n; goalSide++) {
								for (let goalMatch = Math.max(0, cat - (n - goalSide)); goalMatch <= Math.min(cat, goalSide); goalMatch++) {
									if (!tasks.tasksMeets(goalMatch, measure ? cat : goalSide, cmp, threshold)) continue;
									const cost = Math.abs(goalMatch - match) + Math.abs((goalSide - goalMatch) - (side - match));
									if (expected < 0 || cost < expected) expected = cost;
								}
							}
							if (tcost.tasksCostFrom(0, cmp, threshold, side, match, n, cat, measure, null) !== expected) costMismatch++;
						}
					}
				}
			}
		}
	}
}
check('cost: both measures agree with the predicate for every small split', costMismatch === 0);
reset();
place(0, RIGHT, 0);
place(1, RIGHT, 5);
sim.simFillDist();
tasks.tasksAssign(0, 'left', 'red', '<', 50, 'hold', 'total');
check('cost: empty side can satisfy a whole-category task', tasks.tasksView[0].satisfied
	&& tasks.tasksView[0].cost === 0 && tcost.tasksCost(CAT_RED, CMP_LT, 50, true, 1) === 0);
check('cost: an absent category never satisfies a whole-category task',
	tcost.tasksCost(CAT_BLUE, CMP_LT, 50, true, 1) === -1
	&& tcost.tasksCost(CAT_BLUE, CMP_GT, 50, true, 1) === -1);
reset();
place(0, LEFT, 0);
place(1, RIGHT, 0);
sim.simFillDist();
check('cost: removing the last matching ball can complete a whole-category task',
	tcost.tasksCost(CAT_RED, CMP_LT, 50, true, 1) === 1
	&& tcost.tasksCrossValue(CAT_RED, CMP_LT, 50, true, 1, 1, 0) === 1);


console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
