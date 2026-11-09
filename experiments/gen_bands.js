// owns: per-band candidate census exactly as generation sees it, plus the pick it makes
// edit for: population, seed, reported bands

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const tasks = apis['tasks.js'];
const tcost = apis['taskcost.js'];

let x = Number(process.argv[2] || 12345);
const N = Number(process.argv[3] || 400);
const POP = Number(process.argv[4] || 24);
ctx.Math.random = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };

sim.simSetSpawnRate(0);
sim.simInit();
while (sim.simBalls.count !== POP) {
	if (sim.simBalls.count > POP) sim.simBalls.count = POP;
	else sim.simSpawn();
}
sim.simFillDist();

const nCat = tasks.tasksCatCount();
const nTh = tasks.TASK_THRESH.length;
const total = 2 * 2 * 2 * nTh * 2 * nCat;
const band = { easy: 0, normal: 0, hard: 0, expert: 0 };
const bandByMeasure = [{}, {}];
const d = { side: 0, cat: 0, cmp: 0, measure: 0, thresh: 0, mode: 0 };
for (let i = 0; i < total; i++) {
	// mirror of tasksDecode
	let v = i;
	d.mode = v % 2; v = (v / 2) | 0;
	d.side = v % 2; v = (v / 2) | 0;
	d.measure = v % 2; v = (v / 2) | 0;
	d.thresh = tasks.TASK_THRESH[v % nTh]; v = (v / nTh) | 0;
	d.cmp = v % 2; v = (v / 2) | 0;
	d.cat = v % nCat;
	const cost = tcost.tasksCost(d.cat, d.cmp, d.thresh, d.side === 0, d.measure);
	const demand = cost < 1 ? cost : tcost.tasksDemand(d.cat, d.cmp, d.thresh, d.side === 0, d.measure);
	if (!tcost.tasksInBand(cost, demand, d.measure, d.mode)) continue;
	const b = tcost.tasksBand(cost);
	band[tasks.TASK_LABEL_NAME[b]]++;
	const key = tasks.TASK_LABEL_NAME[b];
	bandByMeasure[d.measure][key] = (bandByMeasure[d.measure][key] || 0) + 1;
}
console.log('pop=' + POP + ' total=' + sim.simDist.total + ' left=' + sim.simDist.left
	+ ' right=' + sim.simDist.right + ' hot=' + sim.simDist.hot + ' cold=' + sim.simDist.cold);
console.log('cand_space=' + total + ' in_band=' + Object.values(band).reduce((a, b2) => a + b2, 0));
console.log('band=' + Object.keys(band).map(k => k + ':' + band[k]).join(','));
console.log('band_side=' + JSON.stringify(bandByMeasure[0]));
console.log('band_total=' + JSON.stringify(bandByMeasure[1]));

const picked = {};
const pickedMeasure = { side: 0, total: 0 };
tasks.tasksInit();
tasks.tasksSetRand(ctx.Math.random);
for (let k = 0; k < N; k++) {
	tasks.tasksAttach(0);
	const v = tasks.tasksView[0];
	if (v.waiting) { picked.waiting = (picked.waiting || 0) + 1; continue; }
	picked[v.difficulty] = (picked[v.difficulty] || 0) + 1;
	pickedMeasure[v.measure]++;
}
console.log('picked=' + JSON.stringify(picked) + ' picked_measure=' + JSON.stringify(pickedMeasure));
