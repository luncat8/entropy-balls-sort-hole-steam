// owns: candidate-space census — which (band, category, cmp, measure) combinations are offerable
// edit for: population, seed

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const tasks = apis['tasks.js'];
const tcost = apis['taskcost.js'];

let x = Number(process.argv[2] || 777);
ctx.Math.random = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
const POP = Number(process.argv[3] || 24);
sim.simSetSpawnRate(0);
sim.simInit();
sim.simBalls.count = POP;
for (let i = 0; i < POP; i++) {
	sim.simBalls.x[i] = ctx.Math.random() < 0.5 ? 150 + ctx.Math.random() * 350 : 700 + ctx.Math.random() * 350;
	sim.simBalls.y[i] = 100 + ctx.Math.random() * 600;
	sim.simBalls.vx[i] = 0; sim.simBalls.vy[i] = 0; sim.simBalls.r[i] = 12;
	sim.simBalls.palette[i] = (ctx.Math.random() * 6) | 0;
	sim.simBalls.rgb[i] = 0; sim.simBalls.css[i] = '#000';
}
sim.simBalls.count = POP;
sim.simFillDist();

console.log('dist total=' + sim.simDist.total + ' left=' + sim.simDist.left + ' right=' + sim.simDist.right
	+ ' hot=' + sim.simDist.hot + ' cold=' + sim.simDist.cold);
const per = {};
const bandCount = {};
const bandCost = {};
for (let cat = 0; cat < tasks.tasksCatCount(); cat++) {
	for (let cmp = 0; cmp < 2; cmp++) {
		for (let measure = 0; measure < 2; measure++) {
			for (let ti = 0; ti < tasks.TASK_THRESH.length; ti++) {
				const th = tasks.TASK_THRESH[ti];
				for (let side = 0; side < 2; side++) {
					const cost = tcost.tasksCost(cat, cmp, th, side === 0, measure);
					if (cost < 0) continue;
					const demand = cost < 1 ? cost : tcost.tasksDemand(cat, cmp, th, side === 0, measure);
					if (!tcost.tasksInBand(cost, demand, measure, 1)) continue;
					const b = tcost.tasksBand(cost);
					bandCount[b] = (bandCount[b] || 0) + 1;
					(bandCost[b] = bandCost[b] || []).push(cost);
					const name = tasks.tasksCatName(cat);
					per[name] = (per[name] || 0) + 1;
				}
			}
		}
	}
}
console.log('in_band_total=' + Object.values(bandCount).reduce((a, b) => a + b, 0));
console.log('band=' + Object.keys(bandCount).map(k => tasks.TASK_LABEL_NAME[k] + ':' + bandCount[k]
	+ '(' + Math.min(...bandCost[k]) + '-' + Math.max(...bandCost[k]) + ')').join(','));
console.log('cat=' + Object.keys(per).sort().map(k => k + ':' + per[k]).join(','));
