// owns: progress invariant — does every priced objective have a ball whose crossing lowers its cost
// edit for: population sizes, seed, reported counters

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const tasks = apis['tasks.js'];
const tcost = apis['taskcost.js'];

let x = Number(process.argv[2] || 4242);
ctx.Math.random = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
const SEEDS = Number(process.argv[3] || 20);

function world(seed) {
	x = seed >>> 0;
	sim.simSetSpawnRate(0);
	sim.simInit();
	const n = 12 + ((ctx.Math.random() * 25) | 0);
	sim.simBalls.count = n;
	for (let i = 0; i < n; i++) {
		sim.simBalls.x[i] = 20 + ctx.Math.random() * (sim.simField.w - 40);
		sim.simBalls.y[i] = 20 + ctx.Math.random() * (sim.simField.h - 40);
		sim.simBalls.vx[i] = 0;
		sim.simBalls.vy[i] = 0;
		sim.simBalls.r[i] = 14;
		sim.simBalls.palette[i] = (ctx.Math.random() * 6) | 0;
		sim.simBalls.rgb[i] = 0;
		sim.simBalls.css[i] = '#000';
	}
	sim.simFillDist();
}

// a crossing is legal for a ball when it can reach the other chamber: every ball can, but only if
// there are balls of its kind on the side it would leave
let stuck = 0;
let checked = 0;
let inBand = 0;
const examples = [];
for (let seed = 1; seed <= SEEDS; seed++) {
	world(seed * 2654435761);
	for (let cat = 0; cat < tasks.tasksCatCount(); cat++) {
		for (let cmp = 0; cmp < 2; cmp++) {
			for (let measure = 0; measure < 2; measure++) {
				for (const th of tasks.TASK_THRESH) {
					for (let side = 0; side < 2; side++) {
						const cost = tcost.tasksCost(cat, cmp, th, side === 0, measure);
						if (cost < 1) continue;
						const demand = tcost.tasksDemand(cat, cmp, th, side === 0, measure);
						if (!tcost.tasksInBand(cost, demand, measure, 1)) continue;
						inBand++;
						let best = 0;
						const isLeft = side === 0;
						const wallX = sim.simField.wallX;
						for (let b = 0; b < sim.simBalls.count; b++) {
							const isCat = tasks.tasksCatHas(cat, sim.simBalls.palette[b]) === 1;
							const nowLeft = sim.simBalls.x[b] < wallX;
							// the ball can only leave the chamber it is in
							const entering = nowLeft !== isLeft;
							const v = tcost.tasksCrossValue(cat, cmp, th, isLeft, measure, isCat, entering);
							if (v > best) best = v;
						}
						checked++;
						if (best > 0) continue;
						stuck++;
						if (examples.length < 8) {
							examples.push('seed=' + seed + ' ' + (isLeft ? 'left' : 'right')
								+ ' ' + (cmp ? '<' : '>') + th + '% ' + (measure ? 'of ' : '')
								+ tasks.tasksCatName(cat) + ' cost=' + cost + ' demand=' + demand
								+ ' n=' + sim.simDist.total);
						}
					}
				}
			}
		}
	}
}
console.log('seeds=' + SEEDS + ' in_band=' + inBand + ' checked=' + checked
	+ ' no_progress_crossing=' + stuck
	+ ' share=' + (checked ? (stuck / checked).toFixed(4) : '0'));
for (const e of examples) console.log('  ' + e);
