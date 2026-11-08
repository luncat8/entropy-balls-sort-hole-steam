// owns: task rules, generation, per-participant lifecycle, task strip
// edit for: predicates, candidates, hold duration, strip copy

const TASK_SLOTS = 2;
const TASK_HOLD_SEC = 2;
const TASK_THRESH = [30, 40, 50, 60, 70];
const TASK_SIDE_NAME = ['left', 'right'];
const TASK_CMP_NAME = ['>', '<'];
const TASK_MODE_NAME = ['immediate', 'hold'];
const TASK_ORDER_CAP = 512;

const tasksOn = new Uint8Array(TASK_SLOTS);
const tasksWait = new Uint8Array(TASK_SLOTS);
const tasksSide = new Uint8Array(TASK_SLOTS);
const tasksCat = new Uint8Array(TASK_SLOTS);
const tasksCmp = new Uint8Array(TASK_SLOTS);
const tasksThresh = new Uint8Array(TASK_SLOTS);
const tasksMode = new Uint8Array(TASK_SLOTS);
const tasksHold = new Float32Array(TASK_SLOTS);
const tasksHoldSteps = new Uint16Array(TASK_SLOTS);
const tasksWaitRev = new Uint32Array(TASK_SLOTS);
const tasksOrder = new Uint16Array(TASK_ORDER_CAP);
const tasksDecoded = { side: 0, cat: 0, cmp: 0, thresh: 0, mode: 0 };
const tasksView = [
	{ id: 0, waiting: true, side: 'left', category: 'hot', cmp: '>', threshold: 50, mode: 'immediate', match: 0, sideTotal: 0, holdSec: 0, holdNeed: TASK_HOLD_SEC, satisfied: false },
	{ id: 1, waiting: true, side: 'left', category: 'hot', cmp: '>', threshold: 50, mode: 'immediate', match: 0, sideTotal: 0, holdSec: 0, holdNeed: TASK_HOLD_SEC, satisfied: false }
];

let tasksCandN = 0;
let tasksRand = Math.random;
let tasksGenCalls = 0;
let taskStripEl = null;
let paintSig = NaN;

function tasksSetRand(fn) {
	tasksRand = fn;
}

function tasksCatFromName(name) {
	if (name === 'hot') return 0;
	if (name === 'cold') return 1;
	for (let i = 0; i < PALETTE.length; i++) {
		if (PALETTE[i][0] === name) return i + 2;
	}
	return 0;
}

function tasksCatName(cat) {
	if (cat === 0) return 'hot';
	if (cat === 1) return 'cold';
	return PALETTE[cat - 2][0];
}

function tasksCatTotal(cat) {
	if (cat === 0) return simDist.hot;
	if (cat === 1) return simDist.cold;
	return simDist.palette[cat - 2];
}

function tasksCatSide(cat, isLeft) {
	if (cat === 0) return isLeft ? simDist.leftHot : simDist.rightHot;
	if (cat === 1) return isLeft ? simDist.leftCold : simDist.rightCold;
	const pal = isLeft ? simDist.leftPalette : simDist.rightPalette;
	return pal[cat - 2];
}

function tasksMeets(match, total, cmp, thresh) {
	if (total === 0) return false;
	const left = match * 100;
	const right = thresh * total;
	if (cmp === 0) return left > right;
	return left < right;
}

function tasksFeasible(cat, cmp, thresh) {
	const nAll = simDist.total;
	if (nAll === 0) return false;
	const n = tasksCatTotal(cat);
	for (let s = 1; s <= nAll; s++) {
		const mMin = n - (nAll - s) > 0 ? n - (nAll - s) : 0;
		const mMax = n < s ? n : s;
		for (let m = mMin; m <= mMax; m++) {
			if (tasksMeets(m, s, cmp, thresh)) return true;
		}
	}
	return false;
}

function tasksShuffle() {
	for (let i = tasksCandN - 1; i > 0; i--) {
		const j = (tasksRand() * (i + 1)) | 0;
		const t = tasksOrder[i];
		tasksOrder[i] = tasksOrder[j];
		tasksOrder[j] = t;
	}
}

function tasksDecode(idx, out) {
	const nCat = 2 + PALETTE.length;
	const nThresh = TASK_THRESH.length;
	let v = idx;
	out.mode = v % 2;
	v = (v / 2) | 0;
	out.thresh = TASK_THRESH[v % nThresh];
	v = (v / nThresh) | 0;
	out.cmp = v % 2;
	v = (v / 2) | 0;
	out.cat = v % nCat;
	v = (v / nCat) | 0;
	out.side = v % 2;
}

function tasksFillView(id) {
	const v = tasksView[id];
	const isLeft = tasksSide[id] === 0;
	v.waiting = tasksWait[id] === 1;
	v.side = TASK_SIDE_NAME[tasksSide[id]];
	v.category = tasksCatName(tasksCat[id]);
	v.cmp = TASK_CMP_NAME[tasksCmp[id]];
	v.threshold = tasksThresh[id];
	v.mode = TASK_MODE_NAME[tasksMode[id]];
	v.match = tasksCatSide(tasksCat[id], isLeft);
	v.sideTotal = isLeft ? simDist.left : simDist.right;
	v.holdSec = tasksHold[id];
	v.holdNeed = TASK_HOLD_SEC;
	v.satisfied = tasksMeets(v.match, v.sideTotal, tasksCmp[id], v.threshold);
}

function tasksGenerate(id) {
	tasksGenCalls++;
	tasksShuffle();
	for (let i = 0; i < tasksCandN; i++) {
		tasksDecode(tasksOrder[i], tasksDecoded);
		const d = tasksDecoded;
		if (!tasksFeasible(d.cat, d.cmp, d.thresh)) continue;
		const isLeft = d.side === 0;
		const total = isLeft ? simDist.left : simDist.right;
		const match = tasksCatSide(d.cat, isLeft);
		if (tasksMeets(match, total, d.cmp, d.thresh)) continue;
		tasksWait[id] = 0;
		tasksHold[id] = 0;
		tasksHoldSteps[id] = 0;
		tasksSide[id] = d.side;
		tasksCat[id] = d.cat;
		tasksCmp[id] = d.cmp;
		tasksThresh[id] = d.thresh;
		tasksMode[id] = d.mode;
		tasksFillView(id);
		return true;
	}
	tasksWait[id] = 1;
	tasksWaitRev[id] = simDist.rev;
	tasksHold[id] = 0;
	tasksHoldSteps[id] = 0;
	tasksFillView(id);
	return false;
}

function tasksInit() {
	const nCat = 2 + PALETTE.length;
	tasksCandN = 2 * nCat * 2 * TASK_THRESH.length * 2;
	for (let i = 0; i < tasksCandN; i++) tasksOrder[i] = i;
	for (let id = 0; id < TASK_SLOTS; id++) {
		tasksOn[id] = 0;
		tasksWait[id] = 0;
		tasksHold[id] = 0;
		tasksHoldSteps[id] = 0;
	}
	tasksGenCalls = 0;
	paintSig = NaN;
}

function tasksAttach(id) {
	if (id < 0 || id >= TASK_SLOTS) return;
	tasksOn[id] = 1;
	tasksGenerate(id);
}

function tasksAssign(id, sideName, catName, cmpStr, threshold, modeName) {
	tasksOn[id] = 1;
	tasksWait[id] = 0;
	tasksHold[id] = 0;
	tasksHoldSteps[id] = 0;
	tasksSide[id] = sideName === 'right' ? 1 : 0;
	tasksCat[id] = tasksCatFromName(catName);
	tasksCmp[id] = cmpStr === '<' ? 1 : 0;
	tasksThresh[id] = threshold;
	tasksMode[id] = modeName === 'hold' ? 1 : 0;
	tasksFillView(id);
}

function tasksGenCount() {
	return tasksGenCalls;
}

function tasksStep(dt) {
	for (let id = 0; id < TASK_SLOTS; id++) {
		if (tasksOn[id]) tasksStepOne(id, dt);
	}
}

function tasksStepOne(id, dt) {
	if (tasksWait[id]) {
		if (simDist.rev === tasksWaitRev[id]) return;
		tasksGenerate(id);
		return;
	}
	const isLeft = tasksSide[id] === 0;
	const total = isLeft ? simDist.left : simDist.right;
	const match = tasksCatSide(tasksCat[id], isLeft);
	const sat = tasksMeets(match, total, tasksCmp[id], tasksThresh[id]);
	if (!sat) {
		tasksHold[id] = 0;
		tasksHoldSteps[id] = 0;
		tasksFillView(id);
		return;
	}
	if (tasksMode[id]) {
		// count * dt, not summed dt: 240 * (1/120) === 2, while adding 1/120 240 times undershoots
		tasksHoldSteps[id]++;
		tasksHold[id] = tasksHoldSteps[id] * dt;
		if (tasksHold[id] < TASK_HOLD_SEC) {
			tasksFillView(id);
			return;
		}
	}
	tasksGenerate(id);
}

function tasksPaint() {
	if (!taskStripEl) taskStripEl = $('task-strip');
	if (!taskStripEl) return;
	if (!tasksOn[0]) return;
	const v = tasksView[0];
	const sig = tasksWait[0]
		+ tasksSide[0] * 2
		+ tasksCat[0] * 8
		+ tasksCmp[0] * 64
		+ tasksThresh[0] * 128
		+ tasksMode[0] * 8192
		+ v.match * 16384
		+ v.sideTotal * 524288
		+ ((v.holdSec * 10) | 0) * 16777216;
	if (sig === paintSig) return;
	paintSig = sig;
	if (v.waiting) {
		taskStripEl.textContent = 'waiting for a feasible task';
		return;
	}
	let text = v.side + ' ' + v.mode + ' ' + v.cmp + v.threshold + '% ' + v.category + ' ';
	text += v.sideTotal === 0 ? 'empty' : (v.match + '/' + v.sideTotal);
	if (v.mode === 'hold') text += ' ' + ((v.holdSec * 10) | 0) / 10 + '/' + TASK_HOLD_SEC + 's';
	taskStripEl.textContent = text;
}

if (typeof module !== 'undefined') module.exports = {
	tasksInit,
	tasksAttach,
	tasksAssign,
	tasksStep,
	tasksPaint,
	tasksSetRand,
	tasksMeets,
	tasksFeasible,
	tasksCatFromName,
	tasksCatTotal,
	tasksCatSide,
	tasksView,
	tasksOn,
	tasksWait,
	tasksHold,
	tasksGenCount,
	TASK_HOLD_SEC,
	TASK_THRESH,
	TASK_SLOTS
};
