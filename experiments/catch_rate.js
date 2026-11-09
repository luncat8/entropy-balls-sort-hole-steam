// owns: catch ledger — how many valuable crossings happen and how many the aperture was at
// edit for: seeds, run length, catch tolerance

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const roster = apis['players.js'];
const force = apis['force.js'];
const tasks = apis['tasks.js'];
const bot = apis['bot.js'];

let x = Number(process.argv[2] || 3);
ctx.Math.random = () => {
	x = (x * 1664525 + 1013904223) >>> 0;
	return x / 4294967296;
};
const SECONDS = Number(process.argv[3] || 90);
const DT = sim.FIXED_DT;

sim.simSetSpawnRate(1.6666666666666667);
sim.simInit();
force.forceSetCapacity(force.FORCE_CAPACITY);
force.forceSetCost(force.FORCE_COST);
roster.playersInit(1, 1);
force.forceInit();
bot.botInit();
tasks.tasksInit();
tasks.tasksSetRand(ctx.Math.random);
tasks.tasksAttach(0);

const b = sim.simBalls;
const side = new Uint8Array(sim.BALL_CAP);
const cost = new Float32Array(2);
for (let i = 0; i < b.count; i++) side[i] = b.x[i] < sim.simField.wallX ? 1 : 0;

function taskCost() {
	const v = tasks.tasksView[0];
	if (v.waiting) return -1;
	const cat = tasks.tasksCatFromName(v.category);
	return apis['taskcost.js'].tasksCost(cat, v.cmp === '>' ? 0 : 1, v.threshold, v.side === 'left', v.measure === 'total' ? 1 : 0);
}

let valuable = 0;
let caught = 0;
let neutral = 0;
let harmful = 0;
let stepCrossings = 0;
let multi = 0;
for (let s = 0; s < SECONDS / DT; s++) {
	cost[0] = taskCost();
	sim.simStep(DT);
	const now = taskCost();
	let n = 0;
	for (let i = 0; i < b.count; i++) {
		const nowLeft = b.x[i] < sim.simField.wallX ? 1 : 0;
		if (nowLeft === side[i]) continue;
		side[i] = nowLeft;
		n++;
		stepCrossings++;
		const near = Math.abs(b.y[i] - sim.simAperture.y) + b.r[i] <= sim.simAperture.size / 2;
		if (near) caught++;
	}
	if (n > 1) multi++;
	if (!n) continue;
	if (cost[0] < 0 || now < 0) continue;
	if (now < cost[0]) valuable++;
	else if (now > cost[0]) harmful++;
	else neutral++;
}
console.log('crossings=' + stepCrossings + ' multi_step=' + multi
	+ ' valuable=' + valuable + ' neutral=' + neutral + ' harmful=' + harmful);
console.log('caught_at_crossing=' + caught + ' caught_share=' + (caught / stepCrossings).toFixed(3)
	+ ' per_min=' + (caught / (SECONDS / 60)).toFixed(1));
console.log('valuable_share=' + (valuable / stepCrossings).toFixed(3));
