// owns: canvas sizing/drawing, impact marks, forecast cues and their controls, and the held quest goal layer
// edit for: drawing options and styles, mode drawing hooks

const IMPACT_TTL = 3;
const IMPACT_CAP = 128;

const STYLE_BG = '#12151b';
const STYLE_WALL = '#495263';
const FORECAST_ALPHA = 0.85;
const FORECAST_W = 2;
// dash and gap are pixels like the line width: a stroke pattern has to stay readable, not scale with the field
const FORECAST_DASH = [8, 8];
const FORECAST_DASH_SPAN = FORECAST_DASH[0] + FORECAST_DASH[1];
const FORECAST_SOLID = [];
// Fade over the live mean free path; beyond four paths the cue is nearly invisible.
// With contacts off there is no contact fade.
const GOAL_RING = 'rgba(237, 240, 246, 0.9)';
const GOAL_RING_W = 2;
const GOAL_DIM_ALPHA = 0.35;
const AURA_RING_CSS = '#ff9d5c';
const AURA_RING_W = 1.8;

const canvasView = { dpr: 1, w: 0, h: 0 };
const canvasDrawOptions = {
	predictedPosition: true, trajectoryLines: true, slowFadeHitSpot: false,
	drawPassLines: false, prototypeDash: true
};

const impactMarks = {
	x: new Float32Array(IMPACT_CAP),
	y: new Float32Array(IMPACT_CAP),
	radius: new Float32Array(IMPACT_CAP),
	side: new Int8Array(IMPACT_CAP),
	rgb: new Uint32Array(IMPACT_CAP),
	age: new Float32Array(IMPACT_CAP),
	css: new Array(IMPACT_CAP),
	write: 0
};
impactMarks.age.fill(IMPACT_TTL + 1);

let cvEl = null;
let cvCtx = null;
let goalBallsHook = null;
let canvasModeHook = null;
let predictedPositionInput = null;
let trajectoryLinesInput = null;
let slowFadeHitSpotInput = null;
let passLinesInput = null;
let prototypeDashInput = null;

function canvasInit() {
	cvEl = $('canv');
	cvCtx = cvEl.getContext('2d');
	canvasInitDrawOptions();
	window.addEventListener('resize', canvasResize);
	new ResizeObserver(canvasResize).observe(cvEl);
	canvasResize();
}

function canvasInitDrawOptions() {
	predictedPositionInput = $('draw-predicted-position');
	trajectoryLinesInput = $('draw-trajectory-lines');
	slowFadeHitSpotInput = $('draw-slow-fade-hit-spot');
	passLinesInput = $('draw-pass-lines');
	prototypeDashInput = $('draw-prototype-dash');
	predictedPositionInput.checked = canvasDrawOptions.predictedPosition;
	trajectoryLinesInput.checked = canvasDrawOptions.trajectoryLines;
	slowFadeHitSpotInput.checked = canvasDrawOptions.slowFadeHitSpot;
	passLinesInput.checked = canvasDrawOptions.drawPassLines;
	prototypeDashInput.checked = canvasDrawOptions.prototypeDash;
	predictedPositionInput.addEventListener('change', canvasPredictedPositionChanged);
	trajectoryLinesInput.addEventListener('change', canvasTrajectoryLinesChanged);
	slowFadeHitSpotInput.addEventListener('change', canvasSlowFadeHitSpotChanged);
	passLinesInput.addEventListener('change', canvasPassLinesChanged);
	prototypeDashInput.addEventListener('change', canvasPrototypeDashChanged);
}

function canvasPredictedPositionChanged() {
	canvasDrawOptions.predictedPosition = predictedPositionInput.checked;
}

function canvasTrajectoryLinesChanged() {
	canvasDrawOptions.trajectoryLines = trajectoryLinesInput.checked;
}

function canvasSlowFadeHitSpotChanged() {
	canvasDrawOptions.slowFadeHitSpot = slowFadeHitSpotInput.checked;
	if (!canvasDrawOptions.slowFadeHitSpot) impactMarks.age.fill(IMPACT_TTL + 1);
}

function canvasPassLinesChanged() {
	canvasDrawOptions.drawPassLines = passLinesInput.checked;
}

function canvasPrototypeDashChanged() {
	canvasDrawOptions.prototypeDash = prototypeDashInput.checked;
}

// Estimate the live field's mean free path using the actual ball radii and field area.
function canvasForecastReach() {
	const n = simBalls.count;
	if (!simBallCollisions || n < 2) return Infinity;
	let radii = 0;
	for (let i = 0; i < n; i++) radii += simBalls.r[i];
	if (radii <= 0) return Infinity;
	return simField.w * simField.h / (Math.SQRT2 * 4 * (radii / n) * n);
}

// The backing store scales with the device pixel ratio, the world does not: the field is the CSS
// area of the canvas, so a world unit is a CSS pixel and pointer positions need no conversion.
function canvasResize() {
	const dpr = window.devicePixelRatio || 1;
	const cw = Math.round(cvEl.clientWidth);
	const ch = Math.round(cvEl.clientHeight);
	const w = Math.round(cw * dpr) || 1;
	const h = Math.round(ch * dpr) || 1;
	if (w !== canvasView.w || h !== canvasView.h) {
		cvEl.width = w;
		cvEl.height = h;
		canvasView.w = w;
		canvasView.h = h;
		canvasView.dpr = dpr;
	}
	simResizeField(cw, ch);
	if (typeof roomsResize !== 'undefined' && roomsState && roomsState.count) roomsResize();
	if (canvasModeHook && canvasModeHook.resize) canvasModeHook.resize();
}

function canvasFieldY(clientY) {
	const rect = cvEl.getBoundingClientRect();
	return (clientY - rect.top) * simField.h / cvEl.clientHeight;
}

function canvasFieldX(clientX) {
	const rect = cvEl.getBoundingClientRect();
	return (clientX - rect.left) * simField.w / cvEl.clientWidth;
}

// the goal layer is optional: no hook or a null result means the live field is what gets drawn
function canvasSetGoalHook(hook) {
	goalBallsHook = hook;
}

// a mode may own its background, wall and overlay; no hook draws the standard field
function canvasSetModeHook(hook) {
	canvasModeHook = hook;
}

function canvasAddImpact(faceX, y, radius, side, rgb) {
	if (!canvasDrawOptions.slowFadeHitSpot) return;
	const i = impactMarks.write;
	impactMarks.x[i] = faceX;
	impactMarks.y[i] = y;
	impactMarks.radius[i] = radius;
	impactMarks.side[i] = side;
	impactMarks.rgb[i] = rgb;
	impactMarks.age[i] = 0;
	impactMarks.css[i] = colorCss(rgb); // one string per mark so the draw loop stays alloc-free
	impactMarks.write = (i + 1) % IMPACT_CAP;
}

function canvasDraw(dtSec) {
	if (canvasDrawOptions.slowFadeHitSpot) {
		for (let i = 0; i < IMPACT_CAP; i++) {
			if (impactMarks.age[i] <= IMPACT_TTL) impactMarks.age[i] += dtSec;
		}
	}
	const ctx = cvCtx;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.globalAlpha = 1;
	ctx.fillStyle = STYLE_BG;
	ctx.fillRect(0, 0, canvasView.w, canvasView.h);
	ctx.setTransform(canvasView.dpr, 0, 0, canvasView.dpr, 0, 0);
	if (typeof roomsDrawBackground !== 'undefined' && roomsState && roomsState.enabled) roomsDrawBackground(ctx);
	if (canvasModeHook && canvasModeHook.background) canvasModeHook.background(ctx);
	const f = simField;
	const half = simAperture.size / 2;
	if (canvasModeHook && canvasModeHook.wall) canvasModeHook.wall(ctx);
	else {
		ctx.fillStyle = STYLE_WALL;
		ctx.fillRect(f.wallX - f.wallT / 2, 0, f.wallT, simAperture.y - half);
		ctx.fillRect(f.wallX - f.wallT / 2, simAperture.y + half, f.wallT, f.h - simAperture.y - half);
	}
	if (typeof roomsDrawWalls !== 'undefined' && roomsState && roomsState.enabled) roomsDrawWalls(ctx);
	// impact and forecast cues describe live motion; a goal layer is a still frame, so they would lie
	const goal = goalBallsHook ? goalBallsHook() : null;
	if (!goal && canvasDrawOptions.slowFadeHitSpot) {
		for (let i = 0; i < IMPACT_CAP; i++) {
			const age = impactMarks.age[i];
			if (age > IMPACT_TTL) continue;
			ctx.globalAlpha = 1 - age / IMPACT_TTL;
			ctx.fillStyle = impactMarks.css[i];
			canvasFillWallPatch(ctx, impactMarks.x[i], impactMarks.y[i], impactMarks.radius[i], impactMarks.side[i]);
		}
	}
	if (!goal) canvasDrawForecasts(ctx, canvasDrawOptions.predictedPosition, canvasDrawOptions.trajectoryLines);
	ctx.globalAlpha = 1;
	canvasDrawBalls(ctx, goal || simBalls, goal);
	if (!goal && canvasModeHook && canvasModeHook.overlay) canvasModeHook.overlay(ctx);
}

// a goal layer dims the balls that stay put and rings the ones that cross, so the same picture answers
// "what will the field look like" and "which balls does the objective need me to move"
function canvasDrawBalls(ctx, balls, goal) {
	const solid = goal ? GOAL_DIM_ALPHA : 1;
	for (let i = 0; i < balls.count; i++) {
		const moved = !!goal && balls.moved[i] === 1;
		ctx.globalAlpha = moved ? 1 : solid;
		ctx.fillStyle = balls.css[i];
		ctx.beginPath();
		ctx.arc(balls.x[i], balls.y[i], balls.r[i], 0, Math.PI * 2);
		ctx.fill();
		if (moved) {
			ctx.strokeStyle = GOAL_RING;
			ctx.lineWidth = GOAL_RING_W;
			ctx.stroke();
			continue;
		}
		if (goal || !simBallArmed[i]) continue;
		const timeLeft = 1 - simBallAuraT[i] / SIM_AURA_MAX_SEC;
		const bounceLeft = 1 - simBallAuraBounces[i] / SIM_AURA_MAX_BOUNCES;
		const life = timeLeft < bounceLeft ? timeLeft : bounceLeft;
		ctx.globalAlpha = 0.25 + 0.65 * (life > 0 ? life : 0);
		ctx.strokeStyle = AURA_RING_CSS;
		ctx.lineWidth = AURA_RING_W;
		ctx.beginPath();
		ctx.arc(balls.x[i], balls.y[i], balls.r[i] + 3.5, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
}

// A ball that only clips a lip shades next to none of the plate, so the mark on the plate nearer to it
// never shrinks below the plate's own thickness: the tip of the lip lights up.
function canvasFillWallPatch(ctx, faceX, centerY, radius, side) {
	const wallT = simField.wallT;
	const x = faceX + (side > 0 ? -wallT : 0);
	const half = simAperture.size / 2;
	const apTop = simAperture.y - half;
	const apBot = simAperture.y + half;
	let top = centerY - radius;
	let bottom = centerY + radius;
	if (centerY < simAperture.y) top = Math.min(top, apTop - wallT);
	else bottom = Math.max(bottom, apBot + wallT);
	if (top < apTop) ctx.fillRect(x, top, wallT, Math.min(bottom, apTop) - top);
	if (bottom > apBot) ctx.fillRect(x, Math.max(top, apBot), wallT, bottom - Math.max(top, apBot));
}

// one trace per ball feeds both cues, so the patch on the plate and the line that leads to it cannot disagree
function canvasDrawForecasts(ctx, showPosition, showLines) {
	if (!showPosition && !showLines) return;
	const baseReach = canvasForecastReach();
	const reach = canvasModeHook && canvasModeHook.forecastReach ? canvasModeHook.forecastReach(baseReach) : baseReach;
	ctx.lineWidth = FORECAST_W;
	ctx.setLineDash(FORECAST_DASH);
	for (let i = 0; i < simBalls.count; i++) {
		const r = simBalls.r[i];
		const budget = canvasModeHook && canvasModeHook.forecastBudget ? canvasModeHook.forecastBudget(i) : TRAJ_POINTS;
		const end = trajTrace(simBalls.x[i], simBalls.y[i], simBalls.vx[i], simBalls.vy[i], r, reach * 4, trajPath, i, budget, 0);
		if (end === TRAJ_NONE) continue;
		let style = 1;
		if (canvasModeHook && canvasModeHook.forecast) style = canvasModeHook.forecast(i, end, trajPath);
		if (style === 0) continue;
		ctx.globalAlpha = style === 2 || reach === Infinity ? FORECAST_ALPHA
			: FORECAST_ALPHA * Math.exp(-trajPath.dist / reach);
		const css = style === 2 && canvasModeHook.forecastCss ? canvasModeHook.forecastCss(i, end, trajPath) : simBalls.css[i];
		if (showPosition && end === TRAJ_HIT && !(canvasModeHook && canvasModeHook.noPositionMarks)) {
			ctx.fillStyle = css;
			const faceX = simField.wallX + trajPath.side * simField.wallT / 2;
			canvasFillWallPatch(ctx, faceX, trajPath.y[trajPath.n - 1], r, trajPath.side);
		}
		if (showLines && (end === TRAJ_HIT || canvasDrawOptions.drawPassLines || style === 2)) {
			if (style === 2) ctx.lineWidth = FORECAST_W * 1.8;
			canvasStrokeForecast(ctx, trajPath, css);
			if (style === 2) ctx.lineWidth = FORECAST_W;
		}
	}
	ctx.setLineDash(FORECAST_SOLID);
}

// Two dash anchors: the prototype's, where the pattern starts at the ball and moves with it, and the
// field's, where it is pinned to the spot the ball first touches the divider so the dashes stand still
// and the ball eats them. Each leg is stroked on its own, as a level line in a frame turned along it:
// Chromium's GPU canvas dashes only that shape in a shader and cuts any other dashed path into pieces
// on the CPU every frame, two to three times the frame's raster cost (plan 0.6, forecast_raster.js).
function canvasStrokeForecast(ctx, path, css) {
	const dpr = canvasView.dpr;
	let offset = canvasDrawOptions.prototypeDash ? 0
		: FORECAST_DASH_SPAN - (path.dist + FORECAST_DASH[1]) % FORECAST_DASH_SPAN;
	ctx.strokeStyle = css;
	for (let k = 1; k < path.n; k++) {
		let endX = path.x[k];
		let endY = path.y[k];
		if (k === path.n - 1 && path.end === TRAJ_HIT) {
			// Extend the centre forecast to the visible face, including a lip hit.
			const faceX = simField.wallX + path.side * simField.wallT / 2;
			const half = simAperture.size / 2;
			const top = simAperture.y - half;
			const bottom = simAperture.y + half;
			const dx = endX - path.x[k - 1];
			const dy = endY - path.y[k - 1];
			if (dx) endY += dy * (faceX - endX) / dx;
			if (endY > top && endY < bottom) endY = endY < simAperture.y ? top : bottom;
			endX = faceX;
		}
		const dx = endX - path.x[k - 1];
		const dy = endY - path.y[k - 1];
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len < 1e-9) continue;
		const ux = dpr * dx / len;
		const uy = dpr * dy / len;
		ctx.setTransform(ux, uy, -uy, ux, dpr * path.x[k - 1], dpr * path.y[k - 1]);
		ctx.lineDashOffset = offset;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(len, 0);
		ctx.stroke();
		// A moving dash can end in a gap. Finish the hit with a short solid tip so it
		// always meets the wall without changing the moving pattern on the flight.
		if (k === path.n - 1 && path.end === TRAJ_HIT) {
			ctx.setLineDash(FORECAST_SOLID);
			ctx.beginPath();
			ctx.moveTo(Math.max(0, len - FORECAST_W * 2), 0);
			ctx.lineTo(len, 0);
			ctx.stroke();
			ctx.setLineDash(FORECAST_DASH);
		}
		offset = (offset + len) % FORECAST_DASH_SPAN;
	}
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

if (typeof module !== 'undefined') module.exports = {
	canvasView,
	canvasDrawOptions,
	impactMarks,
	canvasInit,
	canvasResize,
	canvasFieldY,
	canvasFieldX,
	canvasDraw,
	canvasAddImpact,
	canvasSetGoalHook,
	canvasSetModeHook,
	canvasStrokeForecast,
	canvasForecastReach,
	GOAL_RING,
	GOAL_RING_W,
	GOAL_DIM_ALPHA,
	IMPACT_CAP,
	IMPACT_TTL,
	FORECAST_ALPHA,
	FORECAST_DASH
};
