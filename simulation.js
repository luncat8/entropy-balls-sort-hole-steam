// owns: field, balls, aperture, physics, ball color generation, distribution snapshot
// edit for: constants, spawn, stepping, snapshot fields

const simField = { w: 1200, h: 800, wallX: 600, wallT: 8 };

const BALL_CAP = 36;
const BALL_R_MIN = 10;
const BALL_R_MAX = 18;
const BALL_V_MIN = 140;
const BALL_V_MAX = 280;
const SPAWN_RATE = 2.5;
const APERTURE_SIZE = 113;
const APERTURE_SPEED = 700;
const FIXED_DT = 1 / 120;
const MAX_CATCHUP = 0.25;
const MAX_SUBSTEPS = 8;

const simBalls = {
	count: 0,
	x: new Float32Array(BALL_CAP),
	y: new Float32Array(BALL_CAP),
	vx: new Float32Array(BALL_CAP),
	vy: new Float32Array(BALL_CAP),
	r: new Float32Array(BALL_CAP),
	rgb: new Uint32Array(BALL_CAP),
	palette: new Uint8Array(BALL_CAP),
	css: new Array(BALL_CAP)
};

const simAperture = { y: 400, targetY: 400, size: APERTURE_SIZE, speed: APERTURE_SPEED };

const DIST_PALETTE = 6;
const simDist = {
	total: 0,
	left: 0,
	right: 0,
	hot: 0,
	cold: 0,
	leftHot: 0,
	leftCold: 0,
	rightHot: 0,
	rightCold: 0,
	palette: new Uint16Array(DIST_PALETTE),
	leftPalette: new Uint16Array(DIST_PALETTE),
	rightPalette: new Uint16Array(DIST_PALETTE),
	sig: 0,
	rev: 0
};

let simBallCollisions = true;
let spawnRate = SPAWN_RATE;
let spawnAcc = 0;
let stepAcc = 0;

function simSetBallCollisions(on) {
	simBallCollisions = on;
}

function simSetSpawnRate(rate) {
	spawnRate = rate;
}

function simSetApertureTarget(y) {
	simAperture.targetY = y;
}

function simSpawnOverlaps(x, y, r) {
	for (let j = 0; j < simBalls.count; j++) {
		const dx = x - simBalls.x[j];
		const dy = y - simBalls.y[j];
		const rSum = r + simBalls.r[j];
		if (dx * dx + dy * dy < rSum * rSum) return true;
	}
	return false;
}

function simSpawn() {
	const i = simBalls.count;
	if (i >= BALL_CAP) return;
	const r = BALL_R_MIN + Math.random() * (BALL_R_MAX - BALL_R_MIN);
	let x = 0, y = 0;
	for (let attempt = 0; attempt < 8; attempt++) {
		x = r + Math.random() * (simField.w - 2 * r);
		y = r + Math.random() * (simField.h - 2 * r);
		if (Math.abs(x - simField.wallX) < r + 6) continue;
		if (!simSpawnOverlaps(x, y, r)) break;
	}
	if (Math.abs(x - simField.wallX) < r + 6) x = simField.wallX + (x < simField.wallX ? -(r + 6) : r + 6);
	const sp = BALL_V_MIN + Math.random() * (BALL_V_MAX - BALL_V_MIN);
	const ang = Math.random() * Math.PI * 2;
	const p = (Math.random() * PALETTE.length) | 0;
	const rgb = colorHslToRgb(PALETTE[p][1], 0.6 + Math.random() * 0.3, 0.5 + Math.random() * 0.25);
	simBalls.x[i] = x;
	simBalls.y[i] = y;
	simBalls.vx[i] = Math.cos(ang) * sp;
	simBalls.vy[i] = Math.sin(ang) * sp;
	simBalls.r[i] = r;
	simBalls.rgb[i] = rgb;
	simBalls.palette[i] = p;
	simBalls.css[i] = colorCss(rgb); // one string per ball at spawn; the frame loop stays alloc-free
	simBalls.count = i + 1;
}

function simDistSig() {
	let s = simDist.total + 1;
	s = (s * 33 + simDist.left) | 0;
	s = (s * 33 + simDist.right) | 0;
	for (let p = 0; p < DIST_PALETTE; p++) {
		s = (s * 33 + simDist.leftPalette[p]) | 0;
		s = (s * 33 + simDist.rightPalette[p]) | 0;
	}
	return s;
}

function simFillDist() {
	const oldSig = simDist.sig;
	simDist.total = 0;
	simDist.left = 0;
	simDist.right = 0;
	simDist.hot = 0;
	simDist.cold = 0;
	simDist.leftHot = 0;
	simDist.leftCold = 0;
	simDist.rightHot = 0;
	simDist.rightCold = 0;
	simDist.palette.fill(0);
	simDist.leftPalette.fill(0);
	simDist.rightPalette.fill(0);
	const wallX = simField.wallX;
	for (let i = 0; i < simBalls.count; i++) {
		const p = simBalls.palette[i];
		simDist.total++;
		simDist.palette[p]++;
		if (simBalls.x[i] < wallX) {
			simDist.left++;
			simDist.leftPalette[p]++;
		} else {
			simDist.right++;
			simDist.rightPalette[p]++;
		}
	}
	for (let p = 0; p < DIST_PALETTE; p++) {
		const hue = PALETTE[p][1];
		if (colorIsWarm(hue)) {
			simDist.hot += simDist.palette[p];
			simDist.leftHot += simDist.leftPalette[p];
			simDist.rightHot += simDist.rightPalette[p];
		} else if (colorIsCold(hue)) {
			simDist.cold += simDist.palette[p];
			simDist.leftCold += simDist.leftPalette[p];
			simDist.rightCold += simDist.rightPalette[p];
		}
	}
	simDist.sig = simDistSig();
	if (simDist.sig !== oldSig) simDist.rev++;
}

function simInit() {
	simBalls.count = 0;
	spawnAcc = 0;
	stepAcc = 0;
	simAperture.y = simField.h / 2;
	simAperture.targetY = simField.h / 2;
	for (let k = 0; k < 13; k++) simSpawn();
	simFillDist();
}

function simMoveAperture(dt) {
	const half = simAperture.size / 2;
	const maxStep = simAperture.speed * dt;
	let d = simAperture.targetY - simAperture.y;
	if (d > maxStep) d = maxStep;
	else if (d < -maxStep) d = -maxStep;
	let y = simAperture.y + d;
	if (y < half) y = half;
	else if (y > simField.h - half) y = simField.h - half;
	simAperture.y = y;
}

function simSpawnTick(dt) {
	spawnAcc += dt * spawnRate;
	while (spawnAcc >= 1) {
		spawnAcc -= 1;
		simSpawn();
	}
}

function simWallBounce(i) {
	const r = simBalls.r[i];
	if (simBalls.x[i] < r) {
		simBalls.x[i] = r;
		if (simBalls.vx[i] < 0) simBalls.vx[i] = -simBalls.vx[i];
	} else if (simBalls.x[i] > simField.w - r) {
		simBalls.x[i] = simField.w - r;
		if (simBalls.vx[i] > 0) simBalls.vx[i] = -simBalls.vx[i];
	}
	if (simBalls.y[i] < r) {
		simBalls.y[i] = r;
		if (simBalls.vy[i] < 0) simBalls.vy[i] = -simBalls.vy[i];
	} else if (simBalls.y[i] > simField.h - r) {
		simBalls.y[i] = simField.h - r;
		if (simBalls.vy[i] > 0) simBalls.vy[i] = -simBalls.vy[i];
	}
}

function simDividerTouch(i) {
	const r = simBalls.r[i];
	const dx = simBalls.x[i] - simField.wallX;
	if (dx > r || dx < -r) return;
	const y = simBalls.y[i];
	const half = simAperture.size / 2;
	if (y - r >= simAperture.y - half && y + r <= simAperture.y + half) return;
	const side = dx >= 0 ? 1 : -1;
	if ((side === -1 && simBalls.vx[i] > 0) || (side === 1 && simBalls.vx[i] < 0)) {
		simBalls.vx[i] = -simBalls.vx[i];
		canvasAddImpact(simField.wallX + side * simField.wallT / 2, y, r, side, simBalls.rgb[i]);
	}
	simBalls.x[i] = simField.wallX + side * r;
}

function simMoveBall(i, dt) {
	const r = simBalls.r[i];
	const moveLen = Math.sqrt(simBalls.vx[i] * simBalls.vx[i] + simBalls.vy[i] * simBalls.vy[i]) * dt;
	let n = moveLen > r * 0.5 ? Math.ceil(moveLen / (r * 0.5)) : 1;
	if (n > MAX_SUBSTEPS) n = MAX_SUBSTEPS;
	const sdt = dt / n;
	for (let s = 0; s < n; s++) {
		simBalls.x[i] += simBalls.vx[i] * sdt;
		simBalls.y[i] += simBalls.vy[i] * sdt;
		simWallBounce(i);
		simDividerTouch(i);
	}
}

function simCollideBalls() {
	const n = simBalls.count;
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			let dx = simBalls.x[j] - simBalls.x[i];
			let dy = simBalls.y[j] - simBalls.y[i];
			const rSum = simBalls.r[i] + simBalls.r[j];
			let d2 = dx * dx + dy * dy;
			if (d2 >= rSum * rSum) continue;
			if (d2 < 1e-6) {
				dx = 1;
				dy = 0;
				d2 = 1;
			}
			const d = Math.sqrt(d2);
			const nx = dx / d, ny = dy / d;
			const corr = (rSum - d) * 0.5;
			simBalls.x[i] -= nx * corr;
			simBalls.y[i] -= ny * corr;
			simBalls.x[j] += nx * corr;
			simBalls.y[j] += ny * corr;
			const rvn = (simBalls.vx[j] - simBalls.vx[i]) * nx + (simBalls.vy[j] - simBalls.vy[i]) * ny;
			if (rvn < 0) {
				simBalls.vx[i] += nx * rvn;
				simBalls.vy[i] += ny * rvn;
				simBalls.vx[j] -= nx * rvn;
				simBalls.vy[j] -= ny * rvn;
			}
		}
	}
}

function simStep(dt) {
	simMoveAperture(dt);
	simSpawnTick(dt);
	for (let i = 0; i < simBalls.count; i++) simMoveBall(i, dt);
	if (simBallCollisions) simCollideBalls();
	simFillDist();
	tasksStep(dt); // per fixed step so catch-up still evaluates hold time (plan 0.2)
}

function simAdvance(dtSec) {
	stepAcc += dtSec > MAX_CATCHUP ? MAX_CATCHUP : dtSec;
	while (stepAcc >= FIXED_DT) {
		simStep(FIXED_DT);
		stepAcc -= FIXED_DT;
	}
}

if (typeof module !== 'undefined') module.exports = { simField, simBalls, simAperture, simDist, simInit, simAdvance, simStep, simSpawn, simFillDist, simSetApertureTarget, simSetBallCollisions, simSetSpawnRate, BALL_CAP, BALL_V_MAX, FIXED_DT };
