// owns: canvas sizing/drawing, impact/forecast buffers, visual cue controls, and the held quest goal layer
// edit for: drawing options and styles

const IMPACT_TTL = 3;
const IMPACT_CAP = 128;

const STYLE_BG = '#12151b';
const STYLE_WALL = '#495263';
const FORECAST_ALPHA = 0.55;
const FORECAST_W = 2;
const GOAL_RING = 'rgba(237, 240, 246, 0.9)';
const GOAL_RING_W = 2;
const GOAL_DIM_ALPHA = 0.35;

const canvasView = { scale: 1, offX: 0, offY: 0, w: 0, h: 0 };
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

const forecastScratch = new Float32Array(4);

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

function canvasResize() {
	const dpr = window.devicePixelRatio || 1;
	const w = Math.round(cvEl.clientWidth * dpr);
	const h = Math.round(cvEl.clientHeight * dpr);
	if (w === canvasView.w && h === canvasView.h) return;
	cvEl.width = w;
	cvEl.height = h;
	canvasView.w = w;
	canvasView.h = h;
	canvasView.scale = Math.min(w / simField.w, h / simField.h);
	canvasView.offX = (w - simField.w * canvasView.scale) / 2;
	canvasView.offY = (h - simField.h * canvasView.scale) / 2;
}

// the goal layer is optional: no hook or a null result means the live field is what gets drawn
function canvasSetGoalHook(hook) {
	goalBallsHook = hook;
}

function canvasToWorldY(clientY) {
	const rect = cvEl.getBoundingClientRect();
	return ((clientY - rect.top) * (canvasView.h / rect.height) - canvasView.offY) / canvasView.scale;
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
	ctx.setTransform(canvasView.scale, 0, 0, canvasView.scale, canvasView.offX, canvasView.offY);
	const f = simField;
	const half = simAperture.size / 2;
	const apTop = simAperture.y - half;
	const apBot = simAperture.y + half;
	ctx.fillStyle = STYLE_WALL;
	ctx.fillRect(0, 0, f.w, f.wallT);
	ctx.fillRect(0, f.h - f.wallT, f.w, f.wallT);
	ctx.fillRect(0, 0, f.wallT, f.h);
	ctx.fillRect(f.w - f.wallT, 0, f.wallT, f.h);
	ctx.fillRect(f.wallX - f.wallT / 2, 0, f.wallT, apTop);
	ctx.fillRect(f.wallX - f.wallT / 2, apBot, f.wallT, f.h - apBot);
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
	const showPredictedPosition = !goal && canvasDrawOptions.predictedPosition;
	const showTrajectoryLines = !goal && canvasDrawOptions.trajectoryLines;
	if (showPredictedPosition || showTrajectoryLines) {
		ctx.globalAlpha = FORECAST_ALPHA;
		if (showTrajectoryLines) ctx.lineWidth = FORECAST_W;
		for (let i = 0; i < simBalls.count; i++) {
			if (!canvasForecast(i, forecastScratch)) continue;
			const side = simBalls.vx[i] > 0 ? -1 : 1;
			if (showPredictedPosition) {
				ctx.fillStyle = simBalls.css[i];
				canvasFillWallPatch(ctx, forecastScratch[2], forecastScratch[3], simBalls.r[i], side);
			}
			if (showTrajectoryLines) {
				ctx.strokeStyle = simBalls.css[i];
				ctx.beginPath();
				ctx.moveTo(forecastScratch[0], forecastScratch[1]);
				ctx.lineTo(forecastScratch[2], forecastScratch[3]);
				ctx.stroke();
			}
		}
	}
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

function canvasFillWallPatch(ctx, faceX, centerY, radius, side) {
	const wallT = simField.wallT;
	const x = faceX + (side > 0 ? -wallT : 0);
	const top = centerY - radius;
	const bottom = centerY + radius;
	const half = simAperture.size / 2;
	const apTop = simAperture.y - half;
	const apBot = simAperture.y + half;
	if (top < apTop) {
		const patchBottom = bottom < apTop ? bottom : apTop;
		if (patchBottom > top) ctx.fillRect(x, top, wallT, patchBottom - top);
	}
	if (bottom > apBot) {
		const patchTop = top > apBot ? top : apBot;
		if (bottom > patchTop) ctx.fillRect(x, patchTop, wallT, bottom - patchTop);
	}
}

// straight-line cue only; bounces and ball contacts can still invalidate it
function canvasForecast(i, out) {
	const x = simBalls.x[i], y = simBalls.y[i], r = simBalls.r[i];
	const vx = simBalls.vx[i], vy = simBalls.vy[i];
	if ((simField.wallX - x) * vx <= 0) return false;
	const faceX = simField.wallX - (vx > 0 ? r : -r);
	const tHit = (faceX - x) / vx;
	let tWall = Infinity;
	if (vy > 0) tWall = (simField.h - r - y) / vy;
	else if (vy < 0) tWall = (r - y) / vy;
	if (tWall < tHit) return false;
	const yHit = y + vy * tHit;
	const half = simAperture.size / 2;
	if (yHit - r >= simAperture.y - half && yHit + r <= simAperture.y + half) return false;
	const inv = 1 / Math.sqrt(vx * vx + vy * vy);
	out[0] = x + vx * inv * r;
	out[1] = y + vy * inv * r;
	out[2] = simField.wallX - (vx > 0 ? simField.wallT / 2 : -simField.wallT / 2);
	out[3] = yHit;
	return true;
}

if (typeof module !== 'undefined') module.exports = {
	canvasView,
	canvasDrawOptions,
	impactMarks,
	canvasInit,
	canvasResize,
	canvasDraw,
	canvasAddImpact,
	canvasSetGoalHook,
	canvasToWorldY,
	GOAL_RING,
	GOAL_RING_W,
	GOAL_DIM_ALPHA,
	IMPACT_CAP,
	IMPACT_TTL
};
