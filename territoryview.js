// owns: territory HUD, input mapping, wall/gun canvas drawing and forecast styling
// edit for: territory HUD readouts, key/pointer bindings, painted wall and gun visuals

const TERRITORY_RAY_DASH = [6, 6];
const territoryUi = { hud: null, share: [null, null], balls: [null, null], force: [null, null], energy: [null, null], stored: [null, null] };
const territoryHudCache = new Int16Array(10);
const territoryHudValues = new Int16Array(10);
territoryHudCache.fill(-1);

function territoryHudInit() {
	territoryUi.hud = $('territory-hud');
	for (let id = 0; id < 2; id++) {
		territoryUi.share[id] = $('territory-share-' + id);
		territoryUi.balls[id] = $('territory-balls-' + id);
		territoryUi.force[id] = $('territory-force-' + id);
		territoryUi.energy[id] = $('territory-energy-' + id);
		territoryUi.stored[id] = $('territory-stored-' + id);
	}
	territoryHudCache.fill(-1);
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
	territoryHudValues[4] = Math.round(territoryGuns[0].force);
	territoryHudValues[5] = Math.round(territoryGuns[0].energy);
	territoryHudValues[6] = territoryGuns[0].stored;
	territoryHudValues[7] = Math.round(territoryGuns[1].force);
	territoryHudValues[8] = Math.round(territoryGuns[1].energy);
	territoryHudValues[9] = territoryGuns[1].stored;
	let changed = false;
	for (let k = 0; k < 4; k++) {
		if (territoryHudCache[k] === territoryHudValues[k]) continue;
		territoryHudCache[k] = territoryHudValues[k];
		changed = true;
	}
	if (changed) {
		territoryUi.share[0].textContent = territoryHudCache[0] + ' % wall';
		territoryUi.balls[0].textContent = territoryHudCache[1] + ' balls';
		territoryUi.share[1].textContent = territoryHudCache[2] + ' % wall';
		territoryUi.balls[1].textContent = territoryHudCache[3] + ' balls';
	}
	for (let id = 0; id < 2; id++) {
		const base = 4 + id * 3;
		const f = territoryHudValues[base];
		const e = territoryHudValues[base + 1];
		const s = territoryHudValues[base + 2];
		if (territoryHudCache[base] === f && territoryHudCache[base + 1] === e && territoryHudCache[base + 2] === s) continue;
		territoryHudCache[base] = f;
		territoryHudCache[base + 1] = e;
		territoryHudCache[base + 2] = s;
		if (territoryUi.force[id]) territoryUi.force[id].textContent = f + '% force';
		if (territoryUi.energy[id]) territoryUi.energy[id].textContent = e + '/' + Math.round(territoryGuns[id].energyCap) + ' energy';
		if (territoryUi.stored[id]) territoryUi.stored[id].textContent = s + '/' + TERRITORY_STORE_CAP;
	}
}

const territoryInput = {
	keys: true,
	aim(x, y) {
		const g = territoryGuns[0];
		g.aimX = x;
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
		else if (code === 'BracketLeft' && down) territorySetForce(1, g.force - TERRITORY_FORCE_STEP);
		else if (code === 'BracketRight' && down) territorySetForce(1, g.force + TERRITORY_FORCE_STEP);
		else if (code === 'Comma' && down) territorySetForce(0, territoryGuns[0].force - TERRITORY_FORCE_STEP);
		else if (code === 'Period' && down) territorySetForce(0, territoryGuns[0].force + TERRITORY_FORCE_STEP);
		else return;
		g.move = g.down - g.up;
	},
	wheel(deltaY) { territoryWheel(deltaY); },
	cancel() { territoryRelease(); }
};

function territoryDrawRooms(ctx) {
	if (typeof roomsDrawBackground !== 'undefined' && roomsState.enabled) roomsDrawBackground(ctx);
}

// a ball's paint on the wall is its own footprint: the contact already spans the ball's diameter along
// the wall, so the painted band is one ball wide instead of the plate's thickness
function territoryMarkWidth() {
	return Math.max(simField.wallT, simBallConfig.radius * 2);
}

function territoryDrawWall(ctx) {
	const p = territoryPaint;
	const t = simField.wallT;
	const x = simField.wallX - t / 2;
	const markW = territoryMarkWidth();
	const markX = simField.wallX - markW / 2;
	for (let k = 0; k < p.count; k++) {
		if (p.h[k] <= 0) continue;
		const owner = p.owner[k];
		const blend = p.blend[k];
		if (owner !== MODE_NONE && blend >= TP_MATCH_BLEND) {
			ctx.fillStyle = MODE_PASS_FILL[owner];
			ctx.fillRect(markX, p.y[k], markW, p.h[k]);
			ctx.strokeStyle = MODE_CSS[owner];
			ctx.lineWidth = 1.5;
			ctx.strokeRect(markX + 0.5, p.y[k], markW - 1, p.h[k]);
			continue;
		}
		ctx.fillStyle = '#495263';
		ctx.fillRect(x, p.y[k], t, p.h[k]);
		if (owner === MODE_NONE || blend <= 0) continue;
		ctx.globalAlpha = blend * 0.7;
		ctx.fillStyle = MODE_WALL_CSS[owner];
		ctx.fillRect(markX, p.y[k], markW, p.h[k]);
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
		const forceScale = g.force / 100;
		ctx.setLineDash(TERRITORY_RAY_DASH);
		ctx.globalAlpha = g.pull ? 0.35 + forceScale * 0.4 : 0.14 + forceScale * 0.16;
		ctx.strokeStyle = css;
		ctx.lineWidth = 1 + forceScale * 2.2 + (g.pull ? 0.7 : 0);
		ctx.beginPath();
		ctx.moveTo(gx, g.y);
		ctx.lineTo(gx + g.ux * reach, g.y + g.uy * reach);
		ctx.stroke();
		ctx.setLineDash(FORECAST_SOLID);
		ctx.globalAlpha = 1;
		ctx.fillStyle = css;
		ctx.beginPath();
		ctx.arc(gx, g.y, simField.wallT * 0.9, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#edf0f6';
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.strokeStyle = css;
		ctx.lineWidth = 1 + forceScale * 1.5;
		ctx.globalAlpha = 0.85;
		ctx.beginPath();
		ctx.arc(gx, g.y, simField.wallT * 0.9 + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * forceScale);
		ctx.stroke();
		ctx.globalAlpha = 1;
		const barW = simField.wallT * 2.0;
		const barH = 3.5;
		const barX = gx - barW / 2;
		const barY = g.y + simField.wallT * 1.25;
		ctx.fillStyle = '#0b1119';
		ctx.fillRect(barX, barY, barW, barH);
		ctx.fillStyle = g.energy < g.energyCap * 0.25 ? '#ff7a7a' : (id === 0 ? '#f05656' : '#5b7cff');
		ctx.fillRect(barX, barY, barW * (g.energyCap > 0 ? g.energy / g.energyCap : 0), barH);
		ctx.strokeStyle = '#445263';
		ctx.lineWidth = 0.7;
		ctx.strokeRect(barX, barY, barW, barH);
		for (let k = 0; k < g.stored; k++) {
			ctx.fillStyle = g.storeCss[k];
			ctx.beginPath();
			ctx.arc(gx + (k - (g.stored - 1) / 2) * g.storeR[k] * 1.0, g.y + simField.wallT * 2.1, g.storeR[k], 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = '#12151b';
			ctx.lineWidth = 1;
			ctx.stroke();
		}
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
	if (territoryState.highlightOwner !== MODE_NONE || end === TRAJ_PASS) return 2;
	return 1;
}

const territoryView = {
	resize: territoryResize,
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

if (typeof module !== 'undefined') module.exports = {
	territoryUi, territoryHudInit, territoryHudPaint, territoryInput, territoryView, territoryMarkWidth
};
