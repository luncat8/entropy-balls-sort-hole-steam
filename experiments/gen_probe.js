// owns: which objectives generation actually produces from a live field
// edit for: sample count, reported dimensions

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const tasks = apis['tasks.js'];

let x = Number(process.argv[2] || 12345);
ctx.Math.random = () => {
	x = (x * 1664525 + 1013904223) >>> 0;
	return x / 4294967296;
};
const N = Number(process.argv[3] || 500);

sim.simSetSpawnRate(1.6666666666666667);
sim.simInit();
tasks.tasksInit();
tasks.tasksSetRand(ctx.Math.random);

const measure = { side: 0, total: 0 };
const mode = { immediate: 0, hold: 0 };
const cmp = { '>': 0, '<': 0 };
const cat = {};
const diff = {};
let waiting = 0;
tasks.tasksAttach(0);
for (let k = 0; k < N; k++) {
	const v = tasks.tasksView[0];
	if (v.waiting) waiting++;
	else {
		measure[v.measure]++;
		mode[v.mode]++;
		cmp[v.cmp]++;
		cat[v.category] = (cat[v.category] || 0) + 1;
		diff[v.difficulty] = (diff[v.difficulty] || 0) + 1;
	}
	tasks.tasksAttach(0);
}
console.log('samples=' + N + ' waiting=' + waiting);
console.log('measure_side=' + measure.side + ' measure_total=' + measure.total);
console.log('mode_immediate=' + mode.immediate + ' mode_hold=' + mode.hold);
console.log('cmp_gt=' + cmp['>'] + ' cmp_lt=' + cmp['<']);
console.log('diff=' + Object.keys(diff).sort().map(k => k + ':' + diff[k]).join(','));
console.log('cat=' + Object.keys(cat).sort().map(k => k + ':' + cat[k]).join(','));
