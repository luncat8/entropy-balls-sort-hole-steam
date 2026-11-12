// owns: ball-gun mode — gravity ray, target selection, push refusal, predicted path and its view/HUD
// edit for: ray falloff, push cap, forecast budget, cue colors

const GUN_X_SHARE = 0.75;
const GUN_PATH_POINTS = 10;
const GUN_PASS_POINTS = 6;
const GUN_PULL_REACH_SHARE = 520;
const GUN_PULL_ACC_SHARE = 2880;
const GUN_BEAM_SHARE = 90;
const GUN_PUSH_SHARE = 720;
// the aim distance sets the launch speed up to the cap; cap and slope are both 4x the first tuning,
// so a launch is 4x faster across the whole cursor range, not only at full reach
const GUN_PUSH_SLOPE = 2;
const GUN_FORECAST_REACH_SHARE = 1500;
// pulled balls reach this multiple of the base ball speed almost at once, so the cap — not the
// acceleration — is what a player feels as the pull strength; pull is 2x, so the cap is 2x
const GUN_SPEED_CAP = 6;
const GUN_STORE_CAP = 3;
const GUN_CAPTURE_SHARE = 24;
const GUN_FORCE_STEP = 5;
const GUN_FORCE_START = 60;
const GUN_ENERGY_PUSH_COST = 8;
const GUN_SELECT_CSS = '#ffe27a';
const GUN_PASS_CSS = '#a8d3ff';
const GUN_PREDICT_CSS = '#7fe3c0';
const GUN_REFUSE_CSS = '#ff7a7a';
const GUN_TARGET_CSS = '#ffe27a';
const GUN_RAY_DASH = [7, 7];

const gunState = {
	x: 0, y: 0, aimX: 0, aimY: 0, ux: 0, uy: 1, aimLen: 0,
	pull: 0, target: -1, refused: 0, push: 0, lastW: 0, lastH: 0,
	stored: 0, force: GUN_FORCE_START, energy: FORCE_CAPACITY, energyCap: FORCE_CAPACITY, energyCost: FORCE_COST,
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
const gunUi = { hud: null, target: null, stored: null, push: null, state: null, force: null, energy: null, energyBar: null };
const gunHudCache = { target: -2, stored: -2, push: -2, state: -2, force: -2, energy: -2 };
const GUN_STATE_TEXT = ['ready · left click launches the oldest stored ball', 'pulling', 'launch refused · change aim', 'store full · left click launches', 'middle hold pulls a ball into the gun'];

function gunHudInit() {
	gunUi.hud = $('gun-hud');
	gunUi.target = $('gun-target');
	gunUi.stored = $('gun-stored');
	gunUi.push = $('gun-push');
	gunUi.state = $('gun-state');
	gunUi.force = $('gun-force');
	gunUi.energy = $('gun-energy');
	gunUi.energyBar = $('gun-energy-bar');
	gunHudCache.target = -2;
	gunHudCache.stored = -2;
	gunHudCache.push = -2;
	gunHudCache.state = -2;
	gunHudCache.force = -2;
	gunHudCache.energy = -2;
}

function gunSyncEnergy() {
	gunState.energyCap = forceCapacity;
	gunState.energyCost = forceCost;
	if (gunState.energy > gunState.energyCap) gunState.energy = gunState.energyCap;
}

function gunSetForce(force) {
	let next = Math.round(force / GUN_FORCE_STEP) * GUN_FORCE_STEP;
	if (next < 0) next = 0; else if (next > 100) next = 100;
	gunState.force = next;
}

function gunWheel(deltaY) {
	if (!deltaY) return;
	gunSetForce(gunState.force + (deltaY > 0 ? -GUN_FORCE_STEP : GUN_FORCE_STEP));
}

function gunRecharge(dt) {
	gunSyncEnergy();
	const recharge = gunState.energyCap * FORCE_RECHARGE_SHARE * dt;
	gunState.energy += recharge;
	if (gunState.energy > gunState.energyCap) gunState.energy = gunState.energyCap;
}

function gunInit() {
	gunState.x = simField.w * GUN_X_SHARE;
	gunState.y = 0;
	gunState.aimX = simField.wallX;
	gunState.aimY = simField.h * 0.5;
	gunState.lastW = simField.w;
	gunState.lastH = simField.h;
	gunState.stored = 0;
	gunState.force = GUN_FORCE_START;
	gunSyncEnergy();
	gunState.energy = gunState.energyCap;
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

function gunForceShare() {
	if (gunState.force <= 0) return 0;
	return gunState.force / 100;
}

function gunPullAccel(t, perp) {
	const reach = gunRayReach();
	if (t <= 0 || t >= reach) return 0;
	const along = reach * 0.45;
	const beam = gunRayBeam();
	const fade = 1 - t / reach;
	return gunRayCap() * gunForceShare() / (1 + (t / along) * (t / along))
		/ (1 + (perp / beam) * (perp / beam)) * fade * fade;
}

function gunPushStrength() {
	const cap = simPx(GUN_PUSH_SHARE);
	const base = Math.min(cap, gunState.aimLen * GUN_PUSH_SLOPE);
	return base * gunForceShare();
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
	const pushCost = GUN_ENERGY_PUSH_COST * gunForceShare();
	if (gunState.energy < pushCost) { gunState.refused = 1; return -1; }
	const i = simAddBall(
		gunState.x + gunState.ux * (r + gap), gunState.y + gunState.uy * (r + gap),
		gunState.ux * gunState.push, gunState.uy * gunState.push,
		r, gunState.storeRgb[0], gunState.storePalette[0], gunState.storeCss[0]);
	if (i < 0) return -1;
	simArmBall(i); // plan 3.2: fired balls carry the aura until hole crossing, 20s, or 4 bounces
	gunState.energy -= pushCost;
	if (gunState.energy < 0) gunState.energy = 0;
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
	if (gunState.energy <= 0) return;
	const cost = gunState.energyCost * gunForceShare() * dt;
	if (cost > gunState.energy) return;
	gunState.energy -= cost;
	if (gunState.energy < 0) gunState.energy = 0;
	const dist = Math.sqrt(dx * dx + dy * dy) || 1;
	simBalls.vx[i] -= dx / dist * accel * dt;
	simBalls.vy[i] -= dy / dist * accel * dt;
	gunClampSpeed(i);
}

function gunStep(dt) {
	gunRecharge(dt);
	gunUpdateTarget();
	gunState.push = gunPushStrength();
	gunApplyPull(dt);
	const i = gunState.target;
	if (!gunState.pull || i < 0 || i >= simBalls.count) return;
	const dx = simBalls.x[i] - gunState.x;
	const dy = simBalls.y[i] - gunState.y;
	if (dx * dx + dy * dy <= gunCaptureReach(simBalls.r[i]) * gunCaptureReach(simBalls.r[i])) gunCapture(i);
}

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
	const pushCost = GUN_ENERGY_PUSH_COST * gunForceShare();
	if (pushCost > 0 && gunState.energy < pushCost) { gunState.refused = 1; return; }
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
	if (gunHudCache.state === state) {
		// fall through to force/energy update
	} else {
		gunHudCache.state = state;
		gunUi.state.textContent = GUN_STATE_TEXT[state];
	}
	const force = gunState.force;
	if (gunHudCache.force !== force) {
		gunHudCache.force = force;
		if (gunUi.force) gunUi.force.textContent = force + '% force · wheel';
	}
	const energy = Math.round(gunState.energy);
	if (gunHudCache.energy !== energy) {
		gunHudCache.energy = energy;
		if (gunUi.energy) gunUi.energy.textContent = energy + ' / ' + Math.round(gunState.energyCap) + ' energy';
		if (gunUi.energyBar) gunUi.energyBar.style.width = (gunState.energyCap > 0 ? Math.round(gunState.energy / gunState.energyCap * 100) : 0) + '%';
	}
}

const gunInput = {
	keys: false,
	aim(x, y) { gunSetAim(x, y); },
	pull(on) { gunState.pull = on ? 1 : 0; },
	push() { gunPush(); },
	key() {},
	wheel(deltaY) { gunWheel(deltaY); },
	cancel() { gunRelease(); }
};

function gunDrawOverlay(ctx) {
	const s = gunState;
	const radius = simField.wallT * 1.1;
	const forceScale = s.force / 100;
	ctx.setLineDash(GUN_RAY_DASH);
	ctx.globalAlpha = s.pull ? 0.35 + forceScale * 0.45 : 0.18 + forceScale * 0.22;
	ctx.strokeStyle = GUN_SELECT_CSS;
	ctx.lineWidth = 1 + forceScale * 2.5 + (s.pull ? 0.8 : 0);
	ctx.beginPath();
	ctx.moveTo(s.x, s.y);
	ctx.lineTo(s.x + s.ux * gunRayReach(), s.y + s.uy * gunRayReach());
	ctx.stroke();
	ctx.setLineDash(FORECAST_SOLID);
	ctx.globalAlpha = 1;
	ctx.fillStyle = GUN_SELECT_CSS;
	ctx.beginPath();
	ctx.arc(s.x, s.y + radius, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#12151b';
	ctx.lineWidth = 2;
	ctx.stroke();
	// force indicator ring thickness and energy bar
	ctx.strokeStyle = GUN_SELECT_CSS;
	ctx.lineWidth = 1.2 + forceScale * 1.8;
	ctx.globalAlpha = 0.9;
	ctx.beginPath();
	ctx.arc(s.x, s.y + radius, radius + 3, -Math.PI/2, -Math.PI/2 + Math.PI*2*forceScale);
	ctx.stroke();
	ctx.globalAlpha = 1;
	const barW = radius * 2.2;
	const barH = 4;
	const barX = s.x - barW/2;
	const barY = s.y + radius + 6;
	ctx.fillStyle = '#0b1119';
	ctx.fillRect(barX, barY, barW, barH);
	ctx.fillStyle = s.energy < s.energyCap * 0.25 ? '#ff7a7a' : '#7fe3c0';
	ctx.fillRect(barX, barY, barW * (s.energyCap > 0 ? s.energy / s.energyCap : 0), barH);
	ctx.strokeStyle = '#445263';
	ctx.lineWidth = 0.8;
	ctx.strokeRect(barX, barY, barW, barH);
	for (let k = 0; k < s.stored; k++) {
		ctx.fillStyle = s.storeCss[k];
		ctx.beginPath();
		ctx.arc(s.x + (k - (s.stored - 1) / 2) * s.storeR[k] * 1.1, s.y + radius * 2.6,
			s.storeR[k], 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#12151b';
		ctx.lineWidth = 1;
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
	ctx.setLineDash(FORECAST_SOLID);
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
	gunPullAccel, gunPushStrength, gunHudPaint, gunInput, gunView, gunCapture, gunWheel, gunSetForce, gunRecharge, gunForceShare,
	GUN_PASS_POINTS, GUN_PUSH_SHARE, GUN_STORE_CAP, GUN_FORCE_STEP, GUN_FORCE_START
};
