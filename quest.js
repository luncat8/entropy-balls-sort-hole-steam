// owns: task cards, their swatches, press gestures and repaint scheduling
// edit for: card layout, card copy, press gestures

const QUEST_IDLE = -1;
const QUEST_BAR_RATE = 0.2;

const quest = {
	home: null,
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

// a card outside its player's column covers the field on top of an unrelated control, so it is
// collected back into the list the page provides; the force column calls the other hook
function questHome() {
	if (!quest.home) quest.home = $('task-list');
	return quest.home;
}

// the caller owns the card once it is mounted; a rebuild moves it rather than duplicating it
function questMount(parent, id) {
	questBuildItems();
	parent.append(quest.items[id].el);
}

function questPaint() {
	if (!tasksAny()) return;
	tasksRefresh();
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
	let sig = quest.heldId * 31 + players.count;
	for (let id = 0; id < TASK_SLOTS; id++) {
		const v = tasksView[id];
		const h = tasksHueView[id];
		sig = (sig * 31 + tasksCat[id] + tasksSide[id] * 16 + tasksCmp[id] * 32) | 0;
		sig = (sig * 31 + tasksThresh[id] + tasksMode[id] * 128 + h.count * 256) | 0;
		sig = (sig * 31 + (tasksOn[id] ? 1 : 0) + (v.waiting ? 2 : 0) + (v.satisfied ? 4 : 0)) | 0;
		sig = (sig * 31 + v.sideTotal * 2 + v.match * 128 + v.cost * 4096) | 0;
		sig = (sig * 31 + ((v.holdSec * 10) | 0)) | 0;
		sig = (sig * 31 + ((v.progress * 1000) | 0)) | 0;
	}
	return sig;
}

// integer on purpose: a swatch string is only built when a category changes, never per frame
function questSwatchSig() {
	let sig = tasksAny() ? 1 : 0;
	for (let id = 0; id < TASK_SLOTS; id++) sig = sig * 8 + tasksCat[id] + (tasksOn[id] ? 1 : 0);
	return sig;
}

// one card per slot, each a title line, a bar and a meta line; the card lives for the whole round
// because only text, colour and the bar width change
function questBuildItems() {
	if (quest.items.length) return;
	const home = questHome();
	const frag = document.createDocumentFragment();
	for (let id = 0; id < TASK_SLOTS; id++) {
		const item = document.createElement('li');
		item.className = 'quest';
		item.tabIndex = 0;
		const head = document.createElement('span');
		head.className = 'quest-head';
		const swatch = document.createElement('span');
		swatch.className = 'quest-swatch';
		const text = document.createElement('span');
		text.className = 'quest-text';
		head.append(swatch, text);
		const bar = document.createElement('span');
		bar.className = 'quest-bar';
		const fill = document.createElement('i');
		fill.className = 'quest-bar-fill';
		bar.append(fill);
		const meta = document.createElement('span');
		meta.className = 'quest-meta';
		item.append(head, bar, meta);
		item.addEventListener('pointerdown', e => questItemDown(e, id));
		item.addEventListener('pointerup', e => questItemUp(e, id));
		item.addEventListener('pointercancel', e => questItemUp(e, id));
		item.addEventListener('lostpointercapture', e => questItemUp(e, id));
		item.addEventListener('keydown', e => questItemKey(e, id));
		item.addEventListener('keyup', e => questItemKey(e, id));
		item.addEventListener('blur', e => questItemUp(e, id));
		frag.append(item);
		quest.items.push({ id, el: item, swatch, text, bar, fill, meta, held: false, pct: -1 });
	}
	if (home) home.append(frag);
	window.addEventListener('blur', questReleaseAll);
}

function questReleaseAll() {
	for (let id = 0; id < quest.items.length; id++) quest.items[id].held = false;
	questClose();
}

function questPaintItems(swatchChanged) {
	for (let id = 0; id < TASK_SLOTS; id++) {
		const v = tasksView[id];
		const it = quest.items[id];
		it.el.hidden = !tasksOn[id];
		if (!tasksOn[id]) continue;
		it.text.textContent = (players.count > 1 ? 'P' + (id + 1) + ' ' : '') + questObjectiveText(v);
		it.meta.textContent = questMetaText(v);
		questPaintBar(it, v);
		if (!swatchChanged) continue;
		const h = tasksHueView[id];
		quest.swatchFn(it.swatch, h.hue, h.count);
	}
}

// the bar is a width percentage written only when the rounded value changes, and the readout sits
// inside it so the same number is a label and a shape
function questPaintBar(it, v) {
	const pct = v.waiting ? 0 : ((v.progress * 100) | 0);
	if (pct === it.pct) return;
	it.pct = pct;
	it.fill.style.width = pct + '%';
	it.fill.textContent = v.waiting ? '' : pct + '%';
	it.el.setAttribute('data-done', pct >= 100 ? 'true' : 'false');
}

function questMetaText(v) {
	if (v.waiting) return 'waiting for a feasible task';
	let meta = v.difficulty;
	if (v.satisfied) meta += ' · met';
	if (v.mode === 'hold' && v.holdSec > 0) meta += ' · ' + ((v.holdSec * 10) | 0) / 10 + '/' + TASK_HOLD_SEC + 's';
	return meta;
}

// the side is an arrow and the condition a sign, so the line reads at a glance: → >40% red · 1/6
function questObjectiveText(v) {
	if (v.waiting) return 'waiting for a feasible task';
	let text = tasksSideArrow(v.side) + ' ' + v.cmp + v.threshold + '% ' + v.category;
	text += v.sideTotal === 0 ? ' · empty' : ' · ' + v.match + '/' + v.sideTotal;
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
	questMetaText,
	questMount,
	questHome,
	questOpen,
	questClose,
	questReleaseAll,
	QUEST_IDLE
};
