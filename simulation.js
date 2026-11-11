// owns: field, balls, aperture, physics, ball color generation, distribution snapshot
// edit for: constants, spawn, stepping, snapshot fields, mode hooks

// The field is the canvas, so it is measured in CSS pixels and rebuilt on every resize; the divider
// is always halfway across, and balls bounce off the screen edge instead of a drawn border.
// Nothing in it is a fixed pixel size: the field scale is the side of the square with the field's area
// and every length and speed is a share of a thousandth of it, so one setting draws the same picture
// and keeps the same pace on a phone and on a desktop.
const SIM_SHARE = 1000;
const WALL_SHARE = 8;
const SPAWN_GAP_SHARE = 6;
const FIELD_START_W = 1200;
const FIELD_START_H = 800;
const FIELD_START_SCALE = Math.sqrt(FIELD_START_W * FIELD_START_H);
const FIELD_MIN_W = 240;
const FIELD_MIN_H = 240;

// the boot field before the first layout reports a size; a resize re-derives its pixel values
const simField = {
	w: FIELD_START_W,
	h: FIELD_START_H,
	wallX: FIELD_START_W / 2,
	wallT: WALL_SHARE * FIELD_START_SCALE / SIM_SHARE,
	scale: FIELD_START_SCALE
};

const BALL_CAP = 36;
const BALL_COUNT_MIN = 6;
const BALL_COUNT_DEFAULT = 24;
const BALL_START_COUNT = 9;
// sizes and speeds are shares of the field scale — the thousandth of sqrt(w * h) — and a speed is
// the same share per second: ballSize 14 is a 1.4 % radius
const BALL_SIZE_MIN = 6;
const BALL_SIZE_MAX = 26;
const BALL_SIZE_DEFAULT = 14;
const BALL_SIZE_VARIETY = 0.35;
const BALL_V_MIN = 140;
const BALL_V_MAX = 280;
const BALL_SPEED_MIN = 50;
const BALL_SPEED_MAX = 350;
const BALL_SPEED_DEFAULT = 180;
const SPAWN_RATE = 5 / 3;
const APERTURE_SIZE = 115;
const APERTURE_SIZE_MIN = 60;
const APERTURE_SIZE_MAX = 240;
const APERTURE_SPEED = 710;
const APERTURE_SPEED_MIN = 200;
const APERTURE_SPEED_MAX = 1400;
const APERTURE_FRICTION = 1;
const FIXED_DT = 1 / 120;
const MAX_CATCHUP = 0.25;
const MAX_SUBSTEPS = 8;
// a ball lying on a screen edge holds a float32 height, so an exact fit test turns back two in five of the
// balls that skim the bottom edge into an opening parked there, while the top edge passes them all
const APERTURE_FIT_SLACK = 1e-3;

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

const simAperture = {
	y: 400, drive: 0, velocity: 0, friction: 0,
	sizeShare: APERTURE_SIZE, speedShare: APERTURE_SPEED,
	size: simPx(APERTURE_SIZE), speed: simPx(APERTURE_SPEED)
};
// shares are the settings; radius and speed are their live pixel conversion
const simBallConfig = {
	count: BALL_COUNT_DEFAULT, varied: true,
	sizeShare: BALL_SIZE_DEFAULT, speedShare: BALL_SPEED_DEFAULT,
	radius: simPx(BALL_SIZE_DEFAULT), speed: simPx(BALL_SPEED_DEFAULT)
};
// the widest radius the current size setting can produce, so the aperture rules need no ball scan
const simBallRadius = { max: simBallMaxRadius() };

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
let simFrictionEnabled = false;
let simControlHook = null;
let simModeHook = null;
// mode multipliers scale the setting-derived speeds without writing the settings themselves
let simModeSpeed = 1;
let simApertureSpeedScale = 1;
let spawnRate = SPAWN_RATE;
let spawnAcc = 0;
let stepAcc = 0;

function simPx(share) {
	return share * simField.scale / SIM_SHARE;
}

function simShareClamp(value, min, max) {
	return Math.max(min, Math.min(max, Math.round(value)));
}

function simBallMaxRadius() {
	const radius = simBallConfig.radius;
	return simBallConfig.varied ? radius * (1 + BALL_SIZE_VARIETY) : radius;
}

// one place derives every pixel value from its share, so a resize, a boot and a settings change cannot
// disagree about how big the field's parts are
function simApplyShares() {
	simField.wallT = simPx(WALL_SHARE);
	simBallConfig.radius = simPx(simBallConfig.sizeShare);
	simBallConfig.speed = simPx(simBallConfig.speedShare) * simModeSpeed;
	simBallRadius.max = simBallMaxRadius();
	simAperture.size = simPx(simAperture.sizeShare);
	simAperture.speed = simPx(simAperture.speedShare) * simApertureSpeedScale;
}

function simSetFriction(on) {
	simFrictionEnabled = !!on;
	if (!simFrictionEnabled) simAperture.friction = 0;
}

function simSetControlHook(hook) {
	simControlHook = hook;
}

// a mode owns its divider rule and its per-step forces; no hook means the standard field
function simSetModeHook(hook) {
	simModeHook = hook;
}

function simSetModeSpeed(scale) {
	const next = scale > 0 ? scale : 1;
	if (next === simModeSpeed) return false;
	const ratio = next / simModeSpeed;
	simModeSpeed = next;
	simBallConfig.speed *= ratio;
	for (let i = 0; i < simBalls.count; i++) {
		simBalls.vx[i] *= ratio;
		simBalls.vy[i] *= ratio;
	}
	return true;
}

function simSetModeApertureSpeed(scale) {
	const next = scale > 0 ? scale : 1;
	if (next === simApertureSpeedScale) return false;
	simApertureSpeedScale = next;
	simAperture.speed = simPx(simAperture.speedShare) * next;
	return true;
}

// the centre stays put and the hole is pushed back inside the walls, so a big aperture never
// hangs past a corner
function simSetApertureSize(size) {
	const next = simShareClamp(size, APERTURE_SIZE_MIN, APERTURE_SIZE_MAX);
	if (next === simAperture.sizeShare) return false;
	simAperture.sizeShare = next;
	simAperture.size = simPx(next);
	simClampAperture();
	return true;
}

function simClampAperture() {
	const half = simAperture.size / 2;
	if (simAperture.y < half) simAperture.y = half;
	else if (simAperture.y > simField.h - half) simAperture.y = simField.h - half;
}

// The canvas is the field: its CSS size becomes the world size, the divider sits at half of it and the
// field scale follows its area. Positions rescale per axis, so a resize never moves a ball onto the
// other side of the divider or off the screen; radii and velocities follow the scale, so a ball keeps
// its share of the screen instead of its old pixel size and pace.
function simResizeField(width, height) {
	const w = Math.max(FIELD_MIN_W, Math.round(width));
	const h = Math.max(FIELD_MIN_H, Math.round(height));
	if (w === simField.w && h === simField.h) return false;
	const sx = w / simField.w;
	const sy = h / simField.h;
	const grow = Math.sqrt(w * h) / simField.scale;
	simField.w = w;
	simField.h = h;
	simField.wallX = w / 2;
	simField.scale = Math.sqrt(w * h);
	simApplyShares();
	for (let i = 0; i < simBalls.count; i++) {
		simBalls.x[i] *= sx;
		simBalls.y[i] *= sy;
		simBalls.r[i] *= grow;
		simBalls.vx[i] *= grow;
		simBalls.vy[i] *= grow;
		simWallBounce(i);
	}
	simAperture.y *= sy;
	simClampAperture();
	simFillDist();
	return true;
}

function simSetApertureSpeed(speed) {
	const next = simShareClamp(speed, APERTURE_SPEED_MIN, APERTURE_SPEED_MAX);
	if (next === simAperture.speedShare) return false;
	simAperture.speedShare = next;
	simAperture.speed = simPx(next) * simApertureSpeedScale;
	return true;
}

function simSetBallCollisions(on) {
	simBallCollisions = on;
}

function simSetSpawnRate(rate) {
	spawnRate = rate;
}

// The limit keeps the existing field intact; new arrivals fill a raised limit at the scaled spawn rate.
function simSetBallCount(count) {
	const next = Math.max(BALL_COUNT_MIN, Math.min(BALL_CAP, Math.round(count)));
	if (next === simBallConfig.count) return false;
	simBallConfig.count = next;
	if (simBalls.count > next) simBalls.count = next;
	spawnAcc = 0;
	simFillDist();
	return true;
}

// The size setting is the mean radius; the variety setting spreads radii around it, or makes every
// ball the same. Live radii follow immediately, and are kept inside the screen after the change.
function simSetBallSize(size, varied) {
	const next = simShareClamp(size, BALL_SIZE_MIN, BALL_SIZE_MAX);
	const spread = varied === undefined ? simBallConfig.varied : !!varied;
	if (next === simBallConfig.sizeShare && spread === simBallConfig.varied) return false;
	const radius = simPx(next);
	const scale = radius / simBallConfig.radius;
	simBallConfig.sizeShare = next;
	simBallConfig.varied = spread;
	simBallConfig.radius = radius;
	simBallRadius.max = simBallMaxRadius();
	for (let i = 0; i < simBalls.count; i++) {
		simBalls.r[i] *= scale;
		if (!spread) simBalls.r[i] = radius;
		simWallBounce(i);
	}
	return true;
}

function simSetBallSpeed(speed) {
	const next = simShareClamp(speed, BALL_SPEED_MIN, BALL_SPEED_MAX);
	if (next === simBallConfig.speedShare) return false;
	const px = simPx(next) * simModeSpeed;
	const scale = px / simBallConfig.speed;
	simBallConfig.speedShare = next;
	simBallConfig.speed = px;
	for (let i = 0; i < simBalls.count; i++) {
		simBalls.vx[i] *= scale;
		simBalls.vy[i] *= scale;
	}
	return true;
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

function simSpawnRadius() {
	const base = simBallConfig.radius;
	if (!simBallConfig.varied) return base;
	return base * (1 - BALL_SIZE_VARIETY + Math.random() * 2 * BALL_SIZE_VARIETY);
}

function simSpawn() {
	const i = simBalls.count;
	if (i >= simBallConfig.count) return;
	const r = simSpawnRadius();
	const gap = r + simPx(SPAWN_GAP_SHARE);
	let x = 0, y = 0;
	for (let attempt = 0; attempt < 8; attempt++) {
		x = r + Math.random() * (simField.w - 2 * r);
		y = r + Math.random() * (simField.h - 2 * r);
		if (Math.abs(x - simField.wallX) < gap) continue;
		if (!simSpawnOverlaps(x, y, r)) break;
	}
	if (Math.abs(x - simField.wallX) < gap) x = simField.wallX + (x < simField.wallX ? -gap : gap);
	// the spawn band is a ratio of the average speed, so the share it is written in cancels
	const sp = (BALL_V_MIN + Math.random() * (BALL_V_MAX - BALL_V_MIN))
		* simBallConfig.speed / ((BALL_V_MIN + BALL_V_MAX) / 2);
	const ang = Math.random() * Math.PI * 2;
	const p = (Math.random() * PALETTE.length) | 0;
	const sat = BALL_SAT_MIN + Math.random() * (BALL_SAT_MAX - BALL_SAT_MIN);
	const light = BALL_LIGHT_MIN + Math.random() * (BALL_LIGHT_MAX - BALL_LIGHT_MIN);
	const rgb = colorHslToRgb(PALETTE[p][1], sat, light);
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

function simRemoveBall(i) {
	if (i < 0 || i >= simBalls.count) return false;
	const last = simBalls.count - 1;
	if (i !== last) {
		simBalls.x[i] = simBalls.x[last]; simBalls.y[i] = simBalls.y[last];
		simBalls.vx[i] = simBalls.vx[last]; simBalls.vy[i] = simBalls.vy[last];
		simBalls.r[i] = simBalls.r[last]; simBalls.rgb[i] = simBalls.rgb[last];
		simBalls.palette[i] = simBalls.palette[last]; simBalls.css[i] = simBalls.css[last];
		if (typeof territoryState !== 'undefined' && territoryState.hue && territoryState.hueCount > 0) {
			if (i < territoryState.hue.length && last < territoryState.hue.length) {
				territoryState.hue[i] = territoryState.hue[last];
				territoryState.bucket[i] = territoryState.bucket[last];
			}
			if (territoryState.hueCount > simBalls.count) territoryState.hueCount = simBalls.count - 1;
		}
		if (typeof roomsState !== 'undefined' && roomsState.hue && roomsState.hueCount > 0) {
			if (i < roomsState.hue.length && last < roomsState.hue.length) {
				roomsState.hue[i] = roomsState.hue[last];
				roomsState.bucket[i] = roomsState.bucket[last];
			}
			if (roomsState.hueCount > simBalls.count) roomsState.hueCount = simBalls.count - 1;
		}
	} else {
		if (typeof territoryState !== 'undefined' && territoryState.hueCount > 0 && territoryState.hueCount >= simBalls.count) territoryState.hueCount = simBalls.count - 1;
		if (typeof roomsState !== 'undefined' && roomsState.hueCount > 0 && roomsState.hueCount >= simBalls.count) roomsState.hueCount = simBalls.count - 1;
	}
	simBalls.count = last;
	simFillDist();
	return true;
}

// returns the new index, or -1 when the fixed-capacity field is full
function simAddBall(x, y, vx, vy, r, rgb, palette, css) {
	const i = simBalls.count;
	if (i >= BALL_CAP) return -1;
	simBalls.x[i] = x; simBalls.y[i] = y; simBalls.vx[i] = vx; simBalls.vy[i] = vy;
	simBalls.r[i] = r; simBalls.rgb[i] = rgb; simBalls.palette[i] = palette; simBalls.css[i] = css;
	simBalls.count = i + 1;
	simFillDist();
	return i;
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
	simAperture.drive = 0;
	simAperture.velocity = 0;
	simAperture.friction = 0;
	const initial = Math.round(BALL_START_COUNT * simBallConfig.count / BALL_COUNT_DEFAULT);
	for (let k = 0; k < initial; k++) simSpawn();
	simFillDist();
}

// With no inertia, drive balances speed plus optional speed-proportional resistance. Release still stops immediately.
function simMoveAperture(dt) {
	const ap = simAperture;
	const half = ap.size / 2;
	const speed = ap.drive * ap.speed / (simFrictionEnabled ? 1 + APERTURE_FRICTION : 1);
	let y = ap.y + speed * dt;
	if (y < half) y = half;
	else if (y > simField.h - half) y = simField.h - half;
	ap.velocity = dt > 0 ? (y - ap.y) / dt : 0;
	ap.friction = simFrictionEnabled && ap.speed > 0 ? -APERTURE_FRICTION * ap.velocity / ap.speed : 0;
	ap.y = y;
}

function simSpawnTick(dt) {
	spawnAcc += dt * spawnRate * simBallConfig.count / BALL_COUNT_DEFAULT;
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
	// a mode owns the whole divider: gate, colored passages, repaint and reflection
	if (simModeHook && simModeHook.divider && simModeHook.divider(i, y, r, dx)) return;
	const half = simAperture.size / 2;
	if (y - r >= simAperture.y - half - APERTURE_FIT_SLACK && y + r <= simAperture.y + half + APERTURE_FIT_SLACK) return;
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
		if (typeof roomsWallBounce !== 'undefined' && roomsState && roomsState.enabled) roomsWallBounce(i);
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
	if (simControlHook) simControlHook(dt);
	// force prices its requests per fixed step, so catch-up and frame rate cannot change a bill
	simAperture.drive = forceDrive(dt);
	simMoveAperture(dt);
	simSpawnTick(dt);
	if (simModeHook && simModeHook.beforeBalls) simModeHook.beforeBalls(dt);
	for (let i = 0; i < simBalls.count; i++) simMoveBall(i, dt);
	if (simBallCollisions) simCollideBalls();
	if (simModeHook && simModeHook.afterBalls) simModeHook.afterBalls(dt);
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

if (typeof module !== 'undefined') module.exports = {
	simField, simBalls, simAperture, simDist, simBallConfig, simInit, simAdvance, simStep, simSpawn, simFillDist,
	simRemoveBall, simAddBall,
	simSetBallCollisions, simSetSpawnRate, simSetBallCount, simSetBallSpeed, simSetFriction, simSetControlHook,
	simSetModeHook, simSetModeSpeed, simSetModeApertureSpeed,
	simSetApertureSize, simSetApertureSpeed, simResizeField, simSetBallSize, simBallRadius,
	simPx, simApplyShares, SIM_SHARE, WALL_SHARE, SPAWN_GAP_SHARE,
	FIELD_MIN_W, FIELD_MIN_H, BALL_SIZE_MIN, BALL_SIZE_MAX, BALL_SIZE_DEFAULT, BALL_SIZE_VARIETY,
	BALL_CAP, BALL_COUNT_MIN, BALL_COUNT_DEFAULT, BALL_START_COUNT, BALL_V_MIN, BALL_V_MAX,
	BALL_SPEED_MIN, BALL_SPEED_MAX, BALL_SPEED_DEFAULT, APERTURE_FRICTION, FIXED_DT,
	APERTURE_SIZE, APERTURE_SIZE_MIN, APERTURE_SIZE_MAX, APERTURE_SPEED, APERTURE_SPEED_MIN, APERTURE_SPEED_MAX
};
