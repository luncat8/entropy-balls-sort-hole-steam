// owns: comprehension check — one stated objective, one solo bot, did it finish and how long
// edit for: objective under test, run length, seed count

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const roster = apis['players.js'];
const force = apis['force.js'];
const tasks = apis['tasks.js'];
const tcost = apis['taskcost.js'];
const bot = apis['bot.js'];

const arg = (i, fallback) => process.argv[i] === undefined ? fallback : process.argv[i];
const JOB = {
	side: arg(2, 'left'),
	cmp: arg(3, '>'),
	threshold: Number(arg(4, 60)),
	cat: arg(5, 'hot'),
	measure: arg(6, 'side'),
	mode: arg(7, 'hold')
};
const SECONDS = Number(arg(8, 120));
const SEEDS = Number(arg(9, 8));
const DT = sim.FIXED_DT;

// distinct, seeded fields so a stalled job cannot hide behind one lucky spawn
function field(seed) {
	let x = seed >>> 0;
	ctx.Math.random = () => {
		x = (x * 1664525 + 1013904223) >>> 0;
		return x / 4294967296;
	};
	sim.simSetSpawnRate(1.6666666666666667);
	sim.simInit();
	force.forceSetCapacity(force.FORCE_CAPACITY);
	force.forceSetCost(force.FORCE_COST);
	roster.playersInit(1, 1);
	force.forceInit();
	bot.botInit();
	tasks.tasksSetRand(ctx.Math.random);
	tasks.tasksInit();
	tasks.tasksAssign(0, JOB.side, JOB.cat, JOB.cmp, JOB.threshold, JOB.mode, JOB.measure);
}

let done = 0;
let totalTime = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
	field(seed * 7919);
	const cat = tasks.tasksCatFromName(JOB.cat);
	const cost = tcost.tasksCost(cat, JOB.cmp === '>' ? 0 : 1, JOB.threshold, JOB.side === 'left',
		JOB.measure === 'total' ? 1 : 0);
	const score = tasks.tasksScore[0];
	let at = -1;
	const trace = process.env.TRACE === '1';
	for (let i = 0; i < SECONDS / DT; i++) {
		sim.simStep(DT);
		if (trace && i % 60 === 0) {
			const v = tasks.tasksView[0];
			console.log('  t=' + (i * DT).toFixed(0) + ' match=' + v.match + '/' + v.denom
				+ ' prog=' + v.progress.toFixed(2) + " hold=" + v.holdSec.toFixed(2)
				+ ' wait=' + v.waiting + ' aimed=' + bot.botState.aimed[0]
				+ ' target=' + bot.botState.targetY[0].toFixed(0) + ' apY=' + sim.simAperture.y.toFixed(0));
		}
		if (tasks.tasksScore[0] > score) {
			at = i * DT;
			break;
		}
	}
	if (at >= 0) {
		done++;
		totalTime += at;
	}
	console.log('seed=' + seed + ' cost=' + cost + ' done=' + (at >= 0 ? 1 : 0)
		+ ' at=' + (at >= 0 ? at.toFixed(1) : '-'));
}
console.log('job=' + JOB.side + JOB.cmp + JOB.threshold + '%/' + JOB.cat + '/' + JOB.measure + '/'
	+ JOB.mode + ' seeds=' + SEEDS + ' done=' + done + '/' + SEEDS + ' mean_at='
	+ (done ? (totalTime / done).toFixed(1) : '-'));
