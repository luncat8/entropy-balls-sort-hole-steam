// owns: a-priori crossing demand over seeded worlds — the scarcity a category can supply
// edit for: populations, seeds, quantiles

const path = require('path');
const { loadGame } = require('./vmload');

const { apis } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const tasks = apis['tasks.js'];
const tcost = apis['taskcost.js'];

const SEEDS = 40;

function rng(seed) {
	let x = seed >>> 0;
	return () => {
		x = (x * 1664525 + 1013904223) >>> 0;
		return x / 4294967296;
	};
}

function world(seed, n, tight) {
	const r = rng(seed);
	sim.simSetSpawnRate(0);
	sim.simInit();
	sim.simBalls.count = 0;
	const b = sim.simBalls;
	for (let i = 0; i < n; i++) {
		b.x[i] = r() < 0.5 ? 150 + r() * 350 : 700 + r() * 350;
		b.y[i] = 100 + r() * 600;
		b.vx[i] = 0;
		b.vy[i] = 0;
		b.r[i] = 12;
		b.palette[i] = tight && r() < 0.5 ? 0 : (r() * 6) | 0;
		b.css[i] = '#000';
	}
	b.count = n;
	sim.simFillDist();
}

// quantile over the observed demand values, so a cap can be read off the field rather than guessed
function quantile(hist, p) {
	const keys = Object.keys(hist).map(Number).sort((a, b) => a - b);
	if (!keys.length) return 0;
	let total = 0;
	for (const k of keys) total += hist[k];
	let acc = 0;
	for (const k of keys) {
		acc += hist[k];
		if (acc >= total * p) return k;
	}
	return keys[keys.length - 1];
}

for (const N of [14, 24, 36]) {
	const hist = {};
	const byMeasure = { 0: {}, 1: {} };
	for (let seed = 1; seed <= SEEDS; seed++) {
		world(seed * 6151, N, false);
		for (let cat = 0; cat < tasks.tasksCatCount(); cat++)
			for (let cmp = 0; cmp < 2; cmp++)
				for (let m = 0; m < 2; m++)
					for (const t of tasks.TASK_THRESH)
						for (let side = 0; side < 2; side++) {
							const dem = tcost.tasksDemand(cat, cmp, t, side === 0, m);
							if (dem <= 0) continue;
							hist[dem] = (hist[dem] || 0) + 1;
							byMeasure[m][dem] = (byMeasure[m][dem] || 0) + 1;
						}
	}
	console.log('N=' + N + ' q10=' + quantile(hist, 0.1) + ' q25=' + quantile(hist, 0.25)
		+ ' q50=' + quantile(hist, 0.5) + ' q75=' + quantile(hist, 0.75) + ' q90=' + quantile(hist, 0.9)
		+ ' max=' + quantile(hist, 1) + ' cap=' + tcost.TASK_DEMAND_CAP);
	for (const m of [0, 1]) console.log('  measure=' + (m ? 'total' : 'side')
		+ ' q50=' + quantile(byMeasure[m], 0.5) + ' max=' + quantile(byMeasure[m], 1));
}
