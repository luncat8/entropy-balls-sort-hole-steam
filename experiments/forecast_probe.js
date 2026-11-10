// owns: forecast evidence — the tracer against the stepped simulation, and how often a forecast comes true in live play
// edit for: seed, field, trial counts, distance bins

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const traj = apis['trajectory.js'];

let seed = Number(process.argv[2] || 1);
const W = Number(process.argv[3] || 1200);
const H = Number(process.argv[4] || 800);
const COUNT = Number(process.argv[5] || sim.BALL_COUNT_DEFAULT);
const TRIALS = 6000;
const LIVE_SEC = 600;
const SAMPLE_STEPS = 30;
const BIN_SHARE = 100;
const BINS = 10;

function rnd() {
	seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
	return seed / 4294967296;
}
ctx.Math.random = rnd;

const balls = sim.simBalls, field = sim.simField, hole = sim.simAperture;
const tag = 'field=' + W + 'x' + H + ' seed=' + seed;

// the simulation reports a plate hit only as an impact mark, so the mark is the ground truth for "turned
// back"; radii are random floats, which makes the radius a ball's name
const hitY = new Float32Array(sim.BALL_CAP).fill(NaN);
const addImpact = ctx.canvasAddImpact;
ctx.canvasAddImpact = (x, y, r, side, rgb) => {
	hitY[balls.r.indexOf(r)] = y;
	addImpact(x, y, r, side, rgb);
};
let eventY = 0;

// what the divider did to ball i during the last step: TRAJ_HIT (height in eventY), TRAJ_PASS or TRAJ_NONE
function dividerEvent(i, sideBefore) {
	if (!Number.isNaN(hitY[i])) {
		eventY = hitY[i];
		hitY[i] = NaN;
		return traj.TRAJ_HIT;
	}
	return (balls.x[i] - field.wallX) * sideBefore < 0 ? traj.TRAJ_PASS : traj.TRAJ_NONE;
}

function aimedBall(r, speed, left) {
	const half = hole.size / 2;
	const x = left ? r + rnd() * (field.wallX - 2 * r - 1) : field.wallX + r + 1 + rnd() * (field.wallX - 2 * r - 1);
	let y = r + rnd() * (field.h - 2 * r);
	let ang = rnd() * Math.PI * 2;
	// half the shots go at the opening and its lips, where a pass, a lip clip and a hit sit a pixel apart
	if (rnd() < 0.5) {
		const ty = hole.y + (rnd() * 2 - 1) * (half + r);
		y = Math.min(field.h - r, Math.max(r, ty + (rnd() * 2 - 1) * sim.simPx(200)));
		ang = Math.atan2(ty - y, field.wallX + (left ? -r : r) - x);
	}
	balls.x[0] = x;
	balls.y[0] = y;
	balls.vx[0] = Math.cos(ang) * speed;
	balls.vy[0] = Math.sin(ang) * speed;
	balls.r[0] = r;
	balls.count = 1;
}

function exactRun() {
	sim.simSetSpawnRate(0);
	sim.simSetBallCollisions(false);
	let trials = 0, same = 0, hits = 0, lips = 0, passes = 0, dySum = 0, dyOverR = 0;
	for (let k = 0; k < TRIALS; k++) {
		sim.simInit();
		const half = hole.size / 2;
		const park = rnd();
		hole.y = park < 0.15 ? half : park < 0.3 ? field.h - half : half + rnd() * (field.h - 2 * half);
		aimedBall(sim.simPx(9 + rnd() * 10), sim.simPx(120 + rnd() * 120), rnd() < 0.5);
		const end = traj.trajTrace(balls.x[0], balls.y[0], balls.vx[0], balls.vy[0], balls.r[0], Infinity, traj.trajPath);
		if (end === traj.TRAJ_NONE) continue;
		const p = traj.trajPath;
		const endX = p.x[p.n - 1], endY = p.y[p.n - 1];
		const side = Math.sign(balls.x[0] - field.wallX);
		let got = traj.TRAJ_NONE;
		while (got === traj.TRAJ_NONE) {
			sim.simStep(sim.FIXED_DT);
			got = dividerEvent(0, side);
		}
		trials++;
		if (got !== end) continue;
		same++;
		if (end === traj.TRAJ_PASS) {
			passes++;
			continue;
		}
		hits++;
		if (Math.abs(endX - field.wallX) < balls.r[0] - 1e-3) lips++;
		const dy = Math.abs(eventY - endY);
		dySum += dy;
		if (dy > balls.r[0]) dyOverR++;
	}
	console.log('forecast_exact ' + tag + ' trials=' + trials + ' same_end=' + same + ' pass=' + passes + ' hit=' + hits
		+ ' lip_hit=' + lips + ' hit_dy_mean_px=' + (dySum / hits).toFixed(2) + ' hit_dy_over_radius=' + dyOverR);
}

// the cheaper rule a lane predictor can use (bot.js does): the body fits where the centre meets the centre line
function fitsAtCentreLine(i) {
	const r = balls.r[i];
	let y = balls.y[i] + balls.vy[i] * (field.wallX - balls.x[i]) / balls.vx[i];
	if (y < r) y = 2 * r - y;
	if (y > field.h - r) y = 2 * (field.h - r) - y;
	return Math.abs(y - hole.y) <= hole.size / 2 - r;
}

// every pending forecast of a ball is settled by the next thing the divider does to that ball
function liveRun() {
	sim.simSetBallCount(COUNT);
	sim.simSetBallCollisions(true);
	sim.simInit();
	for (let k = 0; k < 30 / sim.FIXED_DT; k++) sim.simStep(sim.FIXED_DT);
	const pending = Array.from({ length: sim.BALL_CAP }, () => []);
	const right = new Uint32Array(BINS), wrong = new Uint32Array(BINS);
	const side = new Int8Array(sim.BALL_CAP);
	const centreFit = new Uint8Array(sim.BALL_CAP);
	let arrivals = 0, fits = 0, fitsTurned = 0;
	hitY.fill(NaN);
	for (let k = 0; k < LIVE_SEC / sim.FIXED_DT; k++) {
		for (let i = 0; i < balls.count; i++) {
			side[i] = Math.sign(balls.x[i] - field.wallX);
			centreFit[i] = fitsAtCentreLine(i) ? 1 : 0;
			if (k % SAMPLE_STEPS) continue;
			const end = traj.trajTrace(balls.x[i], balls.y[i], balls.vx[i], balls.vy[i], balls.r[i], Infinity, traj.trajPath);
			const bin = Math.floor(traj.trajPath.dist / sim.simPx(BIN_SHARE));
			if (end !== traj.TRAJ_NONE && bin < BINS) pending[i].push(end, traj.trajPath.y[traj.trajPath.n - 1], bin);
		}
		sim.simStep(sim.FIXED_DT);
		for (let i = 0; i < balls.count; i++) {
			const got = dividerEvent(i, side[i]);
			if (got === traj.TRAJ_NONE) continue;
			arrivals++;
			fits += centreFit[i];
			if (got === traj.TRAJ_HIT) fitsTurned += centreFit[i];
			for (let q = 0; q < pending[i].length; q += 3) {
				const ok = pending[i][q] === got
					&& (got === traj.TRAJ_PASS || Math.abs(pending[i][q + 1] - eventY) <= balls.r[i]);
				(ok ? right : wrong)[pending[i][q + 2]]++;
			}
			pending[i].length = 0;
		}
	}
	for (let bin = 0; bin < BINS; bin++) {
		const n = right[bin] + wrong[bin];
		console.log('forecast_trust ' + tag + ' balls=' + balls.count + ' from_share=' + bin * BIN_SHARE
			+ ' to_share=' + (bin + 1) * BIN_SHARE + ' right_pct=' + Math.round(100 * right[bin] / n) + ' n=' + n);
	}
	console.log('forecast_centre_line ' + tag + ' balls=' + balls.count + ' arrivals=' + arrivals + ' fit_at_centre_line=' + fits
		+ ' turned_back=' + fitsTurned + ' turned_back_pct=' + (100 * fitsTurned / fits).toFixed(1));
}

sim.simResizeField(W, H);
liveRun();
exactRun();
