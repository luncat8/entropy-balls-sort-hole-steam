// owns: plan 0.2/0.4/1.1 smoke for distribution, tasks, difficulty, participants, quest list
// edit for: predicate, lifecycle, difficulty, list item, and waiting checks

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const tasks = apis['tasks.js'];
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

function questText(id) {
	const items = questItems();
	return items[id] ? items[id].children[1].children[0].textContent : '';
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
check('absent: >50% red is infeasible', !tasks.tasksFeasible(CAT_RED, CMP_GT, 50));
check('absent: <50% red is feasible', tasks.tasksFeasible(CAT_RED, CMP_LT, 50));
check('absent: >50% hot is infeasible', !tasks.tasksFeasible(CAT_HOT, CMP_GT, 50));
check('absent: <50% hot is feasible', tasks.tasksFeasible(CAT_HOT, CMP_LT, 50));

reset();
place(0, LEFT, 0);
place(1, LEFT, 1);
place(2, LEFT, 2);
sim.simFillDist();
check('all-hot: <50% hot is infeasible', !tasks.tasksFeasible(CAT_HOT, CMP_LT, 50));
check('all-hot: >50% hot is feasible', tasks.tasksFeasible(CAT_HOT, CMP_GT, 50));
check('all-hot: >50% cold is infeasible', !tasks.tasksFeasible(CAT_COLD, CMP_GT, 50));

reset();
place(0, LEFT, 0);
place(1, LEFT, 5);
sim.simFillDist();
check('discrete: 1 red of 2 can still exceed 50 by isolating it', tasks.tasksFeasible(CAT_RED, CMP_GT, 50));
check('discrete: 1/2 does not already meet >50', !tasks.tasksMeets(1, 2, CMP_GT, 50));

reset();
check('wait: empty population has no candidate', !tasks.tasksFeasible(CAT_HOT, CMP_GT, 50));
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
check('quest item: shows side cmp threshold category and counts',
	questText(0).indexOf('left') !== -1
	&& questText(0).indexOf('<40%') !== -1
	&& questText(0).indexOf('red') !== -1
	&& questText(0).indexOf('1/1') !== -1);


reset();
place(0, LEFT, 0);
place(1, LEFT, 0);
place(2, LEFT, 0);
sim.simFillDist();
check('cost: a met objective costs nothing', tasks.tasksCost(CAT_RED, CMP_GT, 50, true) === 0);
check('cost: red <50% of an all red left is unreachable', tasks.tasksCost(CAT_RED, CMP_LT, 50, true) === -1);
check('cost: absent category with > is unreachable', tasks.tasksCost(CAT_BLUE, CMP_GT, 50, true) === -1);
check('cost: absent category with < is already met', tasks.tasksCost(CAT_BLUE, CMP_LT, 50, true) === 0);

reset();
fillBalls(LEFT, 14);
place(0, RIGHT, 0);
place(1, RIGHT, 0);
sim.simFillDist();
check('band: floor rejects a one ball task', !tasks.tasksInBand(1) && !tasks.tasksInBand(2));
check('band: cheapest playable label is easy', tasks.tasksInBand(tasks.TASK_COST_MIN) && tasks.tasksBand(tasks.TASK_COST_MIN) === 0);
check('band: cap follows the live population', tasks.tasksCostMax() === Math.min(27, (sim.simDist.total * 0.75) | 0));
check('band: above the cap is rejected', !tasks.tasksInBand(tasks.tasksCostMax() + 1));

reset();
// the prompt case: 2 violet of 14 whole canvas, left holds 1 of them beside 11 reds, so 60% of
// left being violet needs every red shipped out and the far violet shipped in
place(0, LEFT, 5);
place(1, RIGHT, 5);
for (let i = 2; i < 14; i++) place(i, LEFT, 0);
sim.simFillDist();
const rareCost = tasks.tasksCost(tasks.tasksCatFromName('violet'), CMP_GT, 60, true);
const commonCost = tasks.tasksCost(tasks.tasksCatFromName('red'), CMP_GT, 60, false);
check('rare category: 60% violet costs every other ball', rareCost >= 11);
check('rare category: the common category that is already ahead is cheaper', commonCost < rareCost);
check('rare category: the expensive target still gets a label', tasks.tasksBand(rareCost) >= 0);

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
	if (!tasks.tasksInBand(v.cost)) check('assign: every generated task is in band', false);
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
check('quest item: shows the difficulty label', ['easy', 'normal', 'hard', 'expert'].includes(stubs.els['task-list'].children[0].children[1].children[1].textContent.split(' ')[0]));

console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
