// owns: task rules, generation, difficulty, per-participant lifecycle, view model
// edit for: predicates, candidates, difficulty bands, hold duration, view fields

const TASK_SLOTS = 2;
const TASK_HOLD_SEC = 2;
const TASK_THRESH = [30, 40, 50, 60, 70];
const TASK_SIDE_NAME = ['left', 'right'];
const TASK_CMP_NAME = ['>', '<'];
const TASK_MODE_NAME = ['immediate', 'hold'];
const TASK_ORDER_CAP = 512;
const TASK_HUE_CAP = 6;

// crossings: the fewest balls that must change chamber. below the floor the outcome is decided by
// two balls, which random drift flips on its own; the ceiling is three quarters of the live balls
const TASK_COST_MIN = 3;
const TASK_COST_FRAC = 0.75;
const TASK_COST_CAP = 27;
const TASK_LABEL_NAME = ['easy', 'normal', 'hard', 'expert'];
const TASK_LABEL_COST = [5, 10, 17];

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
const tasksCostAssigned = new Uint16Array(TASK_SLOTS);
const tasksOrder = new Uint16Array(TASK_ORDER_CAP);
const tasksCostScratch = new Int16Array(TASK_ORDER_CAP);
const tasksLabelCounts = new Uint16Array(TASK_LABEL_NAME.length);
const tasksDecoded = { side: 0, cat: 0, cmp: 0, thresh: 0, mode: 0 };
const TASK_HUE_VIEW = [
	{ hue: new Uint16Array(TASK_HUE_CAP), count: 0 },
	{ hue: new Uint16Array(TASK_HUE_CAP), count: 0 }
];
const tasksHueView = TASK_HUE_VIEW;
const tasksView = [
	{ id: 0, waiting: true, side: 'left', category: 'hot', cmp: '>', threshold: 50, mode: 'immediate', match: 0, sideTotal: 0, holdSec: 0, holdNeed: TASK_HOLD_SEC, satisfied: false, cost: 0, difficulty: 'waiting' },
	{ id: 1, waiting: true, side: 'left', category: 'hot', cmp: '>', threshold: 50, mode: 'immediate', match: 0, sideTotal: 0, holdSec: 0, holdNeed: TASK_HOLD_SEC, satisfied: false, cost: 0, difficulty: 'waiting' }
];

let tasksCandN = 0;
let tasksRand = Math.random;
let tasksGenCalls = 0;

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

// palette membership of a category: hot and cold span several palette entries, a named color one
function tasksCatHas(cat, p) {
	if (cat > 1) return cat - 2 === p ? 1 : 0;
	const hue = PALETTE[p][1];
	return (cat === 0 ? colorIsWarm(hue) : colorIsCold(hue)) ? 1 : 0;
}

// the hues an objective accepts, so a preview shows the same colors the evaluator counts
function tasksCatHues(name, out) {
	const cat = tasksCatFromName(name);
	let n = 0;
	for (let p = 0; p < PALETTE.length; p++) if (tasksCatHas(cat, p)) out[n++] = PALETTE[p][1];
	return n;
}

// how many category balls the named chamber needs; the same count tasksCost enumerates downwards
function tasksNeed(v) {
	if (v.sideTotal === 0) return 0;
	return v.cmp === '>'
		? Math.floor(v.threshold * v.sideTotal / 100) + 1
		: Math.floor((v.threshold * v.sideTotal - 1) / 100);
}



function tasksMeets(match, total, cmp, thresh) {
	if (total === 0) return false;
	const left = match * 100;
	const right = thresh * total;
	if (cmp === 0) return left > right;
	return left < right;
}

// reachability reads only the live population: every split of it is realizable from either
// chamber, so the named side cannot change the answer and any side may stand in for it
function tasksFeasible(cat, cmp, thresh) {
	return tasksCost(cat, cmp, thresh, true) >= 0;
}

function tasksCost(cat, cmp, thresh, isLeft) {
	return tasksCheapest(cat, cmp, thresh, isLeft, null);
}

// a ball crossing the opening is the only way to change (sideTotal, match); for a fixed side total
// the cheapest plan is the unit-L1 walk from the current (other, category) counts. plan 0.4.
// `out` receives that plan as (side total, category count): the goal view moves exactly those balls.
function tasksCheapest(cat, cmp, thresh, isLeft, out) {
	const nAll = simDist.total;
	const nCat = tasksCatTotal(cat);
	const sn = isLeft ? simDist.left : simDist.right;
	const sc = tasksCatSide(cat, isLeft);
	const u = sn - sc;
	let best = -1;
	let bestClose = 0;
	let bestSide = 0;
	let bestMatch = 0;
	for (let s = 1; s <= nAll; s++) {
		const mHi = nCat < s ? nCat : s;
		const mMin = nCat - (nAll - s);
		const lo = mMin > 0 ? mMin : 0;
		// the threshold is one linear inequality in m, so the satisfying m form one run
		const cut = cmp === 0 ? Math.floor(thresh * s / 100) + 1 : Math.floor((thresh * s - 1) / 100);
		const mFrom = cmp === 0 ? cut : lo;
		const mTo = cmp === 0 ? mHi : cut;
		const from = mFrom > lo ? mFrom : lo;
		const to = mTo < mHi ? mTo : mHi;
		if (from > to) continue;
		// |m - sc| + |(s - m) - u| is convex and flat between m = sc and m = s - u, so the allowed
		// m nearest that stretch is its cheaper end clamped into the run
		const flat = sc < s - u ? sc : s - u;
		const at = flat < from ? from : (flat > to ? to : flat);
		const c = Math.abs(at - sc) + Math.abs(s - at - u);
		// equal cost picks the split nearest the current chamber size, so a goal is not drawn as an
		// almost empty chamber when staying put costs the same as emptying it
		const close = Math.abs(s - sn);
		if (best >= 0 && (c > best || (c === best && close >= bestClose))) continue;
		best = c;
		bestClose = close;
		bestSide = s;
		bestMatch = at;
	}
	if (out && best >= 0) {
		out.side = bestSide;
		out.match = bestMatch;
	}
	return best;
}

function tasksCostMax() {
	const c = (simDist.total * TASK_COST_FRAC) | 0;
	return c < TASK_COST_CAP ? c : TASK_COST_CAP;
}

function tasksBand(cost) {
	if (cost < 0) return -1;
	for (let i = 0; i < TASK_LABEL_COST.length; i++) {
		if (cost <= TASK_LABEL_COST[i]) return i;
	}
	return TASK_LABEL_COST.length;
}

// a task cheaper than the floor is decided by one or two balls, which random drift flips on its own
function tasksInBand(cost) {
	return cost >= TASK_COST_MIN && cost <= tasksCostMax();
}

function tasksDifficulty(cost) {
	const band = tasksBand(cost);
	return band < 0 ? 'impossible' : TASK_LABEL_NAME[band];
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
	const hues = TASK_HUE_VIEW[id];
	hues.count = tasksCatHues(tasksCatName(tasksCat[id]), hues.hue);
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
	v.cost = tasksCostAssigned[id];
	v.difficulty = v.waiting ? 'waiting' : tasksDifficulty(v.cost);
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
		const cost = tasksCost(d.cat, d.cmp, d.thresh, d.side === 0);
		tasksCostScratch[i] = cost;
		if (!tasksInBand(cost)) continue;
		tasksLabelCounts[tasksBand(cost)]++;
	}
	const pick = tasksPickCandidate();
	if (pick < 0) {
		tasksWait[id] = 1;
		tasksCostAssigned[id] = 0;
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
	tasksThresh[id] = d.thresh;
	tasksMode[id] = d.mode;
	tasksCostAssigned[id] = tasksCostScratch[pick];
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
	let pick = -1;
	let j = 0;
	for (let i = 0; i < tasksCandN; i++) {
		if (tasksBand(tasksCostScratch[i]) !== label || !tasksInBand(tasksCostScratch[i])) continue;
		j++;
		if ((tasksRand() * j | 0) === 0) pick = i;
	}
	return pick;
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
	tasksCostAssigned[id] = tasksCost(tasksCat[id], tasksCmp[id], tasksThresh[id], tasksSide[id] === 0);
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

if (typeof module !== 'undefined') module.exports = {
	tasksInit,
	tasksAttach,
	tasksAssign,
	tasksStep,
	tasksSetRand,
	tasksCatHues,
	tasksCatHas,
	tasksNeed,
	tasksMeets,
	tasksFeasible,
	tasksCost,
	tasksCheapest,
	tasksBand,
	tasksInBand,
	tasksDifficulty,
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
	TASK_SLOTS,
	TASK_COST_MIN,
	TASK_COST_FRAC,
	TASK_COST_CAP,
	TASK_LABEL_NAME,
	TASK_LABEL_COST,
	tasksHueView,
	tasksCostMax,
	tasksCostAssigned
};
