// owns: quest target appearance modes, their shapes and samples, and the hold preview panel
// edit for: appearance modes, shape drawing, panel copy

// one target color has three honest representations, so the shape is part of the mode, not a style that
// every mode shares: a single ball, the few balls the range can produce, and the whole range as a palette
const PREVIEW_MODES = ['mean', 'range', 'smooth'];
const PREVIEW_MODE_NAME = ['a ball of the average color', 'a few balls across the range', 'a smooth palette rectangle'];
const PREVIEW_RANGE_STEPS = 5;
const PREVIEW_SMOOTH_STEPS = 9;
const PREVIEW_MEAN_SAT = 0.75;
const PREVIEW_MEAN_LIGHT = 0.62;
const PREVIEW_DARK_SAT = 0.9;

const preview = { mode: 'smooth', modeIndex: 2, open: false, id: -1, samples: [] };
const previewHue = [0, 0];

let previewRadios = [];
let previewPanelEl = null;
let previewPanelSwatch = null;
let previewPanelTitle = null;
let previewPanelDetail = null;
let previewPanelDots = null;

// every target drawing in the page goes through here, so the list, the samples and the panel cannot
// disagree; the base class stays because it carries the size the surrounding layout wants
function previewFill(el, base, hue, count, mode) {
	el.className = base + ' target' + (count ? ' target-' + mode : ' target-empty');
	el.textContent = '';
	if (!count) return;
	if (mode === 'mean') {
		previewAppend(el, colorCss(previewMeanColor(hue, count)));
		return;
	}
	if (mode === 'range') {
		for (let i = 0; i < PREVIEW_RANGE_STEPS; i++) previewAppend(el, colorCss(previewRangeColor(hue, count, i)));
		return;
	}
	previewAppend(el, previewGradient(hue, count));
}

function previewAppend(el, css) {
	const ball = document.createElement('i');
	ball.style.background = css;
	el.append(ball);
}

function previewMeanColor(hue, count) {
	return colorHslToRgb(previewMean(hue, count), PREVIEW_MEAN_SAT, PREVIEW_MEAN_LIGHT);
}

// the one ramp every shape reads: hue across the target, saturation and lightness across the envelope
// balls are generated in, so a single-hue target spans dark and saturated to pale
function previewRampColor(hue, count, t) {
	const sat = PREVIEW_DARK_SAT + (BALL_SAT_MIN - PREVIEW_DARK_SAT) * t;
	const light = BALL_LIGHT_MIN + (BALL_LIGHT_MAX - BALL_LIGHT_MIN) * t;
	return colorHslToRgb(previewHueAt(hue, count, t), sat, light);
}

function previewRangeColor(hue, count, i) {
	const t = PREVIEW_RANGE_STEPS === 1 ? 0.5 : i / (PREVIEW_RANGE_STEPS - 1);
	return previewRampColor(hue, count, t);
}

function previewGradient(hue, count) {
	const stops = PREVIEW_SMOOTH_STEPS;
	let css = '';
	for (let i = 0; i < stops; i++) {
		css += (i ? ',' : '') + colorCss(previewRampColor(hue, count, i / (stops - 1)));
	}
	return 'linear-gradient(90deg,' + css + ')';
}

function previewMean(hue, count) {
	if (count === 1) return hue[0];
	if (count === 2) return colorMeanHue(hue[0], hue[1]);
	return hue[(count / 2) | 0];
}

function previewHueAt(hue, count, t) {
	if (count === 1) return hue[0];
	if (count === 2) return hue[0] + (hue[1] - hue[0]) * t;
	const i = t * (count - 1);
	const a = i | 0;
	const b = a + 1 < count ? a + 1 : a;
	return hue[a] + (hue[b] - hue[a]) * (i - a);
}

// the sample chips follow the objective being previewed, so an option shows what it would do to it
function previewPaintSamples() {
	const id = preview.open ? preview.id : 0;
	const count = tasksOn[id] && !tasksView[id].waiting
		? tasksCatHues(tasksView[id].category, previewHue)
		: 0;
	for (let i = 0; i < PREVIEW_MODES.length; i++) {
		previewFill(preview.samples[i], 'preview-sample', previewHue, count, PREVIEW_MODES[i]);
	}
}

function previewSetMode(name) {
	const index = PREVIEW_MODES.indexOf(name);
	if (index < 0) return;
	preview.mode = name;
	preview.modeIndex = index;
	previewPaintSamples();
	questRepaint();
}

// the panel states the goal the canvas draws, not a second reading of the same threshold: the cheapest
// split may resize the named chamber, and two different numbers on one screen read as a contradiction
function previewPaint() {
	const v = tasksView[preview.id];
	const count = v.waiting ? 0 : tasksCatHues(v.category, previewHue);
	previewPanelEl.hidden = false;
	previewFill(previewPanelSwatch, 'quest-panel-swatch', previewHue, count, preview.mode);
	previewPanelTitle.textContent = questObjectiveText(v);
	const goal = goalSummary.active;
	const need = goal ? goalSummary.match : tasksNeed(v);
	previewPanelDetail.textContent = v.waiting
		? 'no feasible objective for this distribution yet'
		: v.difficulty + ' · ' + PREVIEW_MODE_NAME[preview.modeIndex]
			+ (goal ? ' · goal ' + goalSummary.match + '/' + goalSummary.side : ' · needs ' + need + ' of ' + v.sideTotal)
			+ ' on the ' + v.side + ', now ' + v.match + (goal ? '/' + v.sideTotal : '');
	previewPaintDots(need, v.match);
}

function previewPaintDots(need, match) {
	const want = need > 0 ? need : 0;
	if (previewPanelDots.childElementCount !== want) {
		previewPanelDots.textContent = '';
		const frag = document.createDocumentFragment();
		for (let i = 0; i < want; i++) frag.append(document.createElement('i'));
		previewPanelDots.append(frag);
	}
	const held = match > want ? want : match;
	for (let i = 0; i < want; i++) previewPanelDots.children[i].className = i < held ? 'on' : '';
}

function previewOpen(id) {
	preview.open = true;
	preview.id = id;
	previewPaintSamples();
	previewPaint();
}

function previewClose() {
	if (!preview.open) return;
	preview.open = false;
	preview.id = -1;
	previewPanelEl.hidden = true;
	previewPaintSamples();
}

// the hook fires every frame while a quest is held, so opening is idempotent and the goal layer only
// rebuilds when the held objective actually changes
function previewHook(open, id) {
	if (!open) {
		previewClose();
		goalClose();
		return;
	}
	if (!preview.open || preview.id !== id) previewOpen(id);
	else previewPaint();
	goalShow(id);
}

function previewModeChanged(e) {
	if (e.target.checked) previewSetMode(e.target.value);
}

function previewInit() {
	const field = $('preview-mode');
	previewRadios = [...field.querySelectorAll('input')];
	preview.samples = new Array(PREVIEW_MODES.length);
	for (let i = 0; i < previewRadios.length; i++) {
		const radio = previewRadios[i];
		radio.checked = radio.value === preview.mode;
		radio.addEventListener('change', previewModeChanged);
		// boot may run twice in a test harness; reuse the chip instead of stacking a second one
		let sample = radio.parentNode.querySelector('.preview-sample');
		if (!sample) {
			sample = document.createElement('span');
			sample.className = 'preview-sample';
			radio.parentNode.append(sample);
		}
		preview.samples[i] = sample;
	}
	previewPanelEl = $('quest-panel');
	previewPanelSwatch = previewPanelEl.firstElementChild;
	previewPanelTitle = previewPanelEl.querySelector('[data-field="title"]');
	previewPanelDetail = previewPanelEl.querySelector('[data-field="detail"]');
	previewPanelDots = previewPanelEl.querySelector('[data-field="dots"]');
	previewPaintSamples();
	questSetSwatches(previewListSwatch);
	questSetPaintHook(previewHook);
	questRepaint();
}

function previewListSwatch(el, hue, count) {
	previewFill(el, 'quest-swatch', hue, count, preview.mode);
}

if (typeof module !== 'undefined') module.exports = {
	preview,
	previewInit,
	previewSetMode,
	previewOpen,
	previewClose,
	previewFill,
	previewGradient,
	previewMeanColor,
	previewRangeColor,
	previewRampColor,
	previewHueAt,
	previewMean,
	PREVIEW_MODES,
	PREVIEW_MODE_NAME,
	PREVIEW_RANGE_STEPS
};
