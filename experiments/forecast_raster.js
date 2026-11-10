// owns: browser evidence for what a frame of forecast lines costs to raster — cues off, as shipped, and as one dashed polyline
// edit for: viewport, ball count, frame count, the alternative stroke

const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright-core');
const binary = require('@sparticuz/chromium').default;

const W = Number(process.argv[2] || 1920);
const H = Number(process.argv[3] || 1080);
const COUNT = Number(process.argv[4] || 24);
const FRAMES = 900;
const WARM_FRAMES = 225;

const STROKES = {
	off: () => {
		canvasDrawOptions.predictedPosition = false;
		canvasDrawOptions.trajectoryLines = false;
	},
	legs: () => {},
	// the obvious way to draw the same line: one path through every point, dashed by the canvas
	polyline: () => {
		window.canvasStrokeForecast = (ctx, path, css) => {
			ctx.strokeStyle = css;
			ctx.lineDashOffset = FORECAST_DASH_SPAN - (path.dist + FORECAST_DASH[1]) % FORECAST_DASH_SPAN;
			ctx.beginPath();
			ctx.moveTo(path.x[0], path.y[0]);
			for (let k = 1; k < path.n; k++) ctx.lineTo(path.x[k], path.y[k]);
			ctx.stroke();
		};
	}
};

function pageSetup() {
	let seed = 7;
	Math.random = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 4294967296;
	};
	// frames are stepped by hand, so every stroke draws the same field at the same instants
	window.requestAnimationFrame = () => 0;
	// a canvas that is read back gets moved off the GPU unless it is told not to; the GPU path is the one measured
	const getContext = HTMLCanvasElement.prototype.getContext;
	HTMLCanvasElement.prototype.getContext = function (kind) {
		return getContext.call(this, kind, { willReadFrequently: false });
	};
}

// a one-pixel readback after each frame makes the canvas raster it now, so the time is that frame's own cost
function pageMeasure([frames, warm]) {
	const ctx = document.getElementById('canv').getContext('2d');
	const cost = [];
	for (let k = 0; k < frames; k++) {
		const t0 = performance.now();
		mainFrame(1000 + k * 1000 / 60);
		ctx.getImageData(0, 0, 1, 1);
		if (k >= warm) cost.push(performance.now() - t0);
	}
	cost.sort((a, b) => a - b);
	const gl = document.createElement('canvas').getContext('webgl');
	const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
	return {
		mean: cost.reduce((sum, v) => sum + v, 0) / cost.length,
		p95: cost[Math.floor(cost.length * 0.95)],
		balls: simBalls.count,
		gl: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'none'
	};
}

async function run() {
	const browser = await chromium.launch({ executablePath: await binary.executablePath(), args: binary.args.filter(arg => arg !== '--single-process') });
	const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href + '?balls=' + COUNT;
	try {
		for (const stroke of Object.keys(STROKES)) {
			const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
			await page.addInitScript(pageSetup);
			await page.goto(url);
			await page.evaluate(STROKES[stroke]);
			const res = await page.evaluate(pageMeasure, [FRAMES, WARM_FRAMES]);
			console.log('forecast_raster field=' + W + 'x' + H + ' balls=' + res.balls + ' stroke=' + stroke
				+ ' frames=' + (FRAMES - WARM_FRAMES) + ' frame_mean_ms=' + res.mean.toFixed(2) + ' frame_p95_ms=' + res.p95.toFixed(2)
				+ ' gl=' + res.gl.replace(/[^A-Za-z0-9.]+/g, '_').replace(/_$/, ''));
			await page.context().close();
		}
	} finally {
		await browser.close();
	}
}

run().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
