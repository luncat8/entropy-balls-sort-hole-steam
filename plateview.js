// owns: plate-color HUD, gesture/key mapping, plate/room/gun canvas drawing and forecast styling
// edit for: plate HUD readouts, key bindings, plate bar/door/gun visuals

const PLATE_RAY_DASH = [7, 7];
const PLATE_BAR_CSS = '#6e7b93';
const PLATE_DOOR_SHUT_CSS = '#384152';
const PLATE_PREDICT_CSS = '#7fe3c0';
const PLATE_REFUSE_CSS = '#ff7a7a';

const plateUi = {
	hud: null,
	open: null,
	captured: [null, null],
	force: [null, null],
	energy: [null, null],
	stored: [null, null]
};
const plateHudCache = new Int16Array(10);
plateHudCache.fill(-2);

function plateHudInit() {
	plateUi.hud = $('plate-hud');
	plateUi.open = $('plate-open');
	for (let id = 0; id < 2; id++) {
		plateUi.captured[id] = $('plate-cap-' + id);
		plateUi.force[id] = $('plate-force-' + id);
		plateUi.energy[id] = $('plate-energy-' + id);
		plateUi.stored[id] = $('plate-stored-' + id);
	}
	plateHudCache.fill(-2);
}

function plateOpenCode() {
	const rMin = simBallRadius.max * 2;
	const redOpen = plateState.openHi[0] - plateState.openLo[0] >= rMin;
	const blueOpen = plateState.openHi[1] - plateState.openLo[1] >= rMin;
	if (redOpen) return 1;
	if (blueOpen) return 2;
	return 0;
}

function plateHudPaint() {
	const openCode = plateOpenCode();
	const shiftPct = Math.round((plateState.x / simField.w - 0.5) * 1000);
	if (plateHudCache[0] !== openCode || plateHudCache[1] !== shiftPct) {
		plateHudCache[0] = openCode;
		plateHudCache[1] = shiftPct;
		if (plateUi.open) {
			plateUi.open.textContent = openCode === 1 ? 'P1 red open'
				: (openCode === 2 ? 'P2 blue open' : 'both doors shut');
		}
	}
	for (let id = 0; id < 2; id++) {
		const base = 2 + id * 4;
		const cap = plateState.captured[id];
		const f = Math.round(plateGuns[id].force);
		const e = Math.round(plateGuns[id].energy);
		const s = plateGuns[id].stored;
		if (plateHudCache[base] === cap && plateHudCache[base + 1] === f
			&& plateHudCache[base + 2] === e && plateHudCache[base + 3] === s) continue;
		plateHudCache[base] = cap;
		plateHudCache[base + 1] = f;
		plateHudCache[base + 2] = e;
		plateHudCache[base + 3] = s;
		if (plateUi.captured[id]) plateUi.captured[id].textContent = cap + ' captured';
		if (plateUi.force[id]) plateUi.force[id].textContent = f + '% force';
		if (plateUi.energy[id]) plateUi.energy[id].textContent = e + '/' + Math.round(plateGuns[id].energyCap) + ' energy';
		if (plateUi.stored[id]) plateUi.stored[id].textContent = s + '/' + PLATE_STORE_CAP;
	}
}

const plateInput = {
	keys: true,
	aim(x, y) { plateSetAim(0, x, y); },
	pull(on) { plateGuns[0].pull = on ? 1 : 0; },
	push() { platePush(0); },
	key(code, down) {
		const g1 = plateGuns[1];
		if (code === 'KeyA') plateKeys.p1Left = down ? 1 : 0;
		else if (code === 'KeyD') plateKeys.p1Right = down ? 1 : 0;
		else if (code === 'KeyW' && down) inputSetValue(0, Math.abs(inputValue(0)) + INPUT_FORCE_STEP);
		else if (code === 'KeyS' && down) inputSetValue(0, Math.max(INPUT_FORCE_STEP, Math.abs(inputValue(0)) - INPUT_FORCE_STEP));
		else if (code === 'ArrowLeft') plateKeys.p2Left = down ? 1 : 0;
		else if (code === 'ArrowRight') plateKeys.p2Right = down ? 1 : 0;
		else if (code === 'ArrowUp') g1.aimUp = down ? 1 : 0;
		else if (code === 'ArrowDown') g1.aimDown = down ? 1 : 0;
		else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Period') g1.pull = down ? 1 : 0;
		else if ((code === 'Space' || code === 'Enter') && down) platePush(1);
		else if (code === 'BracketLeft' && down) plateSetGunForce(1, g1.force - PLATE_FORCE_STEP);
		else if (code === 'BracketRight' && down) plateSetGunForce(1, g1.force + PLATE_FORCE_STEP);
		else if (code === 'Comma' && down) plateSetGunForce(0, plateGuns[0].force - PLATE_FORCE_STEP);
	},
	wheel(deltaY) { plateWheel(0, deltaY); },
	cancel() { plateRelease(); }
};

function plateDrawRooms(ctx) {
	const t = simField.wallT;
	for (let k = 0; k < 2; k++) {
		const rm = plateRooms[k];
		ctx.fillStyle = MODE_ROOM_FILL[rm.owner];
		ctx.fillRect(rm.x, rm.y, rm.w, rm.h);
		ctx.strokeStyle = MODE_CSS[rm.owner];
		ctx.lineWidth = t * 0.85;
		ctx.beginPath();
		ctx.moveTo(rm.x, rm.y);
		ctx.lineTo(rm.x, rm.y + rm.h);
		ctx.moveTo(rm.x + rm.w, rm.y);
		ctx.lineTo(rm.x + rm.w, rm.y + rm.h);
		ctx.stroke();
	}
}

function plateDrawWall(ctx) {
	const f = simField;
	const t = f.wallT;
	const half = simAperture.size / 2;
	ctx.fillStyle = '#495263';
	ctx.fillRect(f.wallX - t / 2, 0, t, simAperture.y - half);
	ctx.fillRect(f.wallX - t / 2, simAperture.y + half, t, f.h - simAperture.y - half);
	const py = plateState.y - t / 2;
	// fixed chamber barrier at plateY with the two room doors cut out
	ctx.fillStyle = PLATE_DOOR_SHUT_CSS;
	ctx.fillRect(0, py, plateState.doorLo[0], t);
	ctx.fillRect(plateState.doorHi[0], py, plateState.doorLo[1] - plateState.doorHi[0], t);
	ctx.fillRect(plateState.doorHi[1], py, f.w - plateState.doorHi[1], t);
	// sliding two-hole shutter bar overlaid along plateY
	const barH = t * 1.35;
	const barY = plateState.y - barH / 2;
	ctx.fillStyle = PLATE_BAR_CSS;
	ctx.fillRect(plateState.barLo, barY, Math.max(0, plateState.holeLo[0] - plateState.barLo), barH);
	ctx.fillRect(plateState.holeHi[0], barY, Math.max(0, plateState.holeLo[1] - plateState.holeHi[0]), barH);
	ctx.fillRect(plateState.holeHi[1], barY, Math.max(0, plateState.barHi - plateState.holeHi[1]), barH);
	for (let k = 0; k < 2; k++) {
		const openW = plateState.openHi[k] - plateState.openLo[k];
		const owner = plateRooms[k].owner;
		ctx.strokeStyle = MODE_CSS[owner];
		ctx.lineWidth = 1.6;
		ctx.strokeRect(plateState.doorLo[k], py - 1, plateState.doorHi[k] - plateState.doorLo[k], t + 2);
		if (openW < simBallRadius.max * 2) continue;
		ctx.fillStyle = MODE_PASS_FILL[owner];
		ctx.fillRect(plateState.openLo[k], barY - 1, openW, barH + 2);
	}
}

function plateDrawOverlay(ctx) {
	const reach = plateRayReach();
	const t = simField.wallT;
	for (let i = 0; i < simBalls.count; i++) {
		const owner = plateState.colorized[i];
		if (!owner) continue;
		ctx.strokeStyle = MODE_CSS[owner];
		ctx.lineWidth = 2.2;
		ctx.beginPath();
		ctx.arc(simBalls.x[i], simBalls.y[i], simBalls.r[i] + 3, 0, Math.PI * 2);
		ctx.stroke();
	}
	for (let id = 0; id < 2; id++) {
		const g = plateGuns[id];
		const owner = plateOwnerOfGun(id);
		const css = MODE_CSS[owner];
		const forceScale = g.force / 100;
		const radius = t * 1.1;
		const cx = id === 0 ? radius : simField.w - radius;
		ctx.setLineDash(PLATE_RAY_DASH);
		ctx.globalAlpha = g.pull ? 0.36 + forceScale * 0.42 : 0.16 + forceScale * 0.18;
		ctx.strokeStyle = css;
		ctx.lineWidth = 1 + forceScale * 2.3 + (g.pull ? 0.7 : 0);
		ctx.beginPath();
		ctx.moveTo(g.x, g.y);
		ctx.lineTo(g.x + g.ux * reach, g.y + g.uy * reach);
		ctx.stroke();
		ctx.setLineDash(FORECAST_SOLID);
		ctx.globalAlpha = 1;
		ctx.fillStyle = css;
		ctx.beginPath();
		ctx.arc(cx, g.y, radius, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#12151b';
		ctx.lineWidth = 1.8;
		ctx.stroke();
		const barW = radius * 2.2;
		const barH = 3.8;
		const barX = id === 0 ? 4 : simField.w - barW - 4;
		const barY = g.y + radius + 6;
		ctx.fillStyle = '#0b1119';
		ctx.fillRect(barX, barY, barW, barH);
		ctx.fillStyle = g.energy < g.energyCap * 0.25 ? '#ff7a7a' : css;
		ctx.fillRect(barX, barY, barW * (g.energyCap > 0 ? g.energy / g.energyCap : 0), barH);
		const storeX = id === 0 ? radius * 2.5 : simField.w - radius * 2.5;
		for (let k = 0; k < g.stored; k++) {
			ctx.fillStyle = g.storeCss[k];
			ctx.beginPath();
			ctx.arc(storeX, g.y + (k - (g.stored - 1) / 2) * g.storeR[k] * 1.6, g.storeR[k], 0, Math.PI * 2);
			ctx.fill();
			ctx.strokeStyle = '#12151b';
			ctx.lineWidth = 1;
			ctx.stroke();
		}
		if (g.target >= 0 && g.target < simBalls.count) {
			ctx.strokeStyle = g.refused ? PLATE_REFUSE_CSS : css;
			ctx.lineWidth = 2.2;
			ctx.beginPath();
			ctx.arc(simBalls.x[g.target], simBalls.y[g.target], simBalls.r[g.target] + 4.5, 0, Math.PI * 2);
			ctx.stroke();
		}
		platePredict(id);
		if (g.path.n < 2) continue;
		ctx.setLineDash(FORECAST_DASH);
		ctx.lineWidth = 2.2;
		canvasStrokeForecast(ctx, g.path, g.refused ? PLATE_REFUSE_CSS : PLATE_PREDICT_CSS);
		ctx.setLineDash(FORECAST_SOLID);
	}
}

const plateView = {
	resize() { plateResize(); },
	background: plateDrawRooms,
	wall: plateDrawWall,
	overlay: plateDrawOverlay,
	forecast(i, end) {
		if (i === plateGuns[0].target || i === plateGuns[1].target) return 2;
		return end === TRAJ_HIT ? 1 : 0;
	},
	forecastCss(i) {
		if (i === plateGuns[0].target) return MODE_CSS[MODE_RED];
		if (i === plateGuns[1].target) return MODE_CSS[MODE_BLUE];
		return simBalls.css[i];
	}
};

if (typeof module !== 'undefined') module.exports = {
	plateUi, plateHudInit, plateHudPaint, plateOpenCode, plateInput, plateView
};
