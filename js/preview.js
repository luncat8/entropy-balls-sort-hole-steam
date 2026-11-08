// owns: quest target appearance modes and hold panel
// edit for: appearance modes, shapes
var PREVIEW_MODES = ['mean', 'range', 'smooth'];
var PREVIEW_MODE_NAME = ['a ball of the average color', 'a few balls across the range', 'a smooth palette rectangle'];
var PREVIEW_RANGE_STEPS = 5;
var preview = { mode: 'smooth', modeIndex: 2, open: false, id: -1, samples: [] };

function previewFill(el, base, hue, count, mode) {
	if (!el) return;
	el.className = base + ' target' + (count ? ' target-' + mode : ' target-empty');
	el.textContent = '';
	if (!count) return;
	if (mode === 'mean') {
		const i = document.createElement('i');
		i.style.background = (typeof hue === 'number') ? '' : '';
		el.append(i);
		return;
	}
	if (mode === 'range') {
		for (let i = 0; i < PREVIEW_RANGE_STEPS; i++) {
			const b = document.createElement('i');
			el.append(b);
		}
		return;
	}
	const b = document.createElement('i');
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
		});
	}
}
if (typeof module !== 'undefined' && module.exports) module.exports = { preview, previewInit, previewSetMode, previewOpen, previewClose, previewFill, PREVIEW_MODES, PREVIEW_MODE_NAME, PREVIEW_RANGE_STEPS };
