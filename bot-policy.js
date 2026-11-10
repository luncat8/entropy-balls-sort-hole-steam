// owns: crossing prediction and priced bot plans, including whole-body divider fit
// edit for: prediction events, fit bounds and crossing values

const BOT_CROSS_PASSES = 3;
const botScratch = {
	t: new Float32Array(BALL_CAP * BOT_CROSS_PASSES),
	touchT: new Float32Array(BALL_CAP * BOT_CROSS_PASSES),
	y: new Float32Array(BALL_CAP * BOT_CROSS_PASSES),
	touchY: new Float32Array(BALL_CAP * BOT_CROSS_PASSES),
	r: new Float32Array(BALL_CAP * BOT_CROSS_PASSES),
	// category membership of each crossing for the bot and, when it scores denial, for the opponent:
	// the two plans read the same crossing list, only the category that counts differs
	cat: new Uint8Array(BALL_CAP * BOT_CROSS_PASSES),
	riv: new Uint8Array(BALL_CAP * BOT_CROSS_PASSES),
	dir: new Int8Array(BALL_CAP * BOT_CROSS_PASSES),
	n: 0
};
const botPlanOut = { side: 0, match: 0 };
// needCat and spareOther are the two signed changes the split the difficulty priced still needs in the
// named chamber: matching balls to add (or to leave, when negative) and the same for the other balls.
// Their magnitudes are the crossings still to make, and their signs say which crossing makes one.
// The four values are what one crossing of each kind does to the priced distance, read straight off
// tasks.js: a lane is scored from them, so neither denominator needs its own rule in the policy.
// Two plans share the shape: the bot's own, and the opponent's when its character scores denial.
function botPlanCreate() {
	return {
		active: false, cmp: 0, measure: 0, cat: 0, isLeft: false,
		needCat: 0, spareOther: 0, cost: 0,
		valCatIn: 0, valCatOut: 0, valOtherIn: 0, valOtherOut: 0
	};
}
const botPlan = botPlanCreate();
const botRivalPlan = botPlanCreate();

// The goal is a split, not a direction: matching balls already in the named chamber are the quota
// that has to stay, every other ball leaving is one of them, and a matching ball leaving spends two
// crossings. Reading only "does this ball want to be on that side" cannot tell those apart.
function botPlanOpen(id, plan) {
	plan.active = false;
	if (!tasksOn[id]) return false;
	const v = tasksView[id];
	if (v.waiting) return false;
	// a satisfied objective still has a plan: nothing is left to fill, so every crossing scores at or
	// below zero and aiming becomes the defence — the split only has to survive the hold.
	plan.cmp = v.cmp === '>' ? 0 : 1;
	plan.measure = v.measure === 'total' ? 1 : 0;
	plan.isLeft = v.side === 'left';
	const isLeft = plan.isLeft;
	const cat = tasksCatFromName(v.category);
	plan.cat = cat;
	if (tasksCheapest(cat, plan.cmp, v.threshold, isLeft, plan.measure, botPlanOut) < 0) return false;
	const namedMatch = isLeft ? simDist.leftPalette : simDist.rightPalette;
	const named = isLeft ? simDist.left : simDist.right;
	let catNow = 0;
	for (let p = 0; p < namedMatch.length; p++) if (tasksCatHas(cat, p)) catNow += namedMatch[p];
	// the quota the goal needs is stable while the objective stands, unlike the split the solver
	// reties every think: matching balls still to enter, and spare others that may leave
	plan.needCat = botPlanOut.match - catNow;
	plan.spareOther = (named - catNow) - (botPlanOut.side - botPlanOut.match);
	plan.cost = Math.abs(plan.needCat) + Math.abs(plan.spareOther);
	plan.valCatIn = tasksCrossValue(cat, plan.cmp, v.threshold, isLeft, plan.measure, 1, 1);
	plan.valCatOut = tasksCrossValue(cat, plan.cmp, v.threshold, isLeft, plan.measure, 1, 0);
	plan.valOtherIn = tasksCrossValue(cat, plan.cmp, v.threshold, isLeft, plan.measure, 0, 1);
	plan.valOtherOut = tasksCrossValue(cat, plan.cmp, v.threshold, isLeft, plan.measure, 0, 0);
	plan.active = true;
	return true;
}

// The opponent's plan at the same field, so a denier scores the crossings the hole would hand them.
// Nothing to deny (a lone slot, a waiting objective, or a character that never looks at the rival)
// leaves it inactive, and the lane score then reads the bot's own crossings alone.
function botRivalOpen(id) {
	botRivalPlan.active = false;
	if (botWeight.rival === 0) return false;
	const rivalId = 1 - id;
	if (rivalId === id || rivalId >= players.count) return false;
	return botPlanOpen(rivalId, botRivalPlan);
}

// ---- predicted crossings

// Seconds until this ball can meet the divider. A ball heading for it reaches the centre line
// directly; one heading for its outer wall has to cover all of that chamber first. The distribution
// counts a ball by which side its centre is on, so the centre line is the crossing.
function botCrossTime(i) {
	const vx = simBalls.vx[i];
	const speed = Math.abs(vx);
	if (speed < simPx(1)) return -1;
	const d = simField.wallX - simBalls.x[i];
	if (vx < 0 ? d < 0 : d > 0) return Math.abs(d) / speed;
	const wall = vx < 0 ? simBalls.r[i] : simField.w - simBalls.r[i];
	return (Math.abs(simBalls.x[i] - wall) + Math.abs(wall - simField.wallX)) / speed;
}

// Where the ball is after t seconds of straight flight, folded back between the horizontal walls.
function botFoldY(y, vy, t, r) {
	const span = simField.h - 2 * r;
	if (span < 1) return y;
	let u = y - r + vy * t;
	u %= 2 * span;
	if (u < 0) u += 2 * span;
	if (u > span) u = 2 * span - u;
	return r + u;
}

// Every crossing a ball will make inside the horizon, not just the next one. A ball crossing the
// divider is in the other chamber moving away, so it comes back after twice that chamber's width;
// with both chambers the same width the interval repeats, and the lane advances by vy times it.
// This is the structure a hole can exploit: a lane that collects repeat crossings beats one that
// waits for a single ball.
function botPredict(span = botTune.horizon, passes = BOT_CROSS_PASSES) {
	const rival = botRivalPlan.active;
	let n = 0;
	for (let i = 0; i < simBalls.count; i++) {
		const t0 = botCrossTime(i);
		if (t0 < 0) continue;
		const r = simBalls.r[i];
		const speed = Math.abs(simBalls.vx[i]);
		const left = (simField.wallX - r) * 2 / speed;
		const right = (simField.w - simField.wallX - r) * 2 / speed;
		const cat0 = tasksCatHas(botPlan.cat, simBalls.palette[i]) ? 1 : 0;
		const riv0 = rival && tasksCatHas(botRivalPlan.cat, simBalls.palette[i]) ? 1 : 0;
		// the next crossing always goes to the opposite chamber — a ball moving away from the divider
		// turns around first — so the side it is on sets the direction, not its velocity sign
		let dir = simBalls.x[i] < simField.wallX ? 1 : -1;
		// the height of a crossing is the vertical fold at that crossing's own time: reading the
		// current height instead aims the hole where the ball is now, one crossing behind
		for (let t = t0, k = 0; k < passes && t <= span; k++) {
			const touchT = Math.max(0, t - r / speed);
			const touchY = botFoldY(simBalls.y[i], simBalls.vy[i], touchT, r);
			const y = botFoldY(simBalls.y[i], simBalls.vy[i], t, r);
			botScratch.t[n] = t;
			botScratch.touchT[n] = touchT;
			botScratch.touchY[n] = touchY;
			botScratch.y[n] = y;
			botScratch.r[n] = r;
			botScratch.cat[n] = cat0;
			botScratch.riv[n] = riv0;
			botScratch.dir[n] = dir;
			n++;
			t += dir > 0 ? right : left;
			dir = -dir;
		}
	}
	botScratch.n = n;
	return n;
}

// The opening only takes a ball whose whole body fits. Keep the simulation's float32 edge slack in
// the usable half-height so prediction and divider contact agree at the lip.
function botLaneHalf(j) {
	const half = simAperture.size / 2 - botScratch.r[j] + APERTURE_FIT_SLACK;
	return half > 0 ? half : 0;
}

function botLaneTravel(yc) {
	return Math.abs(yc - simAperture.y) / (simAperture.speed * botTune.mag);
}

// A lane must be reachable at first touch, and the whole body must fit both there and at the centre
// line. Checking only the latter predicts passes that the plate turns back while the body is crossing.
function botLaneHits(j, yc, travel) {
	const half = botLaneHalf(j);
	return half > 0 && botScratch.touchT[j] >= travel
		&& Math.abs(botScratch.touchY[j] - yc) <= half
		&& Math.abs(botScratch.y[j] - yc) <= half;
}

// Crossing ledger for one height, read from the moment the hole arrives: the discount starts there,
// because a crossing already gone by the time the hole gets there is not the lane's business.
function botLaneScore(n, yc) {
	const travel = botLaneTravel(yc);
	let net = 0;
	for (let j = 0; j < n; j++) {
		if (botScratch.t[j] > botTune.horizon || !botLaneHits(j, yc, travel)) continue;
		const v = botCrossValue(j);
		const w = botRivalPlan.active ? botCrossValueRival(j) : 0;
		if (!v && !w) continue;
		const value = 1 / (1 + (botScratch.t[j] - travel) / botTune.decay);
		net += value * (botCrossScore(v) + botRivalScore(w));
	}
	return net * botTune.cross - travel;
}

// A crossing that loses ground costs more than one that gains it: progress can be made again later,
// while a lost crossing also burns the travel that was spent arriving.
function botCrossScore(v) {
	return v > 0 ? v : v * botTune.harm;
}

// The denier's half: only a crossing the opponent would gain from is charged to the lane.
function botRivalScore(w) {
	return w > 0 ? w * botWeight.rival : 0;
}

// A scarce category can have its next useful crossing beyond the scoring horizon: six violet balls
// take seconds to come around, and the hole that dodges meanwhile is parked for traffic the objective
// does not want. This lane is the earliest crossing that still moves the quota, however far off.
function botWaitLane(n) {
	let bestT = 0;
	let bestY = -1;
	for (let j = 0; j < n; j++) {
		if (botCrossValue(j) <= 0 || botLaneHalf(j) <= 0) continue;
		const yc = botClampLane(botScratch.y[j]);
		if (!botLaneHits(j, yc, botLaneTravel(yc))) continue;
		if (bestY >= 0 && botScratch.t[j] >= bestT) continue;
		bestT = botScratch.t[j];
		bestY = yc;
	}
	return bestY;
}

// What this crossing does to the objective, from the four values tasks.js priced for the plan. A
// matching ball entering fills a positive needCat and one leaving fills a negative one, so "left hot
// < 40%" is reached by hot leaving the left; the whole-canvas measure ignores the other balls, which
// is why their crossings score zero instead of counting against the objective.
function botCrossValue(j) {
	return botCrossValueOf(botPlan, botScratch.cat[j] === 1, botScratch.dir[j]);
}

function botCrossValueRival(j) {
	return botCrossValueOf(botRivalPlan, botScratch.riv[j] === 1, botScratch.dir[j]);
}

function botCrossValueOf(plan, isCat, dir) {
	const entering = (dir < 0) === plan.isLeft;
	if (isCat) return entering ? plan.valCatIn : plan.valCatOut;
	return entering ? plan.valOtherIn : plan.valOtherOut;
}

// the aperture's centre cannot leave the field, so a lane outside that range is not a target
function botClampLane(y) {
	const half = simAperture.size / 2;
	if (y < half) return half;
	return y > simField.h - half ? simField.h - half : y;
}

if (typeof module !== 'undefined') module.exports = {
	botScratch, botPlan, botRivalPlan, botPlanOpen, botRivalOpen, botCrossTime, botFoldY, botPredict,
	botLaneHalf, botLaneTravel, botLaneHits, botLaneScore, botCrossScore, botRivalScore, botWaitLane,
	botCrossValue, botCrossValueRival, botClampLane, BOT_CROSS_PASSES
};
