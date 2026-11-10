// owns: canvas sizing/drawing, impact marks, forecast cues and their controls, and the held quest goal layer
// edit for: drawing options and styles

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
// A cue is drawn while its ball's flight to the divider is inside this reach, and its opacity falls
// linearly to zero at it, so brightness says how far a forecast can be trusted: with ball contacts on and
// the default 24 balls, one made under 100 shares ahead comes true 94 % of the time, 300-400 ahead 53 %,
// 600-700 ahead 30 % (experiments/forecast_probe.js).
const FORECAST_REACH_SHARE = 700;
const GOAL_RING = 'rgba(237, 240, 246, 0.9)';
const GOAL_RING_W = 2;
const GOAL_DIM_ALPHA = 0.35;

const canvasView = { dpr: 1, w: 0, h: 0 };
const canvasDrawOptions = { predictedPosition: true, trajectoryLines: true, slowFadeHitSpot: false };

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
let predictedPositionInput = null;
let trajectoryLinesInput = null;
let slowFadeHitSpotInput = null;

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
	predictedPositionInput.checked = canvasDrawOptions.predictedPosition;
	trajectoryLinesInput.checked = canvasDrawOptions.trajectoryLines;
	slowFadeHitSpotInput.checked = canvasDrawOptions.slowFadeHitSpot;
	predictedPositionInput.addEventListener('change', canvasPredictedPositionChanged);
	trajectoryLinesInput.addEventListener('change', canvasTrajectoryLinesChanged);
	slowFadeHitSpotInput.addEventListener('change', canvasSlowFadeHitSpotChanged);
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
}

function canvasFieldY(clientY) {
	const rect = cvEl.getBoundingClientRect();
	return (clientY - rect.top) * simField.h / cvEl.clientHeight;
}

// the goal layer is optional: no hook or a null result means the live field is what gets drawn
function canvasSetGoalHook(hook) {
	goalBallsHook = hook;
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
	// the screen edge is the field boundary: balls reflect off it, so nothing is drawn there
	ctx.setTransform(canvasView.dpr, 0, 0, canvasView.dpr, 0, 0);
	const f = simField;
	const half = simAperture.size / 2;
	ctx.fillStyle = STYLE_WALL;
	ctx.fillRect(f.wallX - f.wallT / 2, 0, f.wallT, simAperture.y - half);
	ctx.fillRect(f.wallX - f.wallT / 2, simAperture.y + half, f.wallT, f.h - simAperture.y - half);
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
		if (!moved) continue;
		ctx.strokeStyle = GOAL_RING;
		ctx.lineWidth = GOAL_RING_W;
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
	const reach = simPx(FORECAST_REACH_SHARE);
	ctx.lineWidth = FORECAST_W;
	ctx.setLineDash(FORECAST_DASH);
	for (let i = 0; i < simBalls.count; i++) {
		const r = simBalls.r[i];
		const end = trajTrace(simBalls.x[i], simBalls.y[i], simBalls.vx[i], simBalls.vy[i], r, reach, trajPath);
		if (end === TRAJ_NONE) continue;
		ctx.globalAlpha = FORECAST_ALPHA * (1 - trajPath.dist / reach);
		if (showPosition && end === TRAJ_HIT) {
			ctx.fillStyle = simBalls.css[i];
			const faceX = simField.wallX + trajPath.side * simField.wallT / 2;
			canvasFillWallPatch(ctx, faceX, trajPath.y[trajPath.n - 1], r, trajPath.side);
		}
		if (showLines) canvasStrokeForecast(ctx, trajPath, simBalls.css[i]);
	}
	ctx.setLineDash(FORECAST_SOLID);
}

// The dash pattern is pinned to the spot where the ball first touches the divider, not to the ball: the
// dashes stand still in the field and the ball eats them, so the only things moving on screen are balls.
// Each leg is stroked on its own, as a level line in a frame turned along it: Chromium's GPU canvas
// dashes only that shape in a shader and cuts any other dashed path into pieces on the CPU every frame,
// two to three times the frame's raster cost (plan 0.6, experiments/forecast_raster.js).
function canvasStrokeForecast(ctx, path, css) {
	const dpr = canvasView.dpr;
	let offset = FORECAST_DASH_SPAN - (path.dist + FORECAST_DASH[1]) % FORECAST_DASH_SPAN;
	ctx.strokeStyle = css;
	for (let k = 1; k < path.n; k++) {
		const dx = path.x[k] - path.x[k - 1];
		const dy = path.y[k] - path.y[k - 1];
		const len = Math.sqrt(dx * dx + dy * dy);
		const ux = dpr * dx / len;
		const uy = dpr * dy / len;
		ctx.setTransform(ux, uy, -uy, ux, dpr * path.x[k - 1], dpr * path.y[k - 1]);
		ctx.lineDashOffset = offset;
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(len, 0);
		ctx.stroke();
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
	canvasDraw,
	canvasAddImpact,
	canvasSetGoalHook,
	GOAL_RING,
	GOAL_RING_W,
	GOAL_DIM_ALPHA,
	IMPACT_CAP,
	IMPACT_TTL,
	FORECAST_ALPHA,
	FORECAST_DASH,
	FORECAST_REACH_SHARE
};
