// owns: quest list items, their swatches, press gestures and repaint scheduling
// edit for: item layout, list copy, press gestures

const QUEST_IDLE = -1;

const quest = {
	listEl: null,
	items: [],
	paintSig: NaN,
	swatchSig: -1,
	swatchFn: null,
	paintHook: null,
	heldId: QUEST_IDLE
};

function questOpen(id) {
	if (!tasksOn[id]) return;
	quest.heldId = id;
	if (quest.paintHook) quest.paintHook(true, id);
}

function questClose() {
	if (quest.heldId === QUEST_IDLE) return;
	quest.heldId = QUEST_IDLE;
	if (quest.paintHook) quest.paintHook(false, QUEST_IDLE);
}

function questPaint() {
	if (!quest.listEl) quest.listEl = $('task-list');
	if (!quest.listEl) return;
	if (!tasksOn[0]) return;
	questBuildItems();
	const swatchSig = questSwatchSig();
	const sig = questStateSig();
	if (sig === quest.paintSig && swatchSig === quest.swatchSig) return;
	const swatchChanged = swatchSig !== quest.swatchSig;
	quest.paintSig = sig;
	quest.swatchSig = swatchSig;
	questPaintItems(swatchChanged);
	if (quest.paintHook) quest.paintHook(quest.heldId !== QUEST_IDLE, quest.heldId);
}

function questRepaint() {
	quest.paintSig = NaN;
	quest.swatchSig = -1;
	questPaint();
}

function questSetSwatches(fn) {
	quest.swatchFn = fn;
}

function questSetPaintHook(hook) {
	quest.paintHook = hook;
}

// cheap integer digest: the list must repaint on progress, not on every frame
function questStateSig() {
	let sig = quest.heldId;
	for (let id = 0; id < TASK_SLOTS; id++) {
		const v = tasksView[id];
		const h = tasksHueView[id];
		sig = (sig * 31 + tasksCat[id] + tasksSide[id] * 16 + tasksCmp[id] * 32) | 0;
		sig = (sig * 31 + tasksThresh[id] + tasksMode[id] * 128 + h.count * 256) | 0;
		sig = (sig * 31 + (tasksOn[id] ? 1 : 0) + (v.waiting ? 2 : 0) + (v.satisfied ? 4 : 0)) | 0;
		sig = (sig * 31 + v.sideTotal * 2 + v.match * 128 + v.cost * 4096) | 0;
		sig = (sig * 31 + ((v.holdSec * 10) | 0)) | 0;
	}
	return sig;
}

// integer on purpose: a swatch string is only built when a category changes, never per frame
function questSwatchSig() {
	let sig = tasksOn[0] ? 1 : 0;
	for (let id = 0; id < TASK_SLOTS; id++) sig = sig * 8 + tasksCat[id] + (tasksOn[id] ? 1 : 0);
	return sig;
}

// items are built once; a held item survives list repaints because only text and marks change
function questBuildItems() {
	if (quest.items.length) return;
	const frag = document.createDocumentFragment();
	for (let id = 0; id < TASK_SLOTS; id++) {
		const item = document.createElement('li');
		item.className = 'quest';
		item.tabIndex = 0;
		const swatch = document.createElement('span');
		swatch.className = 'quest-swatch';
		const body = document.createElement('span');
		body.className = 'quest-body';
		const text = document.createElement('span');
		text.className = 'quest-text';
		const meta = document.createElement('span');
		meta.className = 'quest-meta';
		body.append(text, meta);
		item.append(swatch, body);
		item.addEventListener('pointerdown', e => questItemDown(e, id));
		item.addEventListener('pointerup', e => questItemUp(e, id));
		item.addEventListener('pointercancel', e => questItemUp(e, id));
		item.addEventListener('keydown', e => questItemKey(e, id));
		item.addEventListener('keyup', e => questItemKey(e, id));
		item.addEventListener('blur', e => questItemUp(e, id));
		frag.append(item);
		quest.items.push({ id, el: item, swatch, text, meta, held: false });
	}
	quest.listEl.append(frag);
}

function questPaintItems(swatchChanged) {
	for (let id = 0; id < TASK_SLOTS; id++) {
		const v = tasksView[id];
		const it = quest.items[id];
		it.el.hidden = !tasksOn[id];
		if (!tasksOn[id]) continue;
		if (!swatchChanged) {
			it.text.textContent = questObjectiveText(v);
			it.meta.textContent = questMetaText(v);
			continue;
		}
		it.text.textContent = questObjectiveText(v);
		it.meta.textContent = questMetaText(v);
		const h = tasksHueView[id];
		it.swatch.style.background = h.count ? quest.swatchFn(tasksCatName(tasksCat[id]), h.hue, h.count) : 'transparent';
	}
}

function questMetaText(v) {
	let meta = v.difficulty;
	if (v.satisfied) meta += ' · met';
	if (v.mode === 'hold' && v.holdSec > 0) meta += ' · ' + ((v.holdSec * 10) | 0) / 10 + '/' + TASK_HOLD_SEC + 's';
	return meta;
}

function questObjectiveText(v) {
	if (v.waiting) return 'waiting for a feasible task';
	let text = v.side + ' ' + v.cmp + v.threshold + '% ' + v.category;
	text += v.sideTotal === 0 ? ' · empty' : ' · ' + v.match + '/' + v.sideTotal;
	if (v.mode === 'hold') text += ' · hold ' + TASK_HOLD_SEC + 's';
	return text;
}

function questItemDown(e, id) {
	const it = quest.items[id];
	if (!it) return;
	e.preventDefault();
	it.held = true;
	if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
	questOpen(id);
}

function questItemUp(e, id) {
	const it = quest.items[id];
	if (!it || !it.held) return;
	it.held = false;
	questClose();
}

function questItemKey(e, id) {
	if (e.code !== 'Space' && e.code !== 'Enter') return;
	e.preventDefault();
	const it = quest.items[id];
	if (!it) return;
	if (e.type === 'keydown' && !it.held) {
		it.held = true;
		questOpen(id);
	} else if (e.type === 'keyup' && it.held) {
		it.held = false;
		questClose();
	}
}

if (typeof module !== 'undefined') module.exports = {
	quest,
	questPaint,
	questRepaint,
	questSetSwatches,
	questSetPaintHook,
	questObjectiveText,
	questOpen,
	questClose,
	QUEST_IDLE
};
