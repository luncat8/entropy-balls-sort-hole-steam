// owns: task rules, generation, difficulty, per-participant lifecycle, view model
// edit for: predicates, candidates, difficulty bands, hold duration, view fields

const TASK_SLOTS = 2;
const TASK_HOLD_SEC = 2;
// A "less than" objective at 40-70% is almost always already met on a random field, so the playable
// pool only exists at the low end: the table spans both ends or the list is nearly all "greater than"
const TASK_THRESH = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const TASK_SIDE_NAME = ['left', 'right'];
// the list shows the side as an arrow, and the arrow carries the meaning better than the word
const TASK_SIDE_ARROW = ['←', '→'];
const TASK_CMP_NAME = ['>', '<'];
const TASK_MODE_NAME = ['immediate', 'hold'];
const TASK_LABEL_NAME = ['easy', 'normal', 'hard', 'expert'];
// The percentage can be read against two denominators, and the draft asks for both: the share of the
// named chamber that is the category ("40% of left is hot"), and the share of the whole category that
// sits in the named chamber ("90% of red is on the left"). Same predicate, different total.
const TASK_MEASURE_NAME = ['side', 'total'];
const TASK_MEASURE_PREFIX = ['', ' of'];
const TASK_ORDER_CAP = 4096;
const TASK_HUE_CAP = 6;

const tasksOn = new Uint8Array(TASK_SLOTS);
const tasksScore = new Uint32Array(TASK_SLOTS);
const tasksWait = new Uint8Array(TASK_SLOTS);
const tasksSide = new Uint8Array(TASK_SLOTS);
const tasksCat = new Uint8Array(TASK_SLOTS);
const tasksCmp = new Uint8Array(TASK_SLOTS);
const tasksMeasure = new Uint8Array(TASK_SLOTS);
const tasksThresh = new Uint8Array(TASK_SLOTS);
const tasksMode = new Uint8Array(TASK_SLOTS);
const tasksHold = new Float32Array(TASK_SLOTS);
const tasksHoldSteps = new Uint16Array(TASK_SLOTS);
const tasksWaitRev = new Uint32Array(TASK_SLOTS);
const tasksCostAssigned = new Uint16Array(TASK_SLOTS);
const tasksDemandAssigned = new Uint16Array(TASK_SLOTS);
// the crossings still needed, recomputed only when the distribution changes: the same walk the
// difficulty priced, so the bar measures progress in the unit the objective is scored in
const tasksRemaining = new Uint16Array(TASK_SLOTS);
const tasksOrder = new Uint16Array(TASK_ORDER_CAP);
const tasksCostScratch = new Int16Array(TASK_ORDER_CAP);
const tasksDemandScratch = new Int16Array(TASK_ORDER_CAP);
const tasksBandScratch = new Int8Array(TASK_ORDER_CAP);
const tasksCmpScratch = new Uint8Array(TASK_ORDER_CAP);
const tasksMeasureScratch = new Uint8Array(TASK_ORDER_CAP);
const tasksLabelCounts = new Uint16Array(TASK_LABEL_NAME.length);
const tasksDecoded = { side: 0, cat: 0, cmp: 0, measure: 0, thresh: 0, mode: 0 };
const TASK_HUE_VIEW = [
	{ hue: new Uint16Array(TASK_HUE_CAP), count: 0 },
	{ hue: new Uint16Array(TASK_HUE_CAP), count: 0 }
];
const tasksHueView = TASK_HUE_VIEW;
const tasksView = [
	{ id: 0, waiting: true, side: 'left', category: 'hot', cmp: '>', measure: 'side', threshold: 50, mode: 'immediate', match: 0, denom: 0, sideTotal: 0, holdSec: 0, holdNeed: TASK_HOLD_SEC, satisfied: false, cost: 0, difficulty: 'waiting' },
	{ id: 1, waiting: true, side: 'left', category: 'hot', cmp: '>', measure: 'side', threshold: 50, mode: 'immediate', match: 0, denom: 0, sideTotal: 0, holdSec: 0, holdNeed: TASK_HOLD_SEC, satisfied: false, cost: 0, difficulty: 'waiting' }
];

let tasksCandN = 0;
let tasksRand = Math.random;
let tasksGenCalls = 0;

function tasksSetRand(fn) {
	tasksRand = fn;
}

const tasksCatNames = [];

function tasksEnsureCatNames() {
	if (tasksCatNames.length) return;
	tasksCatNames[0] = 'hot';
	tasksCatNames[1] = 'cold';
	const len = PALETTE.length;
	for (let p = 0; p < len; p++) tasksCatNames[2 + p] = PALETTE[p][0];
	for (let p = 0; p < len; p++) tasksCatNames[2 + len + p] = PALETTE[p][0] + '/' + PALETTE[(p + 1) % len][0];
}

// 0 hot, 1 cold, then one entry per palette color, then one per adjacent pair: a pair is the hue
// window a "similar to this color" target covers, and with six palette hues every such window is a
// single color or two neighbours, so the discrete set is the whole grammar, not an approximation
function tasksCatCount() {
	return 2 + PALETTE.length * 2;
}

function tasksCatPair(cat) {
	return cat >= 2 + PALETTE.length ? cat - 2 - PALETTE.length : -1;
}

function tasksCatFromName(name) {
	tasksEnsureCatNames();
	for (let cat = 0; cat < tasksCatNames.length; cat++) {
		if (tasksCatNames[cat] === name) return cat;
	}
	return 0;
}

function tasksSideArrow(side) {
	return TASK_SIDE_ARROW[side === 'right' ? 1 : 0];
}

function tasksCatName(cat) {
	tasksEnsureCatNames();
	return tasksCatNames[cat] || 'hot';
}

function tasksCatTotal(cat) {
	if (cat === 0) return simDist.hot;
	if (cat === 1) return simDist.cold;
	const pair = tasksCatPair(cat);
	if (pair < 0) return simDist.palette[cat - 2];
	return simDist.palette[pair] + simDist.palette[(pair + 1) % PALETTE.length];
}

function tasksCatSide(cat, isLeft) {
	if (cat === 0) return isLeft ? simDist.leftHot : simDist.rightHot;
	if (cat === 1) return isLeft ? simDist.leftCold : simDist.rightCold;
	const pal = isLeft ? simDist.leftPalette : simDist.rightPalette;
	const pair = tasksCatPair(cat);
	if (pair < 0) return pal[cat - 2];
	return pal[pair] + pal[(pair + 1) % PALETTE.length];
}

// palette membership of a category: hot and cold span several palette entries, a named color one,
// a range the two neighbors its window covers
function tasksCatHas(cat, p) {
	if (cat === 0) return colorIsWarm(PALETTE[p][1]) ? 1 : 0;
	if (cat === 1) return colorIsCold(PALETTE[p][1]) ? 1 : 0;
	const pair = tasksCatPair(cat);
	if (pair < 0) return cat - 2 === p ? 1 : 0;
	return p === pair || p === (pair + 1) % PALETTE.length ? 1 : 0;
}

function tasksCatHuesById(cat, out) {
	let n = 0;
	for (let p = 0; p < PALETTE.length; p++) if (tasksCatHas(cat, p)) out[n++] = PALETTE[p][1];
	return n;
}

// the hues an objective accepts, so a preview shows the same colors the evaluator counts
function tasksCatHues(name, out) {
	return tasksCatHuesById(tasksCatFromName(name), out);
}

// how many category balls the named chamber needs; the same count tasksCost enumerates downwards
function tasksNeed(v) {
	if (v.denom === 0) return 0;
	return v.cmp === '>'
		? Math.floor(v.threshold * v.denom / 100) + 1
		: Math.floor((v.threshold * v.denom - 1) / 100);
}

function tasksMeets(match, total, cmp, thresh) {
	if (total === 0) return false;
	const left = match * 100;
	const right = thresh * total;
	if (cmp === 0) return left > right;
	return left < right;
}



function tasksShuffle() {
	for (let i = tasksCandN - 1; i > 0; i--) {
		const j = (tasksRand() * (i + 1)) | 0;
		const t = tasksOrder[i];
		tasksOrder[i] = tasksOrder[j];
		tasksOrder[j] = t;
	}
}

// the candidate index layout: mode, side, measure, threshold, comparator, category
function tasksDecode(idx, out) {
	const nCat = tasksCatCount();
	const nThresh = TASK_THRESH.length;
	let v = idx;
	out.mode = v % 2;
	v = (v / 2) | 0;
	out.side = v % 2;
	v = (v / 2) | 0;
	out.measure = v % 2;
	v = (v / 2) | 0;
	out.thresh = TASK_THRESH[v % nThresh];
	v = (v / nThresh) | 0;
	out.cmp = v % 2;
	v = (v / 2) | 0;
	out.cat = v % nCat;
}

function tasksFillView(id) {
	const v = tasksView[id];
	const isLeft = tasksSide[id] === 0;
	const cat = tasksCat[id];
	const hues = TASK_HUE_VIEW[id];
	hues.count = tasksCatHuesById(cat, hues.hue);
	v.waiting = tasksWait[id] === 1;
	v.side = TASK_SIDE_NAME[tasksSide[id]];
	v.category = tasksCatName(cat);
	v.cmp = TASK_CMP_NAME[tasksCmp[id]];
	v.measure = TASK_MEASURE_NAME[tasksMeasure[id]];
	v.threshold = tasksThresh[id];
	v.mode = TASK_MODE_NAME[tasksMode[id]];
	v.match = tasksCatSide(tasksCat[id], isLeft);
	v.sideTotal = isLeft ? simDist.left : simDist.right;
	v.denom = tasksMeasure[id] ? tasksCatTotal(tasksCat[id]) : v.sideTotal;
	v.holdSec = tasksHold[id];
	v.holdNeed = TASK_HOLD_SEC;
	v.satisfied = tasksSatisfied(id);
	v.cost = tasksCostAssigned[id];
	v.demand = tasksDemandAssigned[id];
	v.difficulty = v.waiting ? 'waiting' : tasksDifficulty(v.cost);
	v.need = tasksNeed(v);
	v.progress = tasksProgress(id, v);
}

// The card and the score have to read the same split: a whole-canvas objective counts its threshold
// against every ball of the category, and reading the chamber here instead left the card satisfied
// while the score never moved.
function tasksSatisfied(id) {
	const isLeft = tasksSide[id] === 0;
	const denom = tasksMeasure[id] ? tasksCatTotal(tasksCat[id]) : (isLeft ? simDist.left : simDist.right);
	return tasksMeets(tasksCatSide(tasksCat[id], isLeft), denom, tasksCmp[id], tasksThresh[id]);
}

// A hold objective's bar counts the hold itself once the split is met; otherwise the bar counts how
// much of the priced crossing distance is already paid. Both read 1 when the objective is done.
function tasksProgress(id, v) {
	if (v.waiting) return 0;
	if (v.satisfied && tasksMode[id]) return v.holdSec / TASK_HOLD_SEC;
	if (v.satisfied) return 1;
	// the view is painted between fixed steps, so the snapshot can be new while the cached walk is
	// not: recompute against this snapshot instead of a revision the next view may not have seen
	tasksRemaining[id] = tasksCostAssigned[id] < 1 ? 0
		: tasksCost(tasksCat[id], tasksCmp[id], tasksThresh[id], tasksSide[id] === 0, tasksMeasure[id]);
	const left = tasksRemaining[id];
	if (left < 0) return 0;
	const start = tasksCostAssigned[id];
	if (start <= 0) return 1;
	const share = 1 - left / start;
	return share < 0 ? 0 : (share > 1 ? 1 : share);
}

// the label is drawn first, then a candidate inside it: bands differ in width, so a flat draw
// over candidates would make the widest band the default difficulty (plan 0.4)
function tasksGenerate(id) {
	tasksGenCalls++;
	tasksShuffle();
	tasksLabelCounts.fill(0);
	for (let i = 0; i < tasksCandN; i++) {
		tasksDecode(tasksOrder[i], tasksDecoded);
		const d = tasksDecoded;
		const cost = tasksCost(d.cat, d.cmp, d.thresh, d.side === 0, d.measure);
		const demand = cost < 1 ? cost : tasksDemand(d.cat, d.cmp, d.thresh, d.side === 0, d.measure);
		const band = tasksInBand(cost, demand, d.measure, d.mode) ? tasksBand(cost) : -1;
		tasksCostScratch[i] = cost;
		tasksDemandScratch[i] = demand;
		tasksBandScratch[i] = band;
		tasksCmpScratch[i] = d.cmp;
		tasksMeasureScratch[i] = d.measure;
		if (band < 0) continue;
		tasksLabelCounts[band]++;
	}
	const pick = tasksPickCandidate();
	if (pick < 0) {
		tasksWait[id] = 1;
		tasksCostAssigned[id] = 0;
		tasksDemandAssigned[id] = 0;
		tasksWaitRev[id] = simDist.rev;
		tasksHold[id] = 0;
		tasksHoldSteps[id] = 0;
		tasksFillView(id);
		return false;
	}
	tasksDecode(tasksOrder[pick], tasksDecoded);
	const d = tasksDecoded;
	tasksWait[id] = 0;
	tasksHold[id] = 0;
	tasksHoldSteps[id] = 0;
	tasksSide[id] = d.side;
	tasksCat[id] = d.cat;
	tasksCmp[id] = d.cmp;
	tasksMeasure[id] = d.measure;
	tasksThresh[id] = d.thresh;
	tasksMode[id] = d.mode;
	tasksCostAssigned[id] = tasksCostScratch[pick];
	tasksDemandAssigned[id] = tasksDemandScratch[pick];
	tasksFillView(id);
	return true;
}

// uniform over the labels the distribution can pay for, then uniform inside the chosen label;
// an absent label never collapses the pick onto its neighbours
function tasksPickCandidate() {
	let label = -1;
	let k = 0;
	for (let i = 0; i < tasksLabelCounts.length; i++) {
		if (!tasksLabelCounts[i]) continue;
		k++;
		if ((tasksRand() * k | 0) === 0) label = i;
	}
	if (label < 0) return -1;
	// The comparator and the denominator are separate grammars and one side of each is usually the
	// rarer playable one, so both are drawn by equal chance and only then narrowed: a flat draw over
	// candidates would make "less than" and the whole-canvas measure accidents of the field instead
	// of halves of the quest list
	let cmp = (tasksRand() * 2) | 0;
	if (!tasksLabelHas(label, cmp, -1)) cmp = 1 - cmp;
	let measure = (tasksRand() * 2) | 0;
	if (!tasksLabelHas(label, cmp, measure)) measure = 1 - measure;
	if (!tasksLabelHas(label, cmp, measure)) return -1;
	let pick = -1;
	let j = 0;
	for (let i = 0; i < tasksCandN; i++) {
		if (tasksBandScratch[i] !== label) continue;
		if (tasksCmpScratch[i] !== cmp || tasksMeasureScratch[i] !== measure) continue;
		j++;
		if ((tasksRand() * j | 0) === 0) pick = i;
	}
	return pick;
}

// cmp or measure of -1 means "any", so the first pass tests a label without narrowing it
function tasksLabelHas(label, cmp, measure) {
	for (let i = 0; i < tasksCandN; i++) {
		if (tasksBandScratch[i] !== label) continue;
		if (cmp >= 0 && tasksCmpScratch[i] !== cmp) continue;
		if (measure >= 0 && tasksMeasureScratch[i] !== measure) continue;
		return true;
	}
	return false;
}

function tasksInit() {
	tasksCandN = 2 * 2 * 2 * TASK_THRESH.length * 2 * tasksCatCount();
	for (let i = 0; i < tasksCandN; i++) tasksOrder[i] = i;
	for (let id = 0; id < TASK_SLOTS; id++) {
		tasksOn[id] = 0;
		tasksWait[id] = 0;
		tasksHold[id] = 0;
		tasksHoldSteps[id] = 0;
	}
	tasksScore.fill(0);
	tasksGenCalls = 0;
}

function tasksAttach(id) {
	if (id < 0 || id >= TASK_SLOTS) return;
	tasksOn[id] = 1;
	tasksGenerate(id);
}

// One objective per live participant: a participant leaving takes its objective with it,
// so the one left is never measured against a slot nobody is playing.
function tasksAny() {
	for (let id = 0; id < TASK_SLOTS; id++) if (tasksOn[id]) return true;
	return false;
}

function tasksRestart() {
	const prior = tasksOn.slice();
	for (let id = 0; id < TASK_SLOTS; id++) tasksOn[id] = 0;
	for (let id = 0; id < players.count; id++) {
		if (prior[id]) tasksOn[id] = 1;
		else tasksAttach(id);
	}
}

// A smaller population can invalidate an assigned cost, so active objectives are priced again.
function tasksRegenerate() {
	for (let id = 0; id < players.count; id++) tasksAttach(id);
}

function tasksAssign(id, sideName, catName, cmpStr, threshold, modeName, measureName) {
	tasksOn[id] = 1;
	tasksWait[id] = 0;
	tasksHold[id] = 0;
	tasksHoldSteps[id] = 0;
	tasksSide[id] = sideName === 'right' ? 1 : 0;
	tasksCat[id] = tasksCatFromName(catName);
	tasksCmp[id] = cmpStr === '<' ? 1 : 0;
	tasksMeasure[id] = measureName === 'total' ? 1 : 0;
	tasksThresh[id] = threshold;
	tasksMode[id] = modeName === 'hold' ? 1 : 0;
	tasksCostAssigned[id] = tasksCost(tasksCat[id], tasksCmp[id], tasksThresh[id], tasksSide[id] === 0, tasksMeasure[id]);
	tasksDemandAssigned[id] = tasksDemand(tasksCat[id], tasksCmp[id], tasksThresh[id], tasksSide[id] === 0, tasksMeasure[id]);
	tasksFillView(id);
}

// the card paints between fixed steps, so it reads the view it just refreshed rather than the one
// the last step left behind
function tasksRefresh() {
	for (let id = 0; id < TASK_SLOTS; id++) {
		if (tasksOn[id]) tasksFillView(id);
	}
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
	if (!tasksSatisfied(id)) {
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
	tasksScore[id]++;
	tasksGenerate(id);
}

if (typeof module !== 'undefined') module.exports = {
	tasksInit,
	tasksAttach,
	tasksRestart,
	tasksRegenerate,
	tasksAny,
	tasksAssign,
	tasksStep,
	tasksSetRand,
	tasksCatHues,
	tasksCatHas,
	tasksCatCount,
	tasksCatName,
	tasksNeed,
	tasksMeets,
	tasksCatFromName,
	tasksSideArrow,
	tasksCatTotal,
	tasksCatSide,
	tasksView,
	tasksOn,
	tasksScore,
	tasksWait,
	tasksHold,
	tasksGenCount,
	tasksRefresh,
	TASK_HOLD_SEC,
	TASK_THRESH,
	TASK_SLOTS,
	TASK_LABEL_NAME,
	tasksHueView,
	tasksCostAssigned,
	tasksDemandAssigned,
	tasksMeasure,
	TASK_MEASURE_NAME
};
