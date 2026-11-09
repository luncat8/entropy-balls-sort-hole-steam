// owns: the priced walk from the live distribution to a satisfying split, and the difficulty bands
// edit for: cost/demand arithmetic, band edges, floors, crossing values

// Difficulty is counted in crossings: that is the one quantity that ordered measured completion times
// (15 s / 21 s / 24 s at 3-4 / 5-7 / 8+ crossings over 90 seeded objectives). Below the floor the
// outcome is decided by one or two balls, which random drift flips on its own; the ceiling is three
// quarters of the live balls.
const TASK_COST_MIN = 3;
const TASK_COST_FRAC = 0.75;
const TASK_COST_CAP = 27;
// Crossings alone under-prices a job only a couple of balls can do, because the same crossing has to
// wait for the one ball that can supply it. Demand multiplies each crossing by the live balls per
// supplied ball, and its ceiling is the guard against those objectives — the draft's "total green is
// two" case. It does not set the label: measured over the same objectives, demand stopped ordering
// completion times above its middle band while crossings kept ordering them.
const TASK_DEMAND_FRAC = 1.5;
const TASK_DEMAND_CAP = 54;

// band edges in crossings, applied to the label vocabulary tasks.js renders
const TASK_LABEL_COST = [5, 10, 17];

// reachability reads only the live population: every split of it is realizable from either
// chamber, so the named side cannot change the answer and any side may stand in for it
function tasksFeasible(cat, cmp, thresh, measure) {
	return tasksCost(cat, cmp, thresh, true, measure) >= 0;
}

function tasksCost(cat, cmp, thresh, isLeft, measure) {
	return tasksCheapest(cat, cmp, thresh, isLeft, measure, null);
}

// A ball crossing the opening is the only way to change (sideTotal, match). The denominator is the
// chamber size for the side measure and the category total for the whole-canvas measure, so the only
// difference between them is the run of satisfying category counts. plan 0.4, 2.5.
// `out` receives the plan as (side total, category count): the goal view moves exactly those balls.
function tasksCheapest(cat, cmp, thresh, isLeft, measure, out) {
	const sn = isLeft ? simDist.left : simDist.right;
	const sc = tasksCatSide(cat, isLeft);
	return tasksCostFrom(cat, cmp, thresh, sn, sc, simDist.total, tasksCatTotal(cat), measure, out);
}

// the same walk from explicit counts, so a caller can price an imagined crossing without touching
// the snapshot: the bot's crossing value and the difficulty are then one piece of arithmetic
function tasksCostFrom(cat, cmp, thresh, sn, sc, nAll, nCat, measure, out) {
	if (measure && nCat === 0) return -1;
	const u = sn - sc;
	let best = -1;
	let bestClose = 0;
	let bestSide = 0;
	let bestMatch = 0;
	for (let s = measure ? 0 : 1; s <= nAll; s++) {
		const mHi = nCat < s ? nCat : s;
		const mMin = nCat - (nAll - s);
		const lo = mMin > 0 ? mMin : 0;
		// the threshold is one linear inequality in m, so the satisfying m form one run
		const denom = measure ? nCat : s;
		// integer division, not Math.floor: the denominator is positive and the threshold is positive
		const cut = cmp === 0 ? (thresh * denom / 100 | 0) + 1 : ((thresh * denom - 1) / 100 | 0);
		const mFrom = cmp === 0 ? cut : lo;
		const mTo = cmp === 0 ? mHi : cut;
		const from = mFrom > lo ? mFrom : lo;
		const to = mTo < mHi ? mTo : mHi;
		if (from > to) continue;
		// |m - sc| + |(s - m) - u| is convex and flat between m = sc and m = s - u, so the allowed
		// m nearest that stretch is its cheaper end clamped into the run
		const flat = sc < s - u ? sc : s - u;
		const at = flat < from ? from : (flat > to ? to : flat);
		const dm = at > sc ? at - sc : sc - at;
		const du = s - at - u;
		const c = dm + (du > 0 ? du : -du);
		// equal cost picks the split nearest the current chamber size, so a goal is not drawn as an
		// almost empty chamber when staying put costs the same as emptying it
		const close = s > sn ? s - sn : sn - s;
		// first hit wins too: a reachable zero costs nothing better, and dropping it would let a
		// satisfied objective read as unreachable to every caller of the cost
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

// The crossings the plan needs, scaled by how few balls can supply them: a job that only two balls on
// the whole canvas can do costs more traffic to complete than one that ten balls can do, and the
// draft's "total green is 2" case is exactly that. Cost sets the label and the progress bar;
// demand is the scarcity ceiling for generation.
const tasksPlanScratch = { side: 0, match: 0 };
function tasksDemand(cat, cmp, thresh, isLeft, measure) {
	const plan = tasksPlanScratch;
	if (tasksCheapest(cat, cmp, thresh, isLeft, measure, plan) < 0) return -1;
	const nAll = simDist.total;
	const nCat = tasksCatTotal(cat);
	const sn = isLeft ? simDist.left : simDist.right;
	const sc = tasksCatSide(cat, isLeft);
	const otherNow = sn - sc;
	const needCat = plan.match - sc;
	const needOther = (plan.side - plan.match) - otherNow;
	let demand = 0;
	if (needCat) {
		const supply = needCat > 0 ? nCat - sc : sc;
		demand += (needCat > 0 ? needCat : -needCat) * nAll / (supply > 0 ? supply : 1);
	}
	if (needOther) {
		const supply = needOther > 0 ? (nAll - nCat) - otherNow : otherNow;
		demand += (needOther > 0 ? needOther : -needOther) * nAll / (supply > 0 ? supply : 1);
	}
	return Math.round(demand);
}

// What one crossing does to the priced distance: -1 away, 0 no change, 1 toward. The bot reads the
// four combinations once per think, so a lane is scored by the same arithmetic the difficulty and the
// progress bar use, and neither denominator needs its own rule.
function tasksCrossValue(cat, cmp, thresh, isLeft, measure, isCat, entering) {
	const nAll = simDist.total;
	const nCat = tasksCatTotal(cat);
	const sn = isLeft ? simDist.left : simDist.right;
	const sc = tasksCatSide(cat, isLeft);
	const ds = entering ? 1 : -1;
	const dm = isCat ? ds : 0;
	const s2 = sn + ds;
	const m2 = sc + dm;
	// a crossing that cannot happen is not progress and not damage: a category ball has to sit in a
	// chamber, and the balls outside a chamber have to fit the canvas
	if (s2 < 0 || s2 > nAll || m2 < 0 || m2 > nCat) return 0;
	if (m2 > s2 || nCat - m2 > nAll - s2) return 0;
	const before = tasksCostFrom(cat, cmp, thresh, sn, sc, nAll, nCat, measure, null);
	if (before < 0) return 0;
	const after = tasksCostFrom(cat, cmp, thresh, sn + ds, sc + dm, nAll, nCat, measure, null);
	if (after === before) return 0;
	return after < before ? 1 : -1;
}

function tasksCostMax() {
	const c = (simDist.total * TASK_COST_FRAC) | 0;
	return c < TASK_COST_CAP ? c : TASK_COST_CAP;
}

function tasksBand(demand) {
	if (demand < 0) return -1;
	for (let i = 0; i < TASK_LABEL_COST.length; i++) {
		if (demand <= TASK_LABEL_COST[i]) return i;
	}
	return TASK_LABEL_COST.length;
}

// A whole-canvas immediate objective only needs its own category to cross, and measured completions
// arrive about twice as fast as a chamber-share one (median 5.5 s against 21.4 s), so it is never
// offered at the general floor.
function tasksFloor(measure, mode) {
	return measure === 1 && mode === 0 ? TASK_COST_MIN + 1 : TASK_COST_MIN;
}

function tasksInBand(cost, demand, measure, mode) {
	if (cost < tasksFloor(measure, mode) || cost > tasksCostMax()) return false;
	return demand <= tasksDemandMax();
}

function tasksDemandMax() {
	const c = (simDist.total * TASK_DEMAND_FRAC) | 0;
	return c < TASK_DEMAND_CAP ? c : TASK_DEMAND_CAP;
}

function tasksDifficulty(cost) {
	const band = tasksBand(cost);
	return band < 0 ? 'impossible' : TASK_LABEL_NAME[band];
}

if (typeof module !== 'undefined') module.exports = {
	tasksFeasible,
	tasksCost,
	tasksCheapest,
	tasksCostFrom,
	tasksDemand,
	tasksCrossValue,
	tasksBand,
	tasksInBand,
	tasksFloor,
	tasksDifficulty,
	tasksCostMax,
	tasksDemandMax,
	TASK_COST_MIN,
	TASK_COST_FRAC,
	TASK_COST_CAP,
	TASK_DEMAND_FRAC,
	TASK_DEMAND_CAP,
	TASK_LABEL_COST
};
