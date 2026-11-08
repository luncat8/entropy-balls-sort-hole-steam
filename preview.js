// owns: quest target appearance modes, their samples and the hold preview panel
// edit for: appearance modes, swatch sampling, panel copy

const PREVIEW_MODES = ['mean', 'range', 'smooth'];
const PREVIEW_MODE_NAME = ['average color', 'color range', 'smooth palette'];
const PREVIEW_RANGE_STEPS = 5;
const PREVIEW_SMOOTH_STEPS = 8;
const PREVIEW_MEAN_SAT = 0.75;
const PREVIEW_MEAN_LIGHT = 0.62;
const PREVIEW_DARK_SAT = 0.9;
const PREVIEW_DARK_LIGHT = 0.5;
const PREVIEW_PALE_SAT = 0.6;
const PREVIEW_PALE_LIGHT = 0.75;
const PREVIEW_RANGE_SAT = 0.75;

const preview = { mode: 'smooth', modeIndex: 2, open: false, id: -1 };
const previewCss = ['', '', ''];
const previewHue = [0, 0];

let previewRadios = [];
let previewPanelEl = null;
let previewPanelSwatch = null;
let previewPanelTitle = null;
let previewPanelDetail = null;
let previewPanelDots = null;

// one function for every swatch in the ui, so the list, the samples and the panel cannot disagree
function previewSwatchFor(name, hue, count) {
	return previewRange(hue, count, preview.mode);
}

function previewRange(hue, count, mode) {
	if (mode === 'mean') return colorCss(colorHslToRgb(previewMean(hue, count), PREVIEW_MEAN_SAT, PREVIEW_MEAN_LIGHT));
	let css = '';
	const steps = mode === 'smooth' ? PREVIEW_SMOOTH_STEPS : PREVIEW_RANGE_STEPS;
	const satFrom = mode === 'smooth' ? PREVIEW_DARK_SAT : PREVIEW_RANGE_SAT;
	const satTo = mode === 'smooth' ? PREVIEW_PALE_SAT : PREVIEW_RANGE_SAT;
	for (let i = 0; i < steps; i++) {
		const t = steps === 1 ? 0.5 : i / (steps - 1);
		const sat = satFrom + (satTo - satFrom) * t;
		const light = mode === 'smooth'
			? PREVIEW_DARK_LIGHT + (PREVIEW_PALE_LIGHT - PREVIEW_DARK_LIGHT) * t
			: previewRangeLight(t);
		css += (i ? ',' : '') + colorCss(colorHslToRgb(previewHueAt(hue, count, t), sat, light));
	}
	return 'linear-gradient(90deg,' + css + ')';
}

// the few-ball representation alternates across the envelope so every ball reads as a sample
function previewRangeLight(t) {
	const slot = (t * (PREVIEW_RANGE_STEPS - 1) + 0.5) | 0;
	return slot % 2 === 0 ? BALL_LIGHT_MIN : BALL_LIGHT_MAX;
}

function previewMean(hue, count) {
	if (count === 1) return hue[0];
	if (count === 2) return colorMeanHue(hue[0], hue[1]);
	return hue[(count / 2) | 0];
}

// a multi-hue target spans its hues; a single-hue target has no hue span left, so its range runs
// through the saturation/lightness envelope instead of collapsing to one color
function previewHueAt(hue, count, t) {
	if (count === 1) return hue[0];
	if (count === 2) return hue[0] + (hue[1] - hue[0]) * t;
	const i = t * (count - 1);
	const a = i | 0;
	const b = a + 1 < count ? a + 1 : a;
	return hue[a] + (hue[b] - hue[a]) * (i - a);
}

function previewSamples() {
	for (let i = 0; i < PREVIEW_MODES.length; i++) {
		previewCss[i] = previewSample(PREVIEW_MODES[i]);
		previewRadios[i].parentNode.style.setProperty('--sample', previewCss[i]);
	}
}

// the sample follows the objective being previewed, so an option shows what it would do to it
function previewSample(mode) {
	const id = preview.open ? preview.id : 0;
	if (!tasksOn[id]) return 'transparent';
	const v = tasksView[id];
	const count = v.waiting ? 0 : tasksCatHues(v.category, previewHue);
	return count ? previewRange(previewHue, count, mode) : 'transparent';
}

function previewSetMode(name) {
	const index = PREVIEW_MODES.indexOf(name);
	if (index < 0) return;
	preview.mode = name;
	preview.modeIndex = index;
	previewSamples();
	questRepaint();
}

function previewPaint() {
	const v = tasksView[preview.id];
	const count = v.waiting ? 0 : tasksCatHues(v.category, previewHue);
	previewPanelEl.hidden = false;
	previewPanelSwatch.style.background = count ? previewSwatchFor(null, previewHue, count) : 'transparent';
	previewPanelTitle.textContent = questObjectiveText(v);
	const need = tasksNeed(v);
	previewPanelDetail.textContent = v.waiting
		? 'no feasible objective for this distribution yet'
		: v.difficulty + ' · ' + PREVIEW_MODE_NAME[preview.modeIndex] + ' · needs ' + need + ' of ' + v.sideTotal + ' on the ' + v.side + ', now ' + v.match;
	const want = need > 0 ? need : 0;
	if (previewPanelDots.childElementCount !== want) {
		previewPanelDots.textContent = '';
		const frag = document.createDocumentFragment();
		for (let i = 0; i < want; i++) frag.append(document.createElement('i'));
		previewPanelDots.append(frag);
	}
	const held = v.match > want ? want : v.match;
	for (let i = 0; i < want; i++) previewPanelDots.children[i].className = i < held ? 'on' : '';
}

function previewOpen(id) {
	preview.open = true;
	preview.id = id;
	previewSamples();
	previewPaint();
}

function previewClose() {
	if (!preview.open) return;
	preview.open = false;
	preview.id = -1;
	previewPanelEl.hidden = true;
	previewSamples();
}

function previewHook(open, id) {
	if (!open) {
		previewClose();
		return;
	}
	if (preview.open && preview.id === id) previewPaint();
	else previewOpen(id);
}

function previewModeChanged(e) {
	if (e.target.checked) previewSetMode(e.target.value);
}

function previewInit() {
	const field = $('preview-mode');
	previewRadios = [...field.querySelectorAll('input')];
	for (const radio of previewRadios) {
		radio.checked = radio.value === preview.mode;
		radio.addEventListener('change', previewModeChanged);
	}
	previewPanelEl = $('quest-panel');
	previewPanelSwatch = previewPanelEl.firstElementChild;
	previewPanelTitle = previewPanelEl.querySelector('[data-field="title"]');
	previewPanelDetail = previewPanelEl.querySelector('[data-field="detail"]');
	previewPanelDots = previewPanelEl.querySelector('[data-field="dots"]');
	previewSamples();
	questSetSwatches(previewSwatchFor);
	questSetPaintHook(previewHook);
	questRepaint();
}

if (typeof module !== 'undefined') module.exports = {
	preview,
	previewCss,
	previewInit,
	previewSetMode,
	previewOpen,
	previewClose,
	previewRange,
	previewHueAt,
	previewMean,
	PREVIEW_MODES,
	PREVIEW_MODE_NAME
};
