// owns: seeded bot match measurement — completions, crossing ledger, contest and travel
// edit for: seeds, match length, reported metrics

const path = require('path');
const { loadGame } = require('./vmload');

function classify(apis, id, ballIndex, sideLeft, isLeft, cmpGt) {
	const tasks = apis['tasks.js'];
	const sim = apis['simulation.js'];
	const matches = tasks.tasksCatHas(tasks.tasksCatFromName(tasks.tasksView[id].category), sim.simBalls.palette[ballIndex]) === 1;
	const inNamed = sideLeft === isLeft;
	const wanted = matches === inNamed;
	return cmpGt ? wanted : !wanted;
}

function match(seed, seconds, opts) {
	const { apis, ctx } = loadGame(path.join(__dirname, '..'));
	const sim = apis['simulation.js'];
	const roster = apis['players.js'];
	const force = apis['force.js'];
	const tasks = apis['tasks.js'];
	const bot = apis['bot.js'];
	let x = seed >>> 0;
	ctx.Math.random = () => {
		x = (x * 1664525 + 1013904223) >>> 0;
		return x / 4294967296;
	};
	sim.simSetSpawnRate(1.6666666666666667);
	sim.simInit();
	force.forceSetCapacity(force.FORCE_CAPACITY);
	force.forceSetCost(force.FORCE_COST);
	const n = opts.humans || 2;
	roster.playersInit(n, (1 << n) - 1);
	force.forceInit();
	bot.botInit();
	if (opts.tuning) bot.botSetTuning(opts.tuning);
	tasks.tasksInit();
	tasks.tasksAttach(0);
	if ((opts.humans || 2) === 2) tasks.tasksAttach(1);
	if (opts.parked) sim.simSetControlHook(null);
	const steps = Math.round(seconds / sim.FIXED_DT);
	const gen0 = tasks.tasksGenCount();
	const assigned = {};
	const side = new Uint8Array(sim.BALL_CAP);
	const ids = [];
	let travelled = 0;
	let opposite = 0;
	let heldSteps = 0;
	let waitingSteps = 0;
	let help = 0;
	let harm = 0;
	let crossings = 0;
	let doneGt = 0;
	let doneLt = 0;
	let doneHold = 0;
	const prevScore = new Uint32Array(2);
	const prevCmp = new Uint8Array(2);
	const prevMode = new Uint8Array(2);
	for (let i = 0; i < sim.simBalls.count; i++) side[i] = sim.simBalls.x[i] < sim.simField.wallX ? 1 : 0;
	for (let i = 0; i < steps; i++) {
		for (let id = 0; id < 2; id++) {
			prevCmp[id] = tasks.tasksView[id].cmp === '<' ? 1 : 0;
			prevMode[id] = tasks.tasksView[id].mode === 'hold' ? 1 : 0;
		}
		sim.simStep(sim.FIXED_DT);
		for (let id = 0; id < 2; id++) {
			if (tasks.tasksScore[id] === prevScore[id]) continue;
			prevScore[id] = tasks.tasksScore[id];
			if (prevCmp[id]) doneLt++;
			else doneGt++;
			if (prevMode[id]) doneHold++;
		}
		travelled += Math.abs(sim.simAperture.velocity) * sim.FIXED_DT;
		for (let id = 0; id < roster.players.count; id++) {
			if (roster.players.type[id] === roster.PLAYER_BOT && force.forceState.held[id]) heldSteps++;
			if (tasks.tasksWait[id]) waitingSteps++;
		}
		if (roster.players.count === 2 && force.forceState.dir[0] * force.forceState.dir[1] < 0) opposite++;
		for (let b = 0; b < sim.simBalls.count; b++) {
			const nowLeft = sim.simBalls.x[b] < sim.simField.wallX ? 1 : 0;
			if (nowLeft === side[b]) continue;
			crossings++;
			for (let id = 0; id < roster.players.count; id++) {
				if (!tasks.tasksOn[id] || tasks.tasksWait[id]) continue;
				const cmpGt = tasks.tasksView[id].cmp === '>';
				if (classify(apis, id, b, nowLeft === 1 ? true : false, tasks.tasksView[id].side === 'left', cmpGt)) help++;
				else harm++;
			}
			side[b] = nowLeft;
		}
	}
	const gen = tasks.tasksGenCount() - gen0;
	for (let id = 0; id < roster.players.count; id++) {
		const label = tasks.tasksView[id].difficulty;
		assigned[label] = (assigned[label] || 0) + 1;
	}
	return {
		gen,
		travelled,
		opposite: opposite / steps,
		held: heldSteps / (steps * (roster.players.count === 2 ? 2 : 1)),
		waiting: waitingSteps / (steps * roster.players.count),
		help,
		harm,
		crossings,
		doneGt,
		doneLt,
		doneHold
	};
}

const SEEDS = Number(process.argv[2] || 4);
const SECONDS = Number(process.argv[3] || 90);
const humans = Number(process.argv[4] || 1);
const parked = process.argv.includes('parked');
const tuning = process.env.BOT_TUNE ? JSON.parse(process.env.BOT_TUNE) : null;
const label = process.argv[5] || 'policy';
const totals = { gen: 0, travelled: 0, opposite: 0, held: 0, waiting: 0, help: 0, harm: 0, crossings: 0, doneGt: 0, doneLt: 0, doneHold: 0 };
let bad = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
	const r = match(seed * 7919, SECONDS, { humans, parked, label, tuning });
	for (const k of Object.keys(totals)) totals[k] += r[k];
	if (r.gen === 0) bad++;
	console.log('seed=' + seed + ' completed=' + r.gen + ' help=' + r.help + ' harm=' + r.harm
		+ ' crossings=' + r.crossings + ' travelled_px=' + Math.round(r.travelled)
		+ ' opposite_share=' + r.opposite.toFixed(3) + ' held_share=' + r.held.toFixed(3)
		+ ' waiting_share=' + r.waiting.toFixed(3));
}
console.log('policy=' + label + ' runs=' + SEEDS + ' seconds=' + SECONDS + ' bots=' + (humans === 2 ? 2 : 1)
	+ ' parked=' + parked
	+ ' completed_total=' + totals.gen
	+ ' completed_per_min=' + (totals.gen / (SEEDS * SECONDS / 60)).toFixed(2)
	+ ' help_total=' + totals.help + ' harm_total=' + totals.harm
	+ ' net_per_min=' + ((totals.help - totals.harm) / (SEEDS * SECONDS / 60)).toFixed(2)
	+ ' crossings_per_min=' + (totals.crossings / (SEEDS * SECONDS / 60)).toFixed(2)
	+ ' travelled_px_per_min=' + Math.round(totals.travelled / (SEEDS * SECONDS / 60))
	+ ' opposite_share=' + (totals.opposite / SEEDS).toFixed(3)
	+ ' held_share=' + (totals.held / SEEDS).toFixed(3)
	+ ' waiting_share=' + (totals.waiting / SEEDS).toFixed(3)
	+ ' completed_gt=' + totals.doneGt + ' completed_lt=' + totals.doneLt
	+ ' completed_hold=' + totals.doneHold + ' zero_runs=' + bad);
