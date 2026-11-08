// owns: canvas sizing/drawing and impact/forecast buffers
// edit for: draw styles

const IMPACT_TTL = 2;
const IMPACT_CAP = 128;

const STYLE_BG = '#12151b';
const STYLE_WALL = '#495263';
const IMPACT_R = 3;
const FORECAST_ALPHA = 0.55;
const FORECAST_W = 2;

const canvasView = { scale: 1, offX: 0, offY: 0, w: 0, h: 0 };

const impactMarks = {
	x: new Float32Array(IMPACT_CAP),
	y: new Float32Array(IMPACT_CAP),
	rgb: new Uint32Array(IMPACT_CAP),
	age: new Float32Array(IMPACT_CAP),
	css: new Array(IMPACT_CAP),
	write: 0
};
impactMarks.age.fill(IMPACT_TTL + 1);

const forecastScratch = new Float32Array(4);

let cvEl = null;
let cvCtx = null;

function canvasInit() {
	cvEl = $('canv');
	cvCtx = cvEl.getContext('2d');
	window.addEventListener('resize', canvasResize);
	canvasResize();
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

function canvasToWorldY(clientY) {
	const rect = cvEl.getBoundingClientRect();
	return ((clientY - rect.top) * (canvasView.h / rect.height) - canvasView.offY) / canvasView.scale;
}

function canvasAddImpact(x, y, rgb) {
	const i = impactMarks.write;
	impactMarks.x[i] = x;
	impactMarks.y[i] = y;
	impactMarks.rgb[i] = rgb;
	impactMarks.age[i] = 0;
	impactMarks.css[i] = colorCss(rgb); // one string per mark so the draw loop stays alloc-free
	impactMarks.write = (i + 1) % IMPACT_CAP;
}

function canvasDraw(dtSec) {
	for (let i = 0; i < IMPACT_CAP; i++) {
		if (impactMarks.age[i] <= IMPACT_TTL) impactMarks.age[i] += dtSec;
	}
	const ctx = cvCtx;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
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
	for (let i = 0; i < IMPACT_CAP; i++) {
		const age = impactMarks.age[i];
		if (age > IMPACT_TTL) continue;
		ctx.globalAlpha = 1 - age / IMPACT_TTL;
		ctx.fillStyle = impactMarks.css[i];
		ctx.beginPath();
		ctx.arc(impactMarks.x[i], impactMarks.y[i], IMPACT_R, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.lineWidth = FORECAST_W;
	ctx.globalAlpha = FORECAST_ALPHA;
	for (let i = 0; i < simBalls.count; i++) {
		if (!canvasForecast(i, forecastScratch)) continue;
		ctx.strokeStyle = simBalls.css[i];
		ctx.beginPath();
		ctx.moveTo(forecastScratch[0], forecastScratch[1]);
		ctx.lineTo(forecastScratch[2], forecastScratch[3]);
		ctx.stroke();
	}
	for (let i = 0; i < simBalls.count; i++) {
		ctx.fillStyle = simBalls.css[i];
		ctx.beginPath();
		ctx.arc(simBalls.x[i], simBalls.y[i], simBalls.r[i], 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
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

if (typeof module !== 'undefined') module.exports = { canvasView, impactMarks, canvasInit, canvasResize, canvasDraw, canvasAddImpact, canvasToWorldY, IMPACT_CAP, IMPACT_TTL };
