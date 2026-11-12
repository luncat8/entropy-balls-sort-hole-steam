// owns: territory mode rules — guns, wall divider contact, room tint and simulation/trajectory hooks
// edit for: gun reach/forces, gate size, seed, passage and capture rules

const TERRITORY_GATE_SHARE = 120;
const TERRITORY_SEED_SPAN = 0.09;
const TERRITORY_ROOM_RATE = 110;
const TERRITORY_PULL_REACH_SHARE = 420;
const TERRITORY_PULL_ACC_SHARE = 2160;
const TERRITORY_BEAM_SHARE = 80;
const TERRITORY_PUSH_SHARE = 624;
const TERRITORY_PUSH_SLOPE = 2;
const TERRITORY_GUN_MOVE_SHARE = 230;
// a pulled ball is at the cap within a frame, so the cap is the pull strength a player feels (gun.js: 2x)
const TERRITORY_SPEED_CAP = 6;
const TERRITORY_CAPTURE_SHARE = 24;
const TERRITORY_STORE_CAP = 3;
const TERRITORY_FORCE_STEP = 5;
const TERRITORY_FORCE_START = 60;
const TERRITORY_PUSH_COST = 8;

const territoryState = {
	hue: null,
	bucket: null,
	hueCount: 0,
	gate: 0,
	wallH: 1,
	roomsOn: true,
	highlightOwner: 0,
	rand: 0
};
const territoryGuns = [
	{ y: 0, aimX: 0, aimY: 0, ux: -1, uy: 0, aimLen: 0, pull: 0, target: -1, up: 0, down: 0, move: 0, force: TERRITORY_FORCE_START, energy: FORCE_CAPACITY, energyCap: FORCE_CAPACITY, energyCost: FORCE_COST, stored: 0, storeR: null, storeRgb: null, storePalette: null, storeCss: null },
	{ y: 0, aimX: 0, aimY: 0, ux: 1, uy: 0, aimLen: 0, pull: 0, target: -1, up: 0, down: 0, move: 0, force: TERRITORY_FORCE_START, energy: FORCE_CAPACITY, energyCap: FORCE_CAPACITY, energyCost: FORCE_COST, stored: 0, storeR: null, storeRgb: null, storePalette: null, storeCss: null }
];
for (let id = 0; id < 2; id++) {
	territoryGuns[id].storeR = new Float32Array(TERRITORY_STORE_CAP);
	territoryGuns[id].storeRgb = new Uint32Array(TERRITORY_STORE_CAP);
	territoryGuns[id].storePalette = new Uint8Array(TERRITORY_STORE_CAP);
	territoryGuns[id].storeCss = new Array(TERRITORY_STORE_CAP);
}
const territoryAperture = { y: 0, size: 0 };

function territoryRand() {
	territoryState.rand = (Math.imul(territoryState.rand, 1664525) + 1013904223) >>> 0;
	return territoryState.rand / 4294967296;
}

function territoryGateBottom() {
	return Math.min(simPx(TERRITORY_GATE_SHARE), simField.h * 0.22);
}

function territoryUpdateAperture() {
	territoryAperture.y = territoryState.gate / 2;
	territoryAperture.size = territoryState.gate;
}

function territoryGunX(id) {
	return simField.wallX + (id === 0 ? -simField.wallT / 2 : simField.wallT / 2);
}

function territoryOwnerOfGun(id) {
	return id === 0 ? MODE_RED : MODE_BLUE;
}

function territoryHuesInit() {
	const cap = simBalls.x.length;
	if (!territoryState.hue || territoryState.hue.length < cap) {
		territoryState.hue = new Float32Array(cap);
		territoryState.bucket = new Int16Array(cap);
	}
	territoryState.hueCount = 0;
}

function territoryEnsureHues() {
	if (territoryState.hueCount > simBalls.count) territoryState.hueCount = simBalls.count;
	for (let i = territoryState.hueCount; i < simBalls.count; i++) {
		const hue = colorRgbHue(simBalls.rgb[i]);
		territoryState.hue[i] = hue;
		territoryState.bucket[i] = hue | 0;
	}
	territoryState.hueCount = simBalls.count;
}

function territoryRemoveBall(i, last) {
	if (!territoryState.hue || territoryState.hueCount <= 0) return;
	if (i !== last && i < territoryState.hueCount) {
		const hue = last < territoryState.hueCount ? territoryState.hue[last] : colorRgbHue(simBalls.rgb[last]);
		territoryState.hue[i] = hue;
		territoryState.bucket[i] = hue | 0;
	}
	if (territoryState.hueCount > last) territoryState.hueCount = last;
}

function territoryBallOwner(i) {
	return modeColorOwner(territoryState.hue[i]);
}

function territorySetRooms(on) {
	territoryState.roomsOn = !!on;
	if (typeof roomsSetEnabled !== 'undefined') roomsSetEnabled(territoryState.roomsOn);
}

function territorySyncEnergy() {
	for (let id = 0; id < 2; id++) {
		const g = territoryGuns[id];
		g.energyCap = forceCapacity;
		g.energyCost = forceCost;
		if (g.energy > g.energyCap) g.energy = g.energyCap;
	}
}

function territorySetForce(id, force) {
	if (id < 0 || id > 1) return;
	let next = Math.round(force / TERRITORY_FORCE_STEP) * TERRITORY_FORCE_STEP;
	if (next < 0) next = 0; else if (next > 100) next = 100;
	territoryGuns[id].force = next;
}

function territoryWheel(deltaY) {
	if (!deltaY) return;
	const step = deltaY > 0 ? -TERRITORY_FORCE_STEP : TERRITORY_FORCE_STEP;
	for (let id = 0; id < 2; id++) territorySetForce(id, territoryGuns[id].force + step);
}

function territoryRecharge(dt) {
	territorySyncEnergy();
	for (let id = 0; id < 2; id++) {
		const g = territoryGuns[id];
		const recharge = g.energyCap * FORCE_RECHARGE_SHARE * dt;
		g.energy += recharge;
		if (g.energy > g.energyCap) g.energy = g.energyCap;
	}
}

function territoryInit() {
	modecolorInit();
	territoryHuesInit();
	territoryState.rand = 0x2f6b1d;
	territoryState.gate = territoryGateBottom();
	territoryState.wallH = simField.h - territoryState.gate;
	territoryUpdateAperture();
	territoryPaintInit(territoryState.gate, territoryState.wallH);
	const seedH = territoryState.wallH * TERRITORY_SEED_SPAN;
	const redY = territoryState.gate + territoryState.wallH * (0.25 + 0.10 * territoryRand());
	const blueY = territoryState.gate + territoryState.wallH * (0.62 + 0.10 * territoryRand());
	territoryPaintSeed(MODE_RED, redY - seedH / 2, redY + seedH / 2);
	territoryPaintSeed(MODE_BLUE, blueY - seedH / 2, blueY + seedH / 2);
	territoryGuns[0].y = redY;
	territoryGuns[1].y = blueY;
	for (let id = 0; id < 2; id++) {
		territoryGuns[id].force = TERRITORY_FORCE_START;
		territorySyncEnergy();
		territoryGuns[id].energy = territoryGuns[id].energyCap;
		territoryGuns[id].stored = 0;
	}
	territoryRelease();
	territoryEnsureHues();
	territoryHudInit();
	territoryUpdateGuns();
	if (typeof roomsInit !== 'undefined') { roomsInit(); roomsSetEnabled(territoryState.roomsOn); }
}

function territoryRelease() {
	for (let id = 0; id < 2; id++) {
		const g = territoryGuns[id];
		g.pull = 0;
		g.target = -1;
		g.up = 0;
		g.down = 0;
		g.move = 0;
	}
}

function territoryResize() {
	const oldTop = territoryState.gate;
	const oldH = territoryState.wallH;
	const gate = territoryGateBottom();
	const wallH = simField.h - gate;
	if (oldH <= 0) return;
	const ratio = wallH / oldH;
	territoryPaintRescale(gate, wallH);
	for (let id = 0; id < 2; id++) territoryGuns[id].y = gate + (territoryGuns[id].y - oldTop) * ratio;
	territoryState.gate = gate;
	territoryState.wallH = wallH;
	territoryUpdateAperture();
	for (let id = 0; id < 2; id++) territoryClampGun(id);
	if (typeof roomsResize !== 'undefined') roomsResize();
}

function territoryClampGun(id) {
	const g = territoryGuns[id];
	const span = territoryPaintSpan(territoryOwnerOfGun(id), g.y);
	const pad = simField.wallT * 0.5;
	if (span.hi - span.lo <= 2 * pad) g.y = (span.lo + span.hi) / 2;
	else g.y = Math.max(span.lo + pad, Math.min(span.hi - pad, g.y));
}

function territoryUpdateAim(id) {
	const g = territoryGuns[id];
	const gx = territoryGunX(id);
	if (id === 1) {
		g.aimX = simField.wallX + simField.w * 0.28;
		g.aimY = g.y;
	}
	let dx = g.aimX - gx;
	let dy = g.aimY - g.y;
	const len = Math.sqrt(dx * dx + dy * dy);
	if (len < 1e-6) { dx = id === 0 ? -1 : 1; dy = 0; }
	else { dx /= len; dy /= len; }
	g.ux = dx;
	g.uy = dy;
	g.aimLen = len;
}

function territoryRayReach() { return simPx(TERRITORY_PULL_REACH_SHARE); }
function territoryRayBeam() { return simPx(TERRITORY_BEAM_SHARE); }
function territoryRayCap() { return simPx(TERRITORY_PULL_ACC_SHARE); }

function territoryForceShare(id) {
	const f = territoryGuns[id].force;
	return f <= 0 ? 0 : f / 100;
}

function territoryPushBase(g) {
	return Math.min(simPx(TERRITORY_PUSH_SHARE), g.aimLen * TERRITORY_PUSH_SLOPE);
}

function territoryPullAccel(t, perp, id) {
	const reach = territoryRayReach();
	if (t <= 0 || t >= reach) return 0;
	const along = reach * 0.45;
	const beam = territoryRayBeam();
	const fade = 1 - t / reach;
	const share = id !== undefined ? territoryForceShare(id) : 1;
	return territoryRayCap() * share / (1 + (t / along) * (t / along))
		/ (1 + (perp / beam) * (perp / beam)) * fade * fade;
}

function territoryUpdateTarget(id) {
	const g = territoryGuns[id];
	const gx = territoryGunX(id);
	const gy = g.y;
	const reach = territoryRayReach();
	const beam = territoryRayBeam();
	let best = Infinity;
	let target = -1;
	for (let i = 0; i < simBalls.count; i++) {
		if (territoryBallOwner(i) !== MODE_NONE) continue;
		const dx = simBalls.x[i] - gx;
		const dy = simBalls.y[i] - gy;
		const t = dx * g.ux + dy * g.uy;
		if (t <= 0 || t >= reach) continue;
		const perp = Math.abs(dx * g.uy - dy * g.ux);
		if (perp >= beam) continue;
		const score = perp + t * 0.15;
		if (score >= best) continue;
		best = score;
		target = i;
	}
	g.target = target;
}

function territoryClampSpeed(i) {
	const max = simBallConfig.speed * TERRITORY_SPEED_CAP;
	const vx = simBalls.vx[i];
	const vy = simBalls.vy[i];
	const speed = Math.sqrt(vx * vx + vy * vy);
	if (speed <= max) return;
	const scale = max / speed;
	simBalls.vx[i] = vx * scale;
	simBalls.vy[i] = vy * scale;
}

function territoryCaptureReach(r) { return r + simPx(TERRITORY_CAPTURE_SHARE); }

function territoryCapture(id, i) {
	const g = territoryGuns[id];
	if (g.stored >= TERRITORY_STORE_CAP || i < 0 || i >= simBalls.count) return false;
	if (territoryBallOwner(i) !== MODE_NONE) return false;
	const k = g.stored;
	g.storeR[k] = simBalls.r[i];
	g.storeRgb[k] = simBalls.rgb[i];
	g.storePalette[k] = simBalls.palette[i];
	g.storeCss[k] = simBalls.css[i];
	if (!simRemoveBall(i)) return false;
	g.stored = k + 1;
	g.target = -1;
	return true;
}

function territoryTryCaptureMuzzle(id, i) {
	const g = territoryGuns[id];
	if (g.stored >= TERRITORY_STORE_CAP || i < 0 || i >= simBalls.count) return false;
	const dx = simBalls.x[i] - territoryGunX(id);
	const dy = simBalls.y[i] - g.y;
	const reach = territoryCaptureReach(simBalls.r[i]);
	if (dx * dx + dy * dy <= reach * reach) return territoryCapture(id, i);
	return false;
}

function territoryLaunchBall(id) {
	const g = territoryGuns[id];
	if (g.stored <= 0) return -1;
	const pushCost = TERRITORY_PUSH_COST * territoryForceShare(id);
	if (pushCost > 0 && g.energy < pushCost) return -1;
	const r = g.storeR[0];
	const gap = simPx(TERRITORY_CAPTURE_SHARE);
	const gx = territoryGunX(id);
	const strength = territoryPushBase(g) * territoryForceShare(id);
	if (strength <= 0) return -1;
	const idx = simAddBall(gx + g.ux * (r + gap), g.y + g.uy * (r + gap),
		g.ux * strength, g.uy * strength, r, g.storeRgb[0], g.storePalette[0], g.storeCss[0]);
	if (idx < 0) return -1;
	simArmBall(idx); // plan 3.2: fired balls carry the aura until hole crossing, 20s, or 4 bounces
	g.energy -= pushCost;
	if (g.energy < 0) g.energy = 0;
	for (let k = 1; k < g.stored; k++) {
		g.storeR[k - 1] = g.storeR[k];
		g.storeRgb[k - 1] = g.storeRgb[k];
		g.storePalette[k - 1] = g.storePalette[k];
		g.storeCss[k - 1] = g.storeCss[k];
	}
	g.stored--;
	return idx;
}

function territoryApplyPull(id, dt) {
	const g = territoryGuns[id];
	if (!g.pull || g.target < 0 || g.target >= simBalls.count) return;
	const i = g.target;
	if (territoryBallOwner(i) !== MODE_NONE || g.stored >= TERRITORY_STORE_CAP) return;
	if (territoryTryCaptureMuzzle(id, i)) return;
	const dx = simBalls.x[i] - territoryGunX(id);
	const dy = simBalls.y[i] - g.y;
	const t = dx * g.ux + dy * g.uy;
	const perp = Math.abs(dx * g.uy - dy * g.ux);
	const accel = territoryPullAccel(t, perp, id);
	if (accel <= 0 || g.energy <= 0) return;
	const cost = g.energyCost * territoryForceShare(id) * dt;
	if (cost > g.energy) return;
	g.energy -= cost;
	if (g.energy < 0) g.energy = 0;
	const dist = Math.sqrt(dx * dx + dy * dy) || 1;
	simBalls.vx[i] -= dx / dist * accel * dt;
	simBalls.vy[i] -= dy / dist * accel * dt;
	territoryClampSpeed(i);
}

function territoryPush(id) {
	if (territoryGuns[id].stored > 0) territoryLaunchBall(id);
}

function territoryPasses(i, y, r) {
	if (y + r <= territoryState.gate + 0.001) return true;
	return territoryPaintPasses(territoryBallOwner(i), y, r);
}

function territoryDivider(i, y, r, dx) {
	for (let gid = 0; gid < 2; gid++) {
		const g = territoryGuns[gid];
		if (g.stored >= TERRITORY_STORE_CAP || territoryBallOwner(i) !== MODE_NONE) continue;
		const ddx = simBalls.x[i] - territoryGunX(gid);
		const ddy = simBalls.y[i] - g.y;
		const reach = territoryCaptureReach(r);
		if (ddx * ddx + ddy * ddy <= reach * reach && territoryCapture(gid, i)) return true;
	}
	if (territoryPasses(i, y, r)) return true;
	const side = dx >= 0 ? 1 : -1;
	if ((side === -1 && simBalls.vx[i] > 0) || (side === 1 && simBalls.vx[i] < 0)) {
		const owner = territoryBallOwner(i);
		if (owner !== MODE_NONE) territoryPaintContact(owner, y, r);
		simBalls.vx[i] = -simBalls.vx[i];
	}
	simBalls.x[i] = simField.wallX + side * r;
	return true;
}

function territoryTint(dt) {
	territoryEnsureHues();
	if (typeof roomsState === 'undefined' || !roomsState.enabled) return;
	roomsEnsureHues();
	const step = TERRITORY_ROOM_RATE * dt;
	for (let i = 0; i < simBalls.count; i++) {
		const x = simBalls.x[i];
		const y = simBalls.y[i];
		let owner = -1;
		for (let k = 0; k < roomsState.count; k++) {
			const rm = roomsState.rooms[k];
			if (x < rm.tintX || x > rm.tintX + rm.tintW || y < rm.tintY || y > rm.tintY + rm.tintH) continue;
			owner = rm.owner;
			break;
		}
		if (owner < 0) continue;
		const hue = modeColorToward(territoryState.hue[i], owner, step);
		territoryState.hue[i] = hue;
		const bucket = hue | 0;
		if (bucket === territoryState.bucket[i]) continue;
		territoryState.bucket[i] = bucket;
		simBalls.rgb[i] = modeColorRgb(bucket);
		simBalls.css[i] = modeColorCssOfHue(bucket);
		simBalls.palette[i] = modeColorPalette(bucket);
		if (roomsState.hue) { roomsState.hue[i] = hue; roomsState.bucket[i] = bucket; }
	}
}

function territoryUpdateGuns() {
	territoryEnsureHues();
	for (let id = 0; id < 2; id++) {
		territoryUpdateAim(id);
		territoryUpdateTarget(id);
	}
}

function territoryControlStep(dt) {
	if (territoryGuns[1].move) {
		territoryGuns[1].y += territoryGuns[1].move * simPx(TERRITORY_GUN_MOVE_SHARE) * dt;
		territoryClampGun(1);
	}
	territoryUpdateGuns();
}

function territoryBeforeBalls(dt) {
	territoryRecharge(dt);
	territoryApplyPull(0, dt);
	territoryApplyPull(1, dt);
}

function territoryAfterBalls(dt) {
	territoryTint(dt);
}

const territoryTrajHook = {
	aperture: territoryAperture,
	pass(i, y, r) { return i >= 0 && territoryPasses(i, y, r); }
};

const territorySimHook = {
	divider: territoryDivider,
	beforeBalls: territoryBeforeBalls,
	afterBalls: territoryAfterBalls,
	removeBall: territoryRemoveBall
};

if (typeof module !== 'undefined') module.exports = {
	territoryState, territoryGuns, territoryAperture,
	territoryInit, territoryRelease, territoryResize, territorySetRooms,
	territoryControlStep, territoryHudPaint, territoryPasses, territoryBallOwner,
	territoryPullAccel, territoryDivider, territoryInput, territoryView,
	territoryTrajHook, territorySimHook, territoryCapture, territoryTryCaptureMuzzle, territoryWheel,
	territorySetForce, territoryLaunchBall, territoryPush, territoryGunX, territoryUpdateAim,
	territoryUpdateTarget, territoryBeforeBalls, territoryRecharge, territorySyncEnergy
};
