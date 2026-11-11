// owns: ball-gun mode — gravity ray, target selection, push refusal, predicted path and its view/HUD
// edit for: ray falloff, push cap, forecast budget, cue colors

const GUN_X_SHARE = 0.75;
const GUN_PATH_POINTS = 10;
const GUN_PASS_POINTS = 6;
const GUN_PULL_REACH_SHARE = 520;
const GUN_PULL_ACC_SHARE = 1200;
const GUN_BEAM_SHARE = 90;
const GUN_PUSH_SHARE = 150;
const GUN_FORECAST_REACH_SHARE = 1500;
const GUN_SPEED_CAP = 3;
const GUN_STORE_CAP = 3;
const GUN_CAPTURE_SHARE = 24;
const GUN_SELECT_CSS = '#ffe27a';
const GUN_PASS_CSS = '#a8d3ff';
const GUN_PREDICT_CSS = '#7fe3c0';
const GUN_REFUSE_CSS = '#ff7a7a';
const GUN_TARGET_CSS = '#ffe27a';

const gunState = {
	x: 0, y: 0, aimX: 0, aimY: 0, ux: 0, uy: 1, aimLen: 0,
	pull: 0, target: -1, refused: 0, push: 0, lastW: 0, lastH: 0,
	stored: 0,
	storeR: new Float32Array(GUN_STORE_CAP),
	storeRgb: new Uint32Array(GUN_STORE_CAP),
	storePalette: new Uint8Array(GUN_STORE_CAP),
	storeCss: new Array(GUN_STORE_CAP)
};
const gunPath = {
	n: 0,
	x: new Float32Array(GUN_PATH_POINTS),
	y: new Float32Array(GUN_PATH_POINTS),
	end: TRAJ_NONE,
	dist: 0,
	side: 0
};
const gunUi = { hud: null, target: null, stored: null, push: null, state: null };
const gunHudCache = { target: -2, stored: -2, push: -2, state: -2 };
const GUN_STATE_TEXT = ['ready · left click launches the oldest stored ball', 'pulling', 'launch refused · change aim', 'store full · left click launches', 'middle hold pulls a ball into the gun'];

function gunHudInit() {
	gunUi.hud = $('gun-hud');
	gunUi.target = $('gun-target');
	gunUi.stored = $('gun-stored');
	gunUi.push = $('gun-push');
	gunUi.state = $('gun-state');
	gunHudCache.target = -2;
	gunHudCache.stored = -2;
	gunHudCache.push = -2;
	gunHudCache.state = -2;
}

function gunInit() {
	gunState.x = simField.w * GUN_X_SHARE;
	gunState.y = 0;
	gunState.aimX = simField.wallX;
	gunState.aimY = simField.h * 0.5;
	gunState.lastW = simField.w;
	gunState.lastH = simField.h;
	gunState.stored = 0;
	gunRelease();
	gunUpdateAim();
	gunHudInit();
}

function gunRelease() {
	gunState.pull = 0;
	gunState.target = -1;
	gunState.refused = 0;
}

function gunResize() {
	if (!gunState.lastW || !gunState.lastH) return;
	const sx = simField.w / gunState.lastW;
	const sy = simField.h / gunState.lastH;
	gunState.x *= sx;
	gunState.y *= sy;
	gunState.aimX *= sx;
	gunState.aimY *= sy;
	gunState.lastW = simField.w;
	gunState.lastH = simField.h;
	gunUpdateAim();
}

function gunSetAim(x, y) {
	gunState.aimX = x;
	gunState.aimY = y;
	gunState.refused = 0;
	gunUpdateAim();
}

function gunUpdateAim() {
	const dx = gunState.aimX - gunState.x;
	const dy = gunState.aimY - gunState.y;
	const len = Math.sqrt(dx * dx + dy * dy);
	gunState.aimLen = len;
	if (len < 1e-6) { gunState.ux = 0; gunState.uy = 1; return; }
	gunState.ux = dx / len;
	gunState.uy = dy / len;
}

function gunRayReach() { return simPx(GUN_PULL_REACH_SHARE); }
function gunRayBeam() { return simPx(GUN_BEAM_SHARE); }
function gunRayCap() { return simPx(GUN_PULL_ACC_SHARE); }

// smooth monotone falloff in along-ray distance and aim error, zero at the bounded reach
function gunPullAccel(t, perp) {
	const reach = gunRayReach();
	if (t <= 0 || t >= reach) return 0;
	const along = reach * 0.45;
	const beam = gunRayBeam();
	const fade = 1 - t / reach;
	return gunRayCap() / (1 + (t / along) * (t / along))
		/ (1 + (perp / beam) * (perp / beam)) * fade * fade;
}

function gunPushStrength() {
	return Math.min(simPx(GUN_PUSH_SHARE), gunState.aimLen * 0.5);
}

function gunUpdateTarget() {
	const reach = gunRayReach();
	const beam = gunRayBeam();
	const gx = gunState.x;
	const gy = gunState.y;
	let best = Infinity;
	let target = -1;
	for (let i = 0; i < simBalls.count; i++) {
		const dx = simBalls.x[i] - gx;
		const dy = simBalls.y[i] - gy;
		const t = dx * gunState.ux + dy * gunState.uy;
		if (t <= 0 || t >= reach) continue;
		const perp = Math.abs(dx * gunState.uy - dy * gunState.ux);
		if (perp >= beam) continue;
		const score = perp + t * 0.12;
		if (score >= best) continue;
		best = score;
		target = i;
	}
	gunState.target = target;
}

function gunClampSpeed(i) {
	const max = simBallConfig.speed * GUN_SPEED_CAP;
	const vx = simBalls.vx[i];
	const vy = simBalls.vy[i];
	const speed = Math.sqrt(vx * vx + vy * vy);
	if (speed <= max) return;
	const scale = max / speed;
	simBalls.vx[i] = vx * scale;
	simBalls.vy[i] = vy * scale;
}

function gunCaptureReach(r) { return r + simPx(GUN_CAPTURE_SHARE); }

function gunCapture(i) {
	if (gunState.stored >= GUN_STORE_CAP || i < 0 || i >= simBalls.count) return false;
	const k = gunState.stored;
	gunState.storeR[k] = simBalls.r[i];
	gunState.storeRgb[k] = simBalls.rgb[i];
	gunState.storePalette[k] = simBalls.palette[i];
	gunState.storeCss[k] = simBalls.css[i];
	if (!simRemoveBall(i)) return false;
	gunState.stored = k + 1;
	gunState.target = -1;
	return true;
}

function gunLaunchBall() {
	const r = gunState.storeR[0];
	const gap = simPx(GUN_CAPTURE_SHARE);
	const i = simAddBall(
		gunState.x + gunState.ux * (r + gap), gunState.y + gunState.uy * (r + gap),
		gunState.ux * gunState.push, gunState.uy * gunState.push,
		r, gunState.storeRgb[0], gunState.storePalette[0], gunState.storeCss[0]);
	if (i < 0) return -1;
	for (let k = 1; k < gunState.stored; k++) {
		gunState.storeR[k - 1] = gunState.storeR[k];
		gunState.storeRgb[k - 1] = gunState.storeRgb[k];
		gunState.storePalette[k - 1] = gunState.storePalette[k];
		gunState.storeCss[k - 1] = gunState.storeCss[k];
	}
	gunState.stored--;
	return i;
}

function gunApplyPull(dt) {
	const i = gunState.target;
	if (!gunState.pull || gunState.stored >= GUN_STORE_CAP || i < 0 || i >= simBalls.count) return;
	const dx = simBalls.x[i] - gunState.x;
	const dy = simBalls.y[i] - gunState.y;
	const t = dx * gunState.ux + dy * gunState.uy;
	const perp = Math.abs(dx * gunState.uy - dy * gunState.ux);
	const accel = gunPullAccel(t, perp);
	if (accel <= 0) return;
	const dist = Math.sqrt(dx * dx + dy * dy) || 1;
	simBalls.vx[i] -= dx / dist * accel * dt;
	simBalls.vy[i] -= dy / dist * accel * dt;
	gunClampSpeed(i);
}

function gunStep(dt) {
	gunUpdateTarget();
	gunState.push = gunPushStrength();
	gunApplyPull(dt);
	const i = gunState.target;
	if (!gunState.pull || i < 0 || i >= simBalls.count) return;
	const dx = simBalls.x[i] - gunState.x;
	const dy = simBalls.y[i] - gunState.y;
	// a pulled ball that reaches the muzzle is consumed into the store, never bounced off the gun
	if (dx * dx + dy * dy <= gunCaptureReach(simBalls.r[i]) * gunCaptureReach(simBalls.r[i])) gunCapture(i);
}

// the hole's live velocity shifts the opening over the flight to the divider, so a moving hole
// refuses the same push the player would see fail
function gunPredict() {
	gunState.push = gunPushStrength();
	if (!gunState.stored || gunState.push <= 0) {
		gunPath.n = 0;
		gunPath.end = TRAJ_NONE;
		return TRAJ_NONE;
	}
	const r = gunState.storeR[0];
	const gap = simPx(GUN_CAPTURE_SHARE);
	const x = gunState.x + gunState.ux * (r + gap);
	const y = gunState.y + gunState.uy * (r + gap);
	const vx = gunState.ux * gunState.push;
	const vy = gunState.uy * gunState.push;
	const speed = Math.sqrt(vx * vx + vy * vy) || 1;
	let end = trajTrace(x, y, vx, vy, r, Infinity, gunPath, -1, GUN_PATH_POINTS, 0);
	if (end === TRAJ_NONE) return end;
	const shift = simAperture.velocity * gunPath.dist / speed;
	return trajTrace(x, y, vx, vy, r, Infinity, gunPath, -1, GUN_PATH_POINTS, shift);
}

function gunPush() {
	if (!gunState.stored) { gunState.refused = 0; return; }
	const end = gunPredict();
	gunState.refused = end === TRAJ_PASS || gunState.push <= 0 ? 1 : 0;
	if (gunState.refused) return;
	gunLaunchBall();
}

function gunHudPaint() {
	const target = gunState.target < 0 ? -1 : gunState.target + 1;
	const push = Math.round(gunState.push / simField.scale * 1000);
	const stored = gunState.stored;
	if (gunHudCache.stored !== stored) {
		gunHudCache.stored = stored;
		gunUi.stored.textContent = stored + ' / ' + GUN_STORE_CAP;
	}
	const state = gunState.refused ? 2 : (gunState.pull ? 1
		: (stored >= GUN_STORE_CAP ? 3 : (stored ? 0 : 4)));
	if (gunHudCache.target !== target) {
		gunHudCache.target = target;
		gunUi.target.textContent = target < 0 ? 'no ball' : 'ball ' + target;
	}
	if (gunHudCache.push !== push) {
		gunHudCache.push = push;
		gunUi.push.textContent = push + ' ‰/s push';
	}
	if (gunHudCache.state === state) return;
	gunHudCache.state = state;
	gunUi.state.textContent = GUN_STATE_TEXT[state];
}

const gunInput = {
	keys: false,
	aim(x, y) { gunSetAim(x, y); },
	pull(on) { gunState.pull = on ? 1 : 0; },
	push() { gunPush(); },
	key() {},
	cancel() { gunRelease(); }
};

function gunDrawOverlay(ctx) {
	const s = gunState;
	const radius = simField.wallT * 1.1;
	ctx.setLineDash([7, 7]);
	ctx.globalAlpha = s.pull ? 0.75 : 0.35;
	ctx.strokeStyle = GUN_SELECT_CSS;
	ctx.lineWidth = s.pull ? 3 : 1.5;
	ctx.beginPath();
	ctx.moveTo(s.x, s.y);
	ctx.lineTo(s.x + s.ux * gunRayReach(), s.y + s.uy * gunRayReach());
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.globalAlpha = 1;
	ctx.fillStyle = GUN_SELECT_CSS;
	ctx.beginPath();
	ctx.arc(s.x, s.y + radius, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#12151b';
	ctx.lineWidth = 2;
	ctx.stroke();
	for (let k = 0; k < s.stored; k++) {
		ctx.fillStyle = s.storeCss[k];
		ctx.beginPath();
		ctx.arc(s.x + (k - (s.stored - 1) / 2) * radius * 2.4, s.y + radius * 2.6,
			Math.min(s.storeR[k], radius), 0, Math.PI * 2);
		ctx.fill();
		ctx.stroke();
	}
	const i = s.target;
	if (i >= 0 && i < simBalls.count) {
		ctx.strokeStyle = s.refused ? GUN_REFUSE_CSS : GUN_TARGET_CSS;
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.arc(simBalls.x[i], simBalls.y[i], simBalls.r[i] + 5, 0, Math.PI * 2);
		ctx.stroke();
	}
	gunPredict();
	if (gunPath.n < 2) return;
	ctx.setLineDash(FORECAST_DASH);
	ctx.lineWidth = 2.5;
	canvasStrokeForecast(ctx, gunPath, s.refused ? GUN_REFUSE_CSS : GUN_PREDICT_CSS);
	ctx.setLineDash([]);
}

const gunView = {
	resize: gunResize,
	overlay: gunDrawOverlay,
	forecast(i, end) {
		if (i === gunState.target || end === TRAJ_PASS) return 2;
		return 0;
	},
	forecastCss(i) { return i === gunState.target ? GUN_SELECT_CSS : GUN_PASS_CSS; },
	forecastReach() { return simPx(GUN_FORECAST_REACH_SHARE); },
	forecastBudget(i) { return i === gunState.target ? GUN_PATH_POINTS : GUN_PASS_POINTS; }
};

if (typeof module !== 'undefined') module.exports = {
	gunState, gunPath, gunInit, gunRelease, gunResize, gunSetAim, gunStep, gunPush, gunPredict,
	gunPullAccel, gunPushStrength, gunHudPaint, gunInput, gunView, gunCapture,
	GUN_PASS_POINTS, GUN_PUSH_SHARE, GUN_STORE_CAP
};
