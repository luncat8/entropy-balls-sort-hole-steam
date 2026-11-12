// owns: plate-color mode — sliding two-hole plate, colorizer rooms, dual side guns, capture and bot rules
// edit for: door/hole spacing, tint/homing rates, gun forces, bot tug-of-war

const PLATE_LAYOUTS = ['top', 'bottom'];
const PLATE_ROOM_H = 0.20;
const PLATE_ROOM_X0 = 0.08;
const PLATE_ROOM_W = 0.30;
const PLATE_DOOR_SHARE = [0.23, 0.77];
const PLATE_HOLE_OFFSET = 0.18;
const PLATE_TRAVEL = 0.11;
const PLATE_DOOR_MAX_W = 0.085;
const PLATE_TINT_RATE = 110;
const PLATE_HOME_ACC_SHARE = 950;
const PLATE_PULL_REACH_SHARE = 520;
const PLATE_PULL_ACC_SHARE = 2880;
const PLATE_BEAM_SHARE = 90;
const PLATE_PUSH_SHARE = 720;
const PLATE_PUSH_SLOPE = 2;
const PLATE_SPEED_CAP = 6;
const PLATE_STORE_CAP = 3;
const PLATE_CAPTURE_SHARE = 24;
const PLATE_FORCE_STEP = 5;
const PLATE_FORCE_START = 60;
const PLATE_PUSH_COST = 8;
const PLATE_AIM_RATE = 1.8;

const plateState = {
	layout: 'top',
	x: 600,
	y: 160,
	vx: 0,
	drive: 0,
	minX: 0,
	maxX: 0,
	barLo: 0,
	barHi: 0,
	doorW: 0,
	doorX: new Float32Array(2),
	doorLo: new Float32Array(2),
	doorHi: new Float32Array(2),
	holeX: new Float32Array(2),
	holeLo: new Float32Array(2),
	holeHi: new Float32Array(2),
	openLo: new Float32Array(2),
	openHi: new Float32Array(2),
	captured: new Uint16Array(2),
	botRest: new Uint8Array(2),
	botFireT: new Float32Array(2),
	hue: null,
	bucket: null,
	colorized: null,
	hueCount: 0
};
const plateRooms = [
	{ x: 0, y: 0, w: 0, h: 0, owner: 1 },
	{ x: 0, y: 0, w: 0, h: 0, owner: 2 }
];
const plateKeys = { p1Left: 0, p1Right: 0, p2Left: 0, p2Right: 0 };
const plateRayOut = { dist: 0, x: 0, y: 0, nx: 0, ny: 0 };

function plateMakeGun(id) {
	return {
		x: 0, y: 0, aimX: 0, aimY: 0, ux: id === 0 ? 1 : -1, uy: 0, aimLen: 0,
		aimAngle: 0, aimUp: 0, aimDown: 0,
		pull: 0, target: -1, refused: 0, push: 0,
		force: PLATE_FORCE_START, energy: FORCE_CAPACITY, energyCap: FORCE_CAPACITY, energyCost: FORCE_COST,
		stored: 0,
		storeR: new Float32Array(PLATE_STORE_CAP),
		storeRgb: new Uint32Array(PLATE_STORE_CAP),
		storePalette: new Uint8Array(PLATE_STORE_CAP),
		storeCss: new Array(PLATE_STORE_CAP),
		path: { n: 0, x: new Float32Array(TRAJ_POINTS), y: new Float32Array(TRAJ_POINTS), end: TRAJ_NONE, dist: 0, side: 0 }
	};
}
const plateGuns = [plateMakeGun(0), plateMakeGun(1)];

function plateNormalizeLayout(raw) {
	return PLATE_LAYOUTS.indexOf(raw) < 0 ? 'top' : raw;
}

function plateOwnerOfGun(id) {
	return id === 0 ? MODE_RED : MODE_BLUE;
}

function plateRayReach() { return simPx(PLATE_PULL_REACH_SHARE); }
function plateRayBeam() { return simPx(PLATE_BEAM_SHARE); }
function plateRayCap() { return simPx(PLATE_PULL_ACC_SHARE); }
function plateCaptureReach(r) { return r + simPx(PLATE_CAPTURE_SHARE); }
function plateForceShare(id) { return plateGuns[id].force <= 0 ? 0 : plateGuns[id].force / 100; }

function plateHuesInit() {
	const cap = simBalls.x.length;
	if (!plateState.hue || plateState.hue.length < cap) {
		plateState.hue = new Float32Array(cap);
		plateState.bucket = new Int16Array(cap);
		plateState.colorized = new Uint8Array(cap);
	}
	plateState.colorized.fill(0);
	plateState.hueCount = 0;
}

function plateEnsureHues() {
	if (plateState.hueCount > simBalls.count) plateState.hueCount = simBalls.count;
	for (let i = plateState.hueCount; i < simBalls.count; i++) {
		const hue = colorRgbHue(simBalls.rgb[i]);
		plateState.hue[i] = hue;
		plateState.bucket[i] = hue | 0;
		plateState.colorized[i] = 0;
	}
	plateState.hueCount = simBalls.count;
}

function plateRemoveBall(i, last) {
	if (!plateState.hue || plateState.hueCount <= 0) return;
	if (i !== last && i < plateState.hueCount) {
		const hue = last < plateState.hueCount ? plateState.hue[last] : colorRgbHue(simBalls.rgb[last]);
		plateState.hue[i] = hue;
		plateState.bucket[i] = hue | 0;
		plateState.colorized[i] = last < plateState.hueCount ? plateState.colorized[last] : 0;
	}
	if (plateState.hueCount > last) plateState.hueCount = last;
}

// hole spacing (0.36w) differs from door spacing (0.54w), so shifting left aligns hole 0 with door 0
// while shifting right aligns hole 1 with door 1, and neither position can open both doors at once
function plateSyncHoles() {
	const w = simField.w;
	const half = plateState.doorW / 2;
	const offset = w * PLATE_HOLE_OFFSET;
	plateState.holeX[0] = plateState.x - offset;
	plateState.holeX[1] = plateState.x + offset;
	const shift = plateState.x - w * 0.5;
	plateState.barLo = Math.max(0, w * 0.04 + shift);
	plateState.barHi = Math.min(w, w * 0.96 + shift);
	for (let k = 0; k < 2; k++) {
		plateState.holeLo[k] = plateState.holeX[k] - half;
		plateState.holeHi[k] = plateState.holeX[k] + half;
		const lo = Math.max(plateState.doorLo[k], plateState.holeLo[k]);
		const hi = Math.min(plateState.doorHi[k], plateState.holeHi[k]);
		plateState.openLo[k] = lo;
		plateState.openHi[k] = hi > lo ? hi : lo;
	}
}

function plateSyncGeometry(keepShare) {
	const w = simField.w;
	const h = simField.h;
	const share = keepShare ? plateState.x / (plateState._lastW || w) : 0.5;
	plateState._lastW = w;
	const roomH = h * PLATE_ROOM_H;
	const top = plateState.layout === 'top';
	plateState.y = top ? roomH : h - roomH;
	plateState.doorW = Math.min(simAperture.size, w * PLATE_DOOR_MAX_W);
	const half = plateState.doorW / 2;
	plateRooms[0].owner = MODE_RED;
	plateRooms[1].owner = MODE_BLUE;
	for (let k = 0; k < 2; k++) {
		const rm = plateRooms[k];
		rm.w = w * PLATE_ROOM_W;
		rm.h = roomH;
		rm.x = k === 0 ? w * PLATE_ROOM_X0 : w * (1 - PLATE_ROOM_X0 - PLATE_ROOM_W);
		rm.y = top ? 0 : h - roomH;
		plateState.doorX[k] = w * PLATE_DOOR_SHARE[k];
		plateState.doorLo[k] = plateState.doorX[k] - half;
		plateState.doorHi[k] = plateState.doorX[k] + half;
	}
	plateState.minX = w * (0.5 - PLATE_TRAVEL);
	plateState.maxX = w * (0.5 + PLATE_TRAVEL);
	plateState.x = Math.max(plateState.minX, Math.min(plateState.maxX, share * w));
	plateSyncHoles();
	simAperture.y = h * 0.5;
	simAperture.drive = 0;
	simAperture.velocity = 0;
	for (let id = 0; id < 2; id++) {
		const g = plateGuns[id];
		g.x = id === 0 ? 0 : w;
		g.y = h * 0.5;
	}
	plateUpdateAim(0);
	plateUpdateAim(1);
}

// target plate centre x that centers hole id directly over door id
function plateDoorAlignX(id) {
	const offset = simField.w * PLATE_HOLE_OFFSET;
	return id === 0 ? plateState.doorX[0] + offset : plateState.doorX[1] - offset;
}

function plateSetLayout(layout) {
	const next = plateNormalizeLayout(layout);
	if (next === plateState.layout) return false;
	plateState.layout = next;
	plateSyncGeometry(true);
	return true;
}

function plateInit() {
	modecolorInit();
	plateHuesInit();
	plateState.layout = plateNormalizeLayout(settingsState.plateLayout);
	plateState.vx = 0;
	plateState.drive = 0;
	plateState.captured.fill(0);
	plateState.botRest.fill(0);
	plateState.botFireT.fill(0);
	plateSyncGeometry(false);
	for (let id = 0; id < 2; id++) {
		const g = plateGuns[id];
		g.force = PLATE_FORCE_START;
		plateSyncGunEnergy(id);
		g.energy = g.energyCap;
		g.stored = 0;
		g.aimAngle = 0;
		g.aimX = simField.wallX;
		g.aimY = simField.h * 0.5;
		plateUpdateAim(id);
	}
	plateRelease();
	plateEnsureHues();
	plateHudInit();
}

function plateResize() {
	plateSyncGeometry(true);
}

function plateRelease() {
	plateKeys.p1Left = 0;
	plateKeys.p1Right = 0;
	plateKeys.p2Left = 0;
	plateKeys.p2Right = 0;
	for (let id = 0; id < 2; id++) {
		const g = plateGuns[id];
		g.pull = 0;
		g.target = -1;
		g.refused = 0;
		g.aimUp = 0;
		g.aimDown = 0;
	}
}

function plateSyncGunEnergy(id) {
	const g = plateGuns[id];
	g.energyCap = forceCapacity;
	g.energyCost = forceCost;
	if (g.energy > g.energyCap) g.energy = g.energyCap;
}

function plateSetGunForce(id, force) {
	if (id < 0 || id > 1) return;
	let next = Math.round(force / PLATE_FORCE_STEP) * PLATE_FORCE_STEP;
	if (next < 0) next = 0; else if (next > 100) next = 100;
	plateGuns[id].force = next;
}

function plateWheel(id, deltaY) {
	if (!deltaY) return;
	plateSetGunForce(id, plateGuns[id].force + (deltaY > 0 ? -PLATE_FORCE_STEP : PLATE_FORCE_STEP));
}

function plateSetAim(id, x, y) {
	const g = plateGuns[id];
	g.aimX = x;
	g.aimY = y;
	g.refused = 0;
	plateUpdateAim(id);
}

function plateUpdateAim(id) {
	const g = plateGuns[id];
	let dx = g.aimX - g.x;
	let dy = g.aimY - g.y;
	if (id === 0 && dx < 8) dx = 8;
	if (id === 1 && dx > -8) dx = -8;
	const len = Math.sqrt(dx * dx + dy * dy) || 1;
	g.ux = dx / len;
	g.uy = dy / len;
	g.aimLen = len;
}

function platePullAccel(id, t, perp) {
	const reach = plateRayReach();
	if (t <= 0 || t >= reach) return 0;
	const along = reach * 0.45;
	const beam = plateRayBeam();
	const fade = 1 - t / reach;
	return plateRayCap() * plateForceShare(id) / (1 + (t / along) * (t / along))
		/ (1 + (perp / beam) * (perp / beam)) * fade * fade;
}

function platePushStrength(id) {
	const g = plateGuns[id];
	return Math.min(simPx(PLATE_PUSH_SHARE), g.aimLen * PLATE_PUSH_SLOPE) * plateForceShare(id);
}

function plateClampSpeed(i) {
	const max = simBallConfig.speed * PLATE_SPEED_CAP;
	const vx = simBalls.vx[i], vy = simBalls.vy[i];
	const speed = Math.sqrt(vx * vx + vy * vy);
	if (speed <= max) return;
	const scale = max / speed;
	simBalls.vx[i] = vx * scale;
	simBalls.vy[i] = vy * scale;
}

function plateInRoomBand(y) {
	return plateState.layout === 'top' ? y < plateState.y : y > plateState.y;
}

function plateSpawnBlocked(x, y, r) {
	return plateState.layout === 'top' ? y - r <= plateState.y + 4 : y + r >= plateState.y - 4;
}

function plateBallPassesBarrier(i, x, y, r) {
	const colorOwner = i >= 0 ? plateState.colorized[i] : 0;
	const inBand = plateInRoomBand(y);
	for (let k = 0; k < 2; k++) {
		// a fully colorized ball already inside its room exits freely through that door even if shut
		const freeExit = inBand && colorOwner === plateRooms[k].owner;
		const lo = freeExit ? plateState.doorLo[k] : plateState.openLo[k];
		const hi = freeExit ? plateState.doorHi[k] : plateState.openHi[k];
		if (hi - lo < 2 * r - 2 * APERTURE_FIT_SLACK) continue;
		if (x - r >= lo - APERTURE_FIT_SLACK && x + r <= hi + APERTURE_FIT_SLACK) return true;
	}
	return false;
}

function plateSubstep(i) {
	const r = simBalls.r[i];
	let x = simBalls.x[i];
	let y = simBalls.y[i];
	const dy = y - plateState.y;
	if (dy <= r && dy >= -r && !plateBallPassesBarrier(i, x, y, r)) {
		const side = dy >= 0 ? 1 : -1;
		if ((side === -1 && simBalls.vy[i] > 0) || (side === 1 && simBalls.vy[i] < 0)) {
			simBalls.vy[i] = -simBalls.vy[i];
		}
		y = plateState.y + side * r;
		simBalls.y[i] = y;
	}
	if (!plateInRoomBand(y)) return;
	for (let k = 0; k < 2; k++) {
		const rm = plateRooms[k];
		if (x < rm.x - r * 2 || x > rm.x + rm.w + r * 2) continue;
		if (x - r < rm.x) {
			simBalls.x[i] = rm.x + r;
			if (simBalls.vx[i] < 0) simBalls.vx[i] = -simBalls.vx[i];
		} else if (x + r > rm.x + rm.w) {
			simBalls.x[i] = rm.x + rm.w - r;
			if (simBalls.vx[i] > 0) simBalls.vx[i] = -simBalls.vx[i];
		}
	}
}

function plateWallHit(ray, r) {
	const rad = r || 0;
	let best = Infinity;
	let nx = 0, ny = 0;
	if (ray.uy !== 0) {
		const faceY = Math.abs(plateState.y - ray.y) <= rad ? plateState.y
			: (ray.uy > 0 ? plateState.y - rad : plateState.y + rad);
		const t = (faceY - ray.y) / ray.uy;
		if (t > 1e-6) {
			const hx = ray.x + ray.ux * t;
			if (!plateBallPassesBarrier(-1, hx, ray.y, rad)) {
				best = t;
				ny = ray.uy > 0 ? -1 : 1;
			}
		}
	}
	if (plateInRoomBand(ray.y) && ray.ux !== 0) {
		for (let k = 0; k < 2; k++) {
			const rm = plateRooms[k];
			for (let s = 0; s < 2; s++) {
				const wx = s === 0 ? rm.x : rm.x + rm.w;
				const faceX = Math.abs(wx - ray.x) <= rad ? wx : (ray.ux > 0 ? wx - rad : wx + rad);
				const t = (faceX - ray.x) / ray.ux;
				if (t <= 1e-6 || t >= best) continue;
				const hy = ray.y + ray.uy * t;
				if (!plateInRoomBand(hy)) continue;
				best = t;
				nx = ray.ux > 0 ? -1 : 1;
				ny = 0;
			}
		}
	}
	if (!Number.isFinite(best)) return null;
	plateRayOut.dist = best;
	plateRayOut.x = ray.x + ray.ux * best;
	plateRayOut.y = ray.y + ray.uy * best;
	plateRayOut.nx = nx;
	plateRayOut.ny = ny;
	return plateRayOut;
}

function plateCaptureNeutral(id, i) {
	const g = plateGuns[id];
	if (g.stored >= PLATE_STORE_CAP || i < 0 || i >= simBalls.count) return false;
	if (plateState.colorized[i] !== 0) return false;
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

function plateCaptureColorized(id, i) {
	const owner = plateOwnerOfGun(id);
	if (i < 0 || i >= simBalls.count || plateState.colorized[i] !== owner) return false;
	if (!simRemoveBall(i)) return false;
	plateState.captured[id]++;
	if (plateGuns[id].target === i) plateGuns[id].target = -1;
	return true;
}

function plateUpdateTarget(id) {
	const g = plateGuns[id];
	const owner = plateOwnerOfGun(id);
	const reach = plateRayReach();
	const beam = plateRayBeam();
	let best = Infinity;
	let target = -1;
	for (let i = 0; i < simBalls.count; i++) {
		const col = plateState.colorized[i];
		if (col !== 0 && col !== owner) continue;
		if (plateInRoomBand(simBalls.y[i])) continue;
		const dx = simBalls.x[i] - g.x;
		const dy = simBalls.y[i] - g.y;
		const t = dx * g.ux + dy * g.uy;
		if (t <= 0 || t >= reach) continue;
		const perp = Math.abs(dx * g.uy - dy * g.ux);
		if (perp >= beam) continue;
		const score = perp + t * 0.12;
		if (score >= best) continue;
		best = score;
		target = i;
	}
	g.target = target;
}

function platePredict(id) {
	const g = plateGuns[id];
	g.push = platePushStrength(id);
	if (!g.stored || g.push <= 0) {
		g.path.n = 0;
		g.path.end = TRAJ_NONE;
		return TRAJ_NONE;
	}
	const r = g.storeR[0];
	const gap = simPx(PLATE_CAPTURE_SHARE);
	const x = g.x + g.ux * (r + gap);
	const y = g.y + g.uy * (r + gap);
	return trajTrace(x, y, g.ux * g.push, g.uy * g.push, r, Infinity, g.path, -1, TRAJ_POINTS, 0);
}

function plateLaunchBall(id) {
	const g = plateGuns[id];
	if (!g.stored) return -1;
	const pushCost = PLATE_PUSH_COST * plateForceShare(id);
	if (pushCost > 0 && g.energy < pushCost) { g.refused = 1; return -1; }
	const r = g.storeR[0];
	const gap = simPx(PLATE_CAPTURE_SHARE);
	const idx = simAddBall(
		g.x + g.ux * (r + gap), g.y + g.uy * (r + gap),
		g.ux * g.push, g.uy * g.push,
		r, g.storeRgb[0], g.storePalette[0], g.storeCss[0]);
	if (idx < 0) return -1;
	simArmBall(idx);
	g.energy = Math.max(0, g.energy - pushCost);
	for (let k = 1; k < g.stored; k++) {
		g.storeR[k - 1] = g.storeR[k];
		g.storeRgb[k - 1] = g.storeRgb[k];
		g.storePalette[k - 1] = g.storePalette[k];
		g.storeCss[k - 1] = g.storeCss[k];
	}
	g.stored--;
	return idx;
}

function platePush(id) {
	const g = plateGuns[id];
	if (!g.stored) { g.refused = 0; return -1; }
	const pushCost = PLATE_PUSH_COST * plateForceShare(id);
	if (pushCost > 0 && g.energy < pushCost) { g.refused = 1; return -1; }
	const end = platePredict(id);
	g.refused = end === TRAJ_PASS || g.push <= 0 ? 1 : 0;
	if (g.refused) return -1;
	return plateLaunchBall(id);
}

function plateStepGuns(dt) {
	for (let id = 0; id < 2; id++) {
		plateSyncGunEnergy(id);
		const g = plateGuns[id];
		g.energy = Math.min(g.energyCap, g.energy + g.energyCap * FORCE_RECHARGE_SHARE * dt);
		if (id === 1 && (g.aimUp || g.aimDown)) {
			g.aimAngle = Math.max(-1.25, Math.min(1.25, g.aimAngle + (g.aimDown - g.aimUp) * PLATE_AIM_RATE * dt));
			const span = simField.w * 0.45;
			g.aimX = g.x - Math.cos(g.aimAngle) * span;
			g.aimY = g.y + Math.sin(g.aimAngle) * span;
			g.refused = 0;
			plateUpdateAim(1);
		}
		plateUpdateTarget(id);
		g.push = platePushStrength(id);
		const tIdx = g.target;
		if (!g.pull || tIdx < 0 || tIdx >= simBalls.count) continue;
		const col = plateState.colorized[tIdx];
		if (col === 0 && g.stored >= PLATE_STORE_CAP) continue;
		const dx = simBalls.x[tIdx] - g.x;
		const dy = simBalls.y[tIdx] - g.y;
		const reach = plateCaptureReach(simBalls.r[tIdx]);
		if (dx * dx + dy * dy <= reach * reach) {
			if (col === plateOwnerOfGun(id)) plateCaptureColorized(id, tIdx);
			else plateCaptureNeutral(id, tIdx);
			continue;
		}
		const along = dx * g.ux + dy * g.uy;
		const perp = Math.abs(dx * g.uy - dy * g.ux);
		const accel = platePullAccel(id, along, perp);
		const cost = g.energyCost * plateForceShare(id) * dt;
		if (accel <= 0 || g.energy < cost) continue;
		g.energy = Math.max(0, g.energy - cost);
		const dist = Math.sqrt(dx * dx + dy * dy) || 1;
		simBalls.vx[tIdx] -= dx / dist * accel * dt;
		simBalls.vy[tIdx] -= dy / dist * accel * dt;
		plateClampSpeed(tIdx);
	}
}

// tints balls inside colorizer rooms; once fully colorized to the room color, guides them out the
// door and homes them into the matching-color gun muzzle for capture
function plateTintAndHome(dt) {
	plateEnsureHues();
	const step = PLATE_TINT_RATE * dt;
	const homeAcc = simPx(PLATE_HOME_ACC_SHARE);
	const exitSign = plateState.layout === 'top' ? 1 : -1;
	for (let i = 0; i < simBalls.count; i++) {
		const x = simBalls.x[i];
		const y = simBalls.y[i];
		const inBand = plateInRoomBand(y);
		if (inBand) {
			for (let k = 0; k < 2; k++) {
				const rm = plateRooms[k];
				if (x < rm.x || x > rm.x + rm.w) continue;
				const hue = modeColorToward(plateState.hue[i], rm.owner, step);
				plateState.hue[i] = hue;
				const bucket = hue | 0;
				if (bucket !== plateState.bucket[i]) {
					plateState.bucket[i] = bucket;
					simBalls.rgb[i] = modeColorRgb(bucket);
					simBalls.css[i] = modeColorCssOfHue(bucket);
					simBalls.palette[i] = modeColorPalette(bucket);
				}
				if (colorHueNear(hue, MODE_HUE[rm.owner], 2)) plateState.colorized[i] = rm.owner;
				break;
			}
		}
		const owner = plateState.colorized[i];
		if (!owner) continue;
		const gid = owner === MODE_RED ? 0 : 1;
		if (inBand) {
			const doorX = plateState.doorX[gid];
			const dx = doorX - x;
			const sp = Math.max(simBallConfig.speed * 1.6, 40);
			simBalls.vx[i] += Math.sign(dx) * Math.min(Math.abs(dx) * 6, homeAcc) * dt;
			simBalls.vy[i] = exitSign * sp;
			plateClampSpeed(i);
			continue;
		}
		const g = plateGuns[gid];
		const dx = g.x - x;
		const dy = g.y - y;
		const d2 = dx * dx + dy * dy;
		const reach = plateCaptureReach(simBalls.r[i]);
		if (d2 <= reach * reach) {
			if (plateCaptureColorized(gid, i)) i--;
			continue;
		}
		const d = Math.sqrt(d2) || 1;
		simBalls.vx[i] += dx / d * homeAcc * dt;
		simBalls.vy[i] += dy / d * homeAcc * dt;
		plateClampSpeed(i);
	}
}

function plateApplyHumanForce() {
	if (players.type[0] === PLAYER_HUMAN) {
		const dir0 = plateKeys.p1Right - plateKeys.p1Left;
		if (dir0 !== 0) {
			if (forceState.mag[0] <= 0) forceSetMagnitude(0, 0.6);
			forceSetDirection(0, dir0);
			forceHold(0, true);
		} else if (inputState.sliderPointer && inputState.sliderPointer[0] === INPUT_NONE) {
			forceHold(0, false);
		}
	}
	if (players.count > 1 && players.type[1] === PLAYER_HUMAN) {
		const dir1 = plateKeys.p2Right - plateKeys.p2Left;
		if (dir1 !== 0) {
			if (forceState.mag[1] <= 0) forceSetMagnitude(1, 0.6);
			forceSetDirection(1, dir1);
			forceHold(1, true);
		} else if (inputState.sliderPointer && inputState.sliderPointer[1] === INPUT_NONE) {
			forceHold(1, false);
		}
	}
}

function plateBotStep(id, dt) {
	const cap = forceCapacity > 0 ? forceCapacity : 1;
	const share = forceState.energy[id] / cap;
	if (plateState.botRest[id] && share >= 0.55) plateState.botRest[id] = 0;
	else if (!plateState.botRest[id] && share <= 0.15) plateState.botRest[id] = 1;
	const wantX = plateDoorAlignX(id);
	const delta = wantX - plateState.x;
	const dead = simAperture.speed * FIXED_DT + 0.5;
	const dir = Math.abs(delta) <= dead ? 0 : (delta < 0 ? -1 : 1);
	forceSetMagnitude(id, 0.8);
	forceSetDirection(id, dir);
	forceHold(id, !plateState.botRest[id] && dir !== 0);
	const g = plateGuns[id];
	if (g.stored > 0) {
		g.pull = 0;
		plateState.botFireT[id] += dt;
		if (plateState.botFireT[id] >= 0.6) {
			plateState.botFireT[id] = 0;
			plateSetAim(id, simField.wallX, plateState.y + (plateState.layout === 'top' ? 60 : -60));
			platePush(id);
		}
		return;
	}
	plateUpdateTarget(id);
	g.pull = g.target >= 0 && g.energy > g.energyCap * 0.25 ? 1 : 0;
}

function plateMove(dt) {
	const speed = plateState.drive * simAperture.speed / (simFrictionEnabled ? 1 + APERTURE_FRICTION : 1);
	let nx = plateState.x + speed * dt;
	if (nx < plateState.minX) nx = plateState.minX;
	else if (nx > plateState.maxX) nx = plateState.maxX;
	plateState.vx = dt > 0 ? (nx - plateState.x) / dt : 0;
	plateState.x = nx;
	plateSyncHoles();
}

function plateControlStep(dt) {
	plateApplyHumanForce();
	for (let id = 0; id < players.count; id++) {
		if (players.type[id] === PLAYER_BOT) plateBotStep(id, dt);
	}
	plateState.drive = forceDrive(dt);
	plateMove(dt);
}

function plateBeforeBalls(dt) {
	plateStepGuns(dt);
}

function plateAfterBalls(dt) {
	plateTintAndHome(dt);
}

const plateTrajHook = {
	wallHit: plateWallHit
};

const plateSimHook = {
	skipApertureForce: true,
	spawnBlocked: plateSpawnBlocked,
	substep: plateSubstep,
	beforeBalls: plateBeforeBalls,
	afterBalls: plateAfterBalls,
	removeBall: plateRemoveBall
};

if (typeof module !== 'undefined') module.exports = {
	plateState, plateRooms, plateGuns, plateKeys,
	plateInit, plateResize, plateRelease, plateSetLayout, plateNormalizeLayout,
	plateDoorAlignX, plateSyncGeometry, plateSyncHoles,
	plateSetAim, plateSetGunForce, plateWheel, platePullAccel, platePushStrength,
	plateCaptureNeutral, plateCaptureColorized, platePush, platePredict,
	plateControlStep, plateBeforeBalls, plateAfterBalls, plateSubstep, plateWallHit,
	plateInput, plateView, plateHudPaint, plateOpenCode, plateTrajHook, plateSimHook,
	PLATE_LAYOUTS, PLATE_STORE_CAP, PLATE_PUSH_SHARE, PLATE_PULL_ACC_SHARE
};
