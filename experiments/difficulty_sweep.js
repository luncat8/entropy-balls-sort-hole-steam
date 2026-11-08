// owns: plan 0.4 difficulty band sweep over seeded distributions
// edit for: band constants, population sizes, candidate space

const path = require('path');
const { loadGame } = require('./vmload');

const { apis } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const tasks = apis['tasks.js'];
const tcost = apis['taskcost.js'];

const SEEDS = 60;
const POP = 36;
const CATS = tasks.CAT_COUNT || (2 + apis['color.js'].PALETTE.length * 2);

function rng(seed) {
	let x = seed >>> 0;
	return () => {
		x = (x * 1664525 + 1013904223) >>> 0;
		return x / 4294967296;
	};
}

function world(seed, n) {
	const r = rng(seed);
	sim.simSetSpawnRate(0);
	sim.simInit();
	sim.simBalls.count = 0;
	for (let i = 0; i < n; i++) {
		sim.simBalls.x[i] = r() < 0.5 ? 150 + r() * 350 : 700 + r() * 350;
		sim.simBalls.y[i] = 100 + r() * 600;
		sim.simBalls.vx[i] = 0;
		sim.simBalls.vy[i] = 0;
		sim.simBalls.r[i] = 12;
		sim.simBalls.palette[i] = (r() * 6) | 0;
		sim.simBalls.rgb[i] = 0;
		sim.simBalls.css[i] = '#000000';
	}
	sim.simBalls.count = n;
	sim.simFillDist();
}

const hist = {};
const label = {};
let feasible = 0;
let met = 0;
let unreachable = 0;
let stuck = 0;
let inBandTotal = 0;
const assigned = {};

for (let seed = 1; seed <= SEEDS; seed++) {
	world(seed * 15485863, POP);
	let inBand = 0;
	for (let cat = 0; cat < CATS; cat++) {
		for (let cmp = 0; cmp < 2; cmp++) {
			for (let measure = 0; measure < 2; measure++) {
			for (const t of tasks.TASK_THRESH) {
				for (let side = 0; side < 2; side++) {
					const cost = tcost.tasksCost(cat, cmp, t, side === 0, measure);
					if (cost < 0) { unreachable++; continue; }
					feasible++;
					if (cost === 0) { met++; continue; }
					const demand = tcost.tasksDemand(cat, cmp, t, side === 0, measure);
					hist[demand] = (hist[demand] || 0) + 1;
					const b = tcost.tasksBand(cost);
					if (tcost.tasksInBand(cost, demand, measure, 1)) {
						inBand++;
						inBandTotal++;
						label[tasks.TASK_LABEL_NAME[b]] = (label[tasks.TASK_LABEL_NAME[b]] || 0) + 1;
					}
				}
			}
			}
		}
	}
	if (inBand === 0) stuck++;
	sim.simDist.rev++;
	tasks.tasksInit();
	tasks.tasksSetRand(rng(seed));
	tasks.tasksAttach(0);
	const v = tasks.tasksView[0];
	if (v.waiting) assigned.waiting = (assigned.waiting || 0) + 1;
	else assigned[v.difficulty] = (assigned[v.difficulty] || 0) + 1;
}

const keys = Object.keys(hist).map(Number).sort((a, b) => a - b);
const costs = keys.reduce((acc, k) => acc.concat(new Array(hist[k]).fill(k)), []);
const quartile = p => costs[Math.floor(p * (costs.length - 1))];
const bandEdges = tcost.TASK_LABEL_COST.join('/');

console.log('difficulty_seeds=' + SEEDS + ' pop=' + POP + ' cost_min=' + tcost.TASK_COST_MIN + ' cost_cap=' + tcost.tasksCostMax() + ' cap_frac=' + tcost.TASK_COST_FRAC + ' demand_cap=' + tcost.tasksDemandMax() + ' band_edges=' + bandEdges);
console.log('candidates_total=' + (feasible + unreachable) + ' reachable=' + feasible + ' already_met=' + met + ' unreachable=' + unreachable);
console.log('cost_hist=' + keys.map(k => k + ':' + hist[k]).join(','));
console.log('cost_q25=' + quartile(0.25) + ' cost_q50=' + quartile(0.5) + ' cost_q75=' + quartile(0.75) + ' cost_max=' + keys[keys.length - 1]);
console.log('in_band_share=' + (costs.length ? (inBandTotal / costs.length).toFixed(3) : '0'));
console.log('band_hist=' + tasks.TASK_LABEL_NAME.map(n => n + ':' + (label[n] || 0)).join(','));
console.log('assigned_hist=' + Object.keys(assigned).sort().map(k => k + ':' + assigned[k]).join(','));
console.log('distributions_without_in_band=' + stuck + '/' + SEEDS);
