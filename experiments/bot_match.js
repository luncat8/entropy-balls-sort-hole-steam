// owns: seeded bot match measurement — completions, crossing ledger, contest and travel
// edit for: seeds, match length, characters, reported metrics

const path = require('path');
const { loadGame } = require('./vmload');

// A crossing helps when it shortens the priced distance to a satisfying split, which is the same
// value the bot scores lanes with: for a chamber-share objective that is a matching ball entering or
// another ball leaving, and for a whole-canvas objective the other balls do not count at all.
function classify(apis, id, ballIndex, nowLeft) {
	const tasks = apis['tasks.js'];
	const tcost = apis['taskcost.js'];
	const sim = apis['simulation.js'];
	const v = tasks.tasksView[id];
	const cat = tasks.tasksCatFromName(v.category);
	const isCat = tasks.tasksCatHas(cat, sim.simBalls.palette[ballIndex]) === 1;
	const entering = (nowLeft === (v.side === 'left'));
	return tcost.tasksCrossValue(cat, v.cmp === '>' ? 0 : 1, v.threshold,
		v.side === 'left', v.measure === 'total' ? 1 : 0, isCat, entering);
}

function taskSig(apis, id) {
	const tasks = apis['tasks.js'];
	const v = tasks.tasksView[id];
	return v.category + '|' + v.cmp + v.threshold + '|' + v.measure + '|' + v.side + '|' + v.mode + '|' + v.cost;
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
	if (opts.chars) for (let id = 0; id < opts.chars.length; id++) bot.botCharSet(id, opts.chars[id]);
	if (opts.charTune) for (let id = 0; id < opts.chars.length; id++) Object.assign(bot.BOT_CHARS[opts.chars[id]], opts.charTune);
	if (opts.tuning) bot.botSetTuning(opts.tuning);
	tasks.tasksInit();
	// task generation and the character draw use the one seeded stream, so a match reproduces whole
	tasks.tasksSetRand(ctx.Math.random);
	bot.botSetRand(ctx.Math.random);
	tasks.tasksAttach(0);
	if ((opts.humans || 2) === 2) tasks.tasksAttach(1);
	if (opts.parked) sim.simSetControlHook(null);
	const steps = Math.round(seconds / sim.FIXED_DT);

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
	let doneSide = 0;
	let doneTotal = 0;
	const prevScore = new Uint32Array(2);
	const prevCmp = new Uint8Array(2);
	const prevMode = new Uint8Array(2);
	// per-label accounting of assigned and finished objectives, so a difficulty label can be checked
	// against the time it actually took instead of the crossings it guessed
	const labelStat = {};
	const live = [null, null];
	function note(id, v) {
		const key = v.waiting ? 'waiting' : v.difficulty;
		const s = labelStat[key] = labelStat[key] || { assigned: 0, done: 0, seconds: 0 };
		s.assigned++;
		live[id] = { key, at: stepNow, measure: v.measure, mode: v.mode, cost: v.cost };
	}
	let stepNow = 0;
	let tracked = sim.simBalls.count;
	for (let id = 0; id < roster.players.count; id++) note(id, tasks.tasksView[id]);
	for (let i = 0; i < sim.simBalls.count; i++) side[i] = sim.simBalls.x[i] < sim.simField.wallX ? 1 : 0;
	for (let i = 0; i < steps; i++) {
		stepNow = i * sim.FIXED_DT;
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
			const was = live[id];
			if (was) {
				const stat = labelStat[was.key];
				if (stat) {
					stat.done++;
					stat.seconds += stepNow - was.at;
				}
				if (was.measure === 'total') doneTotal++;
				else doneSide++;
			}
			note(id, tasks.tasksView[id]);
		}
		travelled += Math.abs(sim.simAperture.velocity) * sim.FIXED_DT;
		for (let id = 0; id < roster.players.count; id++) {
			if (roster.players.type[id] === roster.PLAYER_BOT && force.forceState.held[id]) heldSteps++;
			if (tasks.tasksWait[id]) waitingSteps++;
		}
		if (roster.players.count === 2 && force.forceState.held[0] && force.forceState.held[1]
			&& force.forceState.dir[0] * force.forceState.dir[1] < 0) opposite++;
		for (let b = 0; b < sim.simBalls.count; b++) {
			const nowLeft = sim.simBalls.x[b] < sim.simField.wallX ? 1 : 0;
			// a ball that spawns into a chamber did not cross the divider: the ledger read every
			// arrival as traffic and charged the bot for help or harm it never caused
			if (b >= tracked) {
				side[b] = nowLeft;
				if (b === tracked) tracked++;
				continue;
			}
			if (nowLeft === side[b]) continue;
			crossings++;
			for (let id = 0; id < roster.players.count; id++) {
				if (!tasks.tasksOn[id] || tasks.tasksWait[id]) continue;
				const v = classify(apis, id, b, nowLeft === 1);
				if (v > 0) help++;
				else if (v < 0) harm++;
			}
			side[b] = nowLeft;
		}
	}
	const labels = [];
	for (const key of Object.keys(labelStat)) {
		const s = labelStat[key];
		labels.push(key + ':' + s.assigned + '/' + (s.done ? (s.seconds / s.done).toFixed(1) : '-'));
	}
	return {
		labels: labels.join(','),
		doneSide,
		doneTotal,
		done0: tasks.tasksScore[0],
		done1: tasks.tasksScore[1],
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
const chars = process.env.BOT_CHARS ? process.env.BOT_CHARS.split(',').map(Number) : null;
const charTune = process.env.BOT_CHAR_TUNE ? JSON.parse(process.env.BOT_CHAR_TUNE) : null;
const label = process.argv[5] || 'policy';
const totals = { done0: 0, done1: 0, travelled: 0, opposite: 0, held: 0, waiting: 0, help: 0, harm: 0, crossings: 0, doneGt: 0, doneLt: 0, doneHold: 0, doneSide: 0, doneTotal: 0 };
const labelsAll = {};
let bad = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
	const r = match(seed * 7919, SECONDS, { humans, parked, label, tuning, chars, charTune });
	for (const entry of r.labels.split(',').filter(Boolean)) {
		const [key, pair] = entry.split(':');
		const [assignedN, secs] = pair.split('/');
		const acc = labelsAll[key] = labelsAll[key] || { assigned: 0, secs: 0, done: 0 };
		acc.assigned += Number(assignedN);
		if (secs !== '-') {
			acc.secs += Number(secs);
			acc.done += 1;
		}
	}
	for (const k of Object.keys(totals)) totals[k] += r[k];
	if (r.done0 + r.done1 === 0) bad++;
	console.log('seed=' + seed + ' completed=' + (r.done0 + r.done1) + ' completed_by_bot=' + r.done0 + ',' + r.done1 + ' help=' + r.help + ' harm=' + r.harm
		+ ' crossings=' + r.crossings + ' travelled_px=' + Math.round(r.travelled)
		+ ' opposite_share=' + r.opposite.toFixed(3) + ' held_share=' + r.held.toFixed(3)
		+ ' waiting_share=' + r.waiting.toFixed(3));
}
console.log('policy=' + label + ' runs=' + SEEDS + ' seconds=' + SECONDS + ' bots=' + (humans === 2 ? 2 : 1)
	+ ' chars=' + (chars || 'draw') + ' parked=' + parked
	+ ' completed_all=' + (totals.done0 + totals.done1)
	+ ' completed_by_bot=' + totals.done0 + ',' + totals.done1
	+ ' completed_per_min=' + ((totals.done0 + totals.done1) / (SEEDS * SECONDS / 60)).toFixed(2)
	+ ' help_total=' + totals.help + ' harm_total=' + totals.harm
	+ ' net_per_min=' + ((totals.help - totals.harm) / (SEEDS * SECONDS / 60)).toFixed(2)
	+ ' crossings_per_min=' + (totals.crossings / (SEEDS * SECONDS / 60)).toFixed(2)
	+ ' travelled_px_per_min=' + Math.round(totals.travelled / (SEEDS * SECONDS / 60))
	+ ' opposite_share=' + (totals.opposite / SEEDS).toFixed(3)
	+ ' held_share=' + (totals.held / SEEDS).toFixed(3)
	+ ' waiting_share=' + (totals.waiting / SEEDS).toFixed(3)
	+ ' completed_gt=' + totals.doneGt + ' completed_lt=' + totals.doneLt
	+ ' completed_hold=' + totals.doneHold
	+ ' completed_side=' + totals.doneSide + ' completed_measure_total=' + totals.doneTotal
	+ ' zero_runs=' + bad);
console.log('labels=' + Object.keys(labelsAll).sort().map(k => {
	const a = labelsAll[k];
	return k + ':' + a.assigned + 'assigned/' + a.done + 'runs/' + (a.done ? (a.secs / a.done).toFixed(1) + 's' : '-');
}).join(','));
