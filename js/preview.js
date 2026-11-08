// owns: quest target appearance modes and hold panel
// edit for: appearance modes, shapes
var PREVIEW_MODES = ['mean', 'range', 'smooth'];
var PREVIEW_MODE_NAME = ['a ball of the average color', 'a few balls across the range', 'a smooth palette rectangle'];
var PREVIEW_RANGE_STEPS = 5;
var preview = { mode: 'smooth', modeIndex: 2, open: false, id: -1, samples: [], hues: [0, 120, 240] };

function previewHue(v) {
	if (v == null) return 0;
	if (typeof v === 'number') return v;
	if (v.length) return v[0] || 0;
	return 0;
}

function previewHueAt(hues, count, t) {
	if (!count) return 0;
	if (count === 1) return hues[0] || 0;
	const idx = t * (count - 1);
	const i = Math.floor(idx);
	const f = idx - i;
	const a = hues[Math.min(i, count - 1)] || 0;
	const b = hues[Math.min(i + 1, count - 1)] || a;
	return Math.round(a + (b - a) * f);
}

function previewMean(hues, count) {
	if (!count) return 0;
	const arr = [];
	for (let i = 0; i < count; i++) arr.push(hues[i] || 0);
	arr.sort((a, b) => a - b);
	if (arr[arr.length - 1] - arr[0] > 180) {
		for (let i = 0; i < arr.length; i++) if (arr[i] < 180) arr[i] += 360;
		arr.sort((a, b) => a - b);
	}
	let sum = 0;
	for (let i = 0; i < arr.length; i++) sum += arr[i];
	return ((sum / arr.length) % 360 + 360) % 360;
}

function previewRangeColor(hues, count, i) {
	const base = previewHue(hues);
	const hue = (base + i * Math.round(360 / PREVIEW_RANGE_STEPS)) % 360;
	return 'hsl(' + hue + ', 75%, 60%)';
}

function previewFill(el, base, hue, count, mode) {
	if (!el) return;
	el.textContent = '';
	if (!count) {
		el.className = base + ' target-empty';
		return;
	}
	el.className = base + ' target target-' + mode;
	const hues = (hue && hue.length) ? hue : [previewHue(hue)];
	if (mode === 'mean') {
		const m = previewMean(hues, hues.length);
		const i = document.createElement('i');
		i.style.background = 'hsl(' + m + ', 75%, 62%)';
		el.append(i);
		return;
	}
	if (mode === 'range') {
		for (let i = 0; i < PREVIEW_RANGE_STEPS; i++) {
			const b = document.createElement('i');
			b.style.background = previewRangeColor(hues, hues.length, i);
			el.append(b);
		}
		return;
	}
	const lo = previewHueAt(hues, hues.length, 0);
	const hi = previewHueAt(hues, hues.length, 1);
	const b = document.createElement('i');
	b.style.background = 'linear-gradient(90deg, hsl(' + lo + ', 75%, 60%), hsl(' + hi + ', 75%, 60%))';
	el.append(b);
}

function previewOpen(id) { preview.open = true; preview.id = id; }
function previewClose() { preview.open = false; preview.id = -1; }
function previewSetMode(name) {
	const idx = PREVIEW_MODES.indexOf(name);
	if (idx < 0) return;
	preview.mode = name;
	preview.modeIndex = idx;
}
function previewInit() {
	const field = document.getElementById('preview-mode');
	if (field) {
		const radios = field.querySelectorAll('input');
		preview.samples = new Array(radios.length);
		radios.forEach((r, i) => {
			r.checked = r.value === preview.mode;
			r.addEventListener('change', function () { if (r.checked) previewSetMode(r.value); });
			let sample = r.parentNode.querySelector('.preview-sample');
			if (!sample) {
				sample = document.createElement('span');
				sample.className = 'preview-sample';
				r.parentNode.append(sample);
			}
			preview.samples[i] = sample;
			previewFill(sample, 'preview-sample', preview.hues, 1, r.value);
		});
	}
}
if (typeof module !== 'undefined' && module.exports) module.exports = { preview, previewInit, previewSetMode, previewOpen, previewClose, previewFill, previewHueAt, previewMean, previewRangeColor, PREVIEW_MODES, PREVIEW_MODE_NAME, PREVIEW_RANGE_STEPS };
