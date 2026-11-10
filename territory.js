// owns: territory mode — colored rooms, guns, wall divider rules, capture counting and its view/HUD
// edit for: room layout, gun reach/forces, gate size, seed, drawing

const TERRITORY_GATE_SHARE = 120;
const TERRITORY_SEED_SPAN = 0.09;
const TERRITORY_ROOM_RATE = 110;
const TERRITORY_PULL_REACH_SHARE = 420;
const TERRITORY_PULL_ACC_SHARE = 900;
const TERRITORY_BEAM_SHARE = 80;
const TERRITORY_PUSH_SHARE = 130;
const TERRITORY_GUN_MOVE_SHARE = 230;
const TERRITORY_SPEED_CAP = 3;
// room rectangles are shares of the field: 1 red, 2 blue, 0 green
const TERRITORY_ROOMS = [
	{ x0: 0.08, y0: 0.16, x1: 0.32, y1: 0.40, owner: 1 },
	{ x0: 0.68, y0: 0.58, x1: 0.92, y1: 0.82, owner: 2 },
	{ x0: 0.08, y0: 0.60, x1: 0.30, y1: 0.84, owner: 0 },
	{ x0: 0.70, y0: 0.16, x1: 0.92, y1: 0.40, owner: 0 }
];

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
	{ y: 0, aimX: 0, aimY: 0, ux: -1, uy: 0, aimLen: 0, pull: 0, target: -1, up: 0, down: 0, move: 0 },
	{ y: 0, aimX: 0, aimY: 0, ux: 1, uy: 0, aimLen: 0, pull: 0, target: -1, up: 0, down: 0, move: 0 }
];
const territoryAperture = { y: 0, size: 0 };
const territoryUi = { hud: null, share: [null, null], balls: [null, null] };
const territoryHudCache = new Int16Array(4);
const territoryHudValues = new Int16Array(4);
territoryHudCache.fill(-1);

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

function territoryBallOwner(i) {
	return modeColorOwner(territoryState.hue[i]);
}

function territorySetRooms(on) {
	territoryState.roomsOn = !!on;
}

function territoryHudInit() {
	territoryUi.hud = $('territory-hud');
	for (let id = 0; id < 2; id++) {
		territoryUi.share[id] = $('territory-share-' + id);
		territoryUi.balls[id] = $('territory-balls-' + id);
	}
	territoryHudCache.fill(-1);
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
	territoryRelease();
	territoryEnsureHues();
	territoryHudInit();
	territoryUpdateGuns();
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

function territoryRayReach() {
	return simPx(TERRITORY_PULL_REACH_SHARE);
}

function territoryRayBeam() {
	return simPx(TERRITORY_BEAM_SHARE);
}

function territoryRayCap() {
	return simPx(TERRITORY_PULL_ACC_SHARE);
}

// monotone in both along-ray distance and aim error, exactly zero at the bounded reach
function territoryPullAccel(t, perp) {
	const reach = territoryRayReach();
	if (t <= 0 || t >= reach) return 0;
	const along = reach * 0.45;
	const beam = territoryRayBeam();
	const fade = 1 - t / reach;
	return territoryRayCap() / (1 + (t / along) * (t / along))
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

function territoryApplyPull(id, dt) {
	const g = territoryGuns[id];
	if (!g.pull || g.target < 0 || g.target >= simBalls.count) return;
	const i = g.target;
	if (territoryBallOwner(i) !== MODE_NONE) return;
	const gx = territoryGunX(id);
	const dx = simBalls.x[i] - gx;
	const dy = simBalls.y[i] - g.y;
	const t = dx * g.ux + dy * g.uy;
	const perp = Math.abs(dx * g.uy - dy * g.ux);
	const accel = territoryPullAccel(t, perp);
	if (accel <= 0) return;
	const dist = Math.sqrt(dx * dx + dy * dy) || 1;
	simBalls.vx[i] -= dx / dist * accel * dt;
	simBalls.vy[i] -= dy / dist * accel * dt;
	territoryClampSpeed(i);
}

function territoryPush(id) {
	const g = territoryGuns[id];
	if (g.target < 0 || g.target >= simBalls.count) return;
	const i = g.target;
	if (territoryBallOwner(i) !== MODE_NONE) return;
	const cap = simPx(TERRITORY_PUSH_SHARE);
	const strength = Math.min(cap, g.aimLen * 0.5);
	if (strength <= 0) return;
	simBalls.vx[i] += g.ux * strength;
	simBalls.vy[i] += g.uy * strength;
	territoryClampSpeed(i);
}

function territoryPasses(i, y, r) {
	if (y + r <= territoryState.gate + 0.001) return true;
	return territoryPaintPasses(territoryBallOwner(i), y, r);
}

function territoryDivider(i, y, r, dx) {
	if (territoryPasses(i, y, r)) return true;
	const side = dx >= 0 ? 1 : -1;
	const toward = (side === -1 && simBalls.vx[i] > 0) || (side === 1 && simBalls.vx[i] < 0);
	if (toward) {
		const owner = territoryBallOwner(i);
		if (owner !== MODE_NONE) territoryPaintContact(owner, y, r);
		simBalls.vx[i] = -simBalls.vx[i];
	}
	simBalls.x[i] = simField.wallX + side * r;
	return true;
}

function territoryTint(dt) {
	territoryEnsureHues();
	if (!territoryState.roomsOn) return;
	const w = simField.w;
	const h = simField.h;
	const step = TERRITORY_ROOM_RATE * dt;
	for (let i = 0; i < simBalls.count; i++) {
		const x = simBalls.x[i];
		const y = simBalls.y[i];
		let owner = -1;
		for (let k = 0; k < TERRITORY_ROOMS.length; k++) {
			const room = TERRITORY_ROOMS[k];
			if (x < room.x0 * w || x > room.x1 * w || y < room.y0 * h || y > room.y1 * h) continue;
			owner = room.owner;
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
	territoryApplyPull(0, dt);
	territoryApplyPull(1, dt);
}

function territoryAfterBalls(dt) {
	territoryTint(dt);
}

function territoryHudPaint() {
	territoryEnsureHues();
	let red = 0;
	let blue = 0;
	for (let i = 0; i < simBalls.count; i++) {
		const owner = territoryBallOwner(i);
		if (owner === MODE_RED) red++;
		else if (owner === MODE_BLUE) blue++;
	}
	territoryHudValues[0] = Math.round(territoryPaintShare(MODE_RED) * 100);
	territoryHudValues[1] = red;
	territoryHudValues[2] = Math.round(territoryPaintShare(MODE_BLUE) * 100);
	territoryHudValues[3] = blue;
	let changed = false;
	for (let k = 0; k < 4; k++) {
		if (territoryHudCache[k] === territoryHudValues[k]) continue;
		territoryHudCache[k] = territoryHudValues[k];
		changed = true;
	}
	if (!changed) return;
	territoryUi.share[0].textContent = territoryHudCache[0] + ' % wall';
	territoryUi.balls[0].textContent = territoryHudCache[1] + ' balls';
	territoryUi.share[1].textContent = territoryHudCache[2] + ' % wall';
	territoryUi.balls[1].textContent = territoryHudCache[3] + ' balls';
}

const territoryInput = {
	keys: true,
	aim(x, y) {
		const g = territoryGuns[0];
		g.aimX = Math.min(x, simField.wallX - simField.wallT);
		g.aimY = y;
		g.y = y;
		territoryClampGun(0);
	},
	pull(on) { territoryGuns[0].pull = on ? 1 : 0; },
	push() { territoryPush(0); },
	key(code, down) {
		const g = territoryGuns[1];
		if (code === 'ArrowUp') g.up = down ? 1 : 0;
		else if (code === 'ArrowDown') g.down = down ? 1 : 0;
		else if (code === 'ArrowRight') g.pull = down ? 1 : 0;
		else if (code === 'Space' && down) territoryPush(1);
		else return;
		g.move = g.down - g.up;
	},
	cancel() { territoryRelease(); }
};

function territoryDrawRooms(ctx) {
	if (!territoryState.roomsOn) return;
	const w = simField.w;
	const h = simField.h;
	for (let k = 0; k < TERRITORY_ROOMS.length; k++) {
		const room = TERRITORY_ROOMS[k];
		const x = room.x0 * w;
		const y = room.y0 * h;
		const rw = (room.x1 - room.x0) * w;
		const rh = (room.y1 - room.y0) * h;
		ctx.fillStyle = MODE_ROOM_FILL[room.owner];
		ctx.fillRect(x, y, rw, rh);
		ctx.strokeStyle = MODE_CSS[room.owner];
		ctx.lineWidth = 1.5;
		ctx.strokeRect(x, y, rw, rh);
	}
}

function territoryDrawWall(ctx) {
	const p = territoryPaint;
	const x = simField.wallX - simField.wallT / 2;
	const t = simField.wallT;
	for (let k = 0; k < p.count; k++) {
		if (p.h[k] <= 0) continue;
		const owner = p.owner[k];
		const blend = p.blend[k];
		if (owner !== MODE_NONE && blend >= TP_MATCH_BLEND) {
			ctx.fillStyle = MODE_PASS_FILL[owner];
			ctx.fillRect(x, p.y[k], t, p.h[k]);
			ctx.strokeStyle = MODE_CSS[owner];
			ctx.lineWidth = 1.5;
			ctx.strokeRect(x + 0.5, p.y[k], t - 1, p.h[k]);
			continue;
		}
		ctx.fillStyle = '#495263';
		ctx.fillRect(x, p.y[k], t, p.h[k]);
		if (owner === MODE_NONE || blend <= 0) continue;
		ctx.globalAlpha = blend * 0.7;
		ctx.fillStyle = MODE_WALL_CSS[owner];
		ctx.fillRect(x, p.y[k], t, p.h[k]);
		ctx.globalAlpha = 1;
	}
	ctx.fillStyle = '#9ba6ba';
	ctx.fillRect(x - t * 0.4, territoryState.gate - 2, t * 1.8, 2);
}

function territoryDrawGuns(ctx) {
	const reach = territoryRayReach();
	for (let id = 0; id < 2; id++) {
		const g = territoryGuns[id];
		const gx = territoryGunX(id);
		const css = MODE_CSS[territoryOwnerOfGun(id)];
		ctx.setLineDash([6, 6]);
		ctx.globalAlpha = g.pull ? 0.6 : 0.22;
		ctx.strokeStyle = css;
		ctx.lineWidth = g.pull ? 3 : 1.5;
		ctx.beginPath();
		ctx.moveTo(gx, g.y);
		ctx.lineTo(gx + g.ux * reach, g.y + g.uy * reach);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.globalAlpha = 1;
		ctx.fillStyle = css;
		ctx.beginPath();
		ctx.arc(gx, g.y, simField.wallT * 0.9, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#edf0f6';
		ctx.lineWidth = 1;
		ctx.stroke();
		const i = g.target;
		if (i < 0 || i >= simBalls.count) continue;
		ctx.strokeStyle = css;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(simBalls.x[i], simBalls.y[i], simBalls.r[i] + 4, 0, Math.PI * 2);
		ctx.stroke();
	}
}

function territoryForecast(i, end, path) {
	const y = path.y[path.n - 1];
	territoryState.highlightOwner = territoryPaintOwnerAt(y);
	// a colored wall intersection highlights the line; a gate or matching passage is always drawn
	if (territoryState.highlightOwner !== MODE_NONE || end === TRAJ_PASS) return 2;
	return 1;
}

const territoryView = {
	resize: territoryResize,
	// the standard aperture is not in play here, so its plate marks would point at a hole that does not exist
	noPositionMarks: true,
	background: territoryDrawRooms,
	wall: territoryDrawWall,
	overlay: territoryDrawGuns,
	forecast: territoryForecast,
	forecastCss(i) {
		return territoryState.highlightOwner === MODE_NONE ? simBalls.css[i] : MODE_CSS[territoryState.highlightOwner];
	},
	forecastReach(reach) { return reach; },
	forecastBudget() { return TRAJ_POINTS; }
};

const territoryTrajHook = {
	aperture: territoryAperture,
	pass(i, y, r) { return i >= 0 && territoryPasses(i, y, r); }
};

const territorySimHook = {
	divider: territoryDivider,
	beforeBalls: territoryBeforeBalls,
	afterBalls: territoryAfterBalls
};

if (typeof module !== 'undefined') module.exports = {
	territoryState, territoryGuns, territoryAperture,
	territoryInit, territoryRelease, territoryResize, territorySetRooms,
	territoryControlStep, territoryHudPaint, territoryPasses, territoryBallOwner,
	territoryPullAccel, territoryDivider, territoryInput, territoryView,
	territoryTrajHook, territorySimHook
};
