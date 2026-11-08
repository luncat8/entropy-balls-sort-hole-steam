// owns: one-bot trace — every task, every think and every priced crossing, in order
// edit for: seed, run length, trace detail

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const roster = apis['players.js'];
const force = apis['force.js'];
const tasks = apis['tasks.js'];
const bot = apis['bot.js'];
const tcost = apis['taskcost.js'];

let x = Number(process.argv[2] || 42);
ctx.Math.random = () => {
	x = (x * 1664525 + 1013904223) >>> 0;
	return x / 4294967296;
};

const SECONDS = Number(process.argv[3] || 45);
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
const prevSide = new Uint8Array(sim.BALL_CAP);
let lastSig = '';
let thinks = 0;
let aimed = 0;
let idle = 0;
let rest = 0;
for (let i = 0; i < b.count; i++) prevSide[i] = b.x[i] < sim.simField.wallX ? 1 : 0;

for (let step = 0; step < SECONDS / DT; step++) {
	const t = (step * DT).toFixed(2);
	const before = bot.botState.think[0];
	sim.simStep(DT);
	const v = tasks.tasksView[0];
	const sig = v.category + v.cmp + v.threshold + v.measure + v.side + v.cost;
	if (sig !== lastSig) {
		lastSig = sig;
		console.log('t=' + t + ' TASK ' + v.side + ' ' + v.cmp + v.threshold + '% '
			+ (v.measure === 'total' ? 'of ' : '') + v.category + ' ' + v.mode + ' match=' + v.match
			+ '/' + v.denom + ' cost=' + v.cost + ' ' + v.difficulty);
	}
	if (bot.botState.think[0] > before) {
		thinks++;
		if (bot.botState.aimed[0]) aimed++;
		else idle++;
		if (bot.botState.rest[0]) rest++;
		if (step % 60) continue;
		console.log('  think y=' + sim.simAperture.y.toFixed(0) + ' target='
			+ (bot.botState.aimed[0] ? bot.botState.targetY[0].toFixed(0) : '-')
			+ ' needCat=' + bot.botPlan.needCat + ' spare=' + bot.botPlan.spareOther
			+ ' val=' + bot.botPlan.valCatIn + ',' + bot.botPlan.valCatOut + ','
			+ bot.botPlan.valOtherIn + ',' + bot.botPlan.valOtherOut
			+ ' prog=' + v.progress.toFixed(2) + ' match=' + v.match + '/' + v.denom
			+ ' energy=' + force.forceState.energy[0].toFixed(0));
	}
	for (let i = 0; i < b.count; i++) {
		const nowLeft = b.x[i] < sim.simField.wallX ? 1 : 0;
		if (nowLeft === prevSide[i]) continue;
		prevSide[i] = nowLeft;
		const cat = tasks.tasksCatFromName(v.category);
		const isCat = tasks.tasksCatHas(cat, b.palette[i]) === 1;
		const val = tcost.tasksCrossValue(cat, v.cmp === '>' ? 0 : 1, v.threshold,
			v.side === 'left', v.measure === 'total' ? 1 : 0, isCat, nowLeft === 1);
		if (val === 0) continue;
		console.log('  crossing t=' + t + ' ball' + i + (isCat ? ' CAT' : ' other') + ' ->'
			+ (nowLeft ? 'left' : 'right') + ' value=' + val + ' apY=' + sim.simAperture.y.toFixed(0)
			+ ' ballY=' + b.y[i].toFixed(0));
	}
}
console.log('thinks=' + thinks + ' aimed=' + aimed + ' idle=' + idle + ' rest=' + rest);
