// owns: chamber-crossing ledger — how many crossings pass beside the aperture instead of through it
// edit for: run length, leak tolerance, samples

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];

let x = Number(process.argv[2] || 99);
ctx.Math.random = () => {
	x = (x * 1664525 + 1013904223) >>> 0;
	return x / 4294967296;
};

const SECONDS = Number(process.argv[3] || 120);
const DT = sim.FIXED_DT;

sim.simSetSpawnRate(1.6666666666666667);
sim.simInit();

// a ball that spawns on the other side reads as a crossing, so the first snapshot is the baseline
const side = new Uint8Array(sim.BALL_CAP);
let tracked = sim.simBalls.count;
for (let i = 0; i < tracked; i++) side[i] = sim.simBalls.x[i] < sim.simField.wallX ? 1 : 0;

const b = sim.simBalls;
let crossings = 0;
let leaks = 0;
let shown = 0;
for (let s = 0; s < SECONDS / DT; s++) {
	sim.simStep(DT);
	const half = sim.simAperture.size / 2;
	for (let i = 0; i < b.count; i++) {
		const nowLeft = b.x[i] < sim.simField.wallX ? 1 : 0;
		if (i >= tracked) {
			side[i] = nowLeft;
			if (i === tracked) tracked++;
			continue;
		}
		if (nowLeft === side[i]) continue;
		side[i] = nowLeft;
		crossings++;
		if (Math.abs(b.y[i] - sim.simAperture.y) + b.r[i] <= half) continue;
		leaks++;
		if (shown++ >= 6) continue;
		console.log('leak i=' + i + ' x=' + b.x[i].toFixed(1) + ' y=' + b.y[i].toFixed(1)
			+ ' r=' + b.r[i].toFixed(1) + ' apY=' + sim.simAperture.y.toFixed(1)
			+ ' vx=' + b.vx[i].toFixed(1) + ' vy=' + b.vy[i].toFixed(1));
	}
}
console.log('crossings=' + crossings + ' leaks=' + leaks + ' leak_share=' + (leaks / crossings).toFixed(3)
	+ ' per_min=' + (leaks / (SECONDS / 60)).toFixed(1));
