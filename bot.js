// owns: the bots' plan, lane aim, energy rests and fair use of a contested hole
// edit for: bot heuristics, aim horizon, rest thresholds, contest turns

const BOT_THINK_SEC = 0.2;
// A crossing further out than BOT_DECAY_SEC is worth less than one arriving now, so the hole opens
// for the ball it can take instead of waiting on a lane whose traffic is only predicted.
// A crossing has to be worth more than the drive to it, or every possible lane scores below zero
// and the bot stands still: one crossing buys about a second of hole travel.
const BOT_AIM_HORIZON = 4;
const BOT_DECAY_SEC = 2;
const BOT_CROSS_SEC = 1.2;
const BOT_SWITCH_SEC = 0.3;
const BOT_MAG = 0.5;
// a store drained to nothing then trickled reads as a dead bot: it rests low and resumes high
const BOT_REST_SHARE = 0.15;
const BOT_RESUME_SHARE = 0.55;
// Equal opposite requests cancel forever, so one bot owns the hole at a time. A turn has to outlast
// the drive it asks for: with a flat two-second turn two bots reversed each other on most thinks and
// neither objective advanced, because a turn barely covered the travel. The owner keeps the turn
// until it parks, and a long turn still ends so the wait cannot starve the other bot.
const BOT_CONTEST_SEC = 10;
const BOT_DWELL_SEC = 1.5;
// crossings per ball inside the horizon; the physics repeats, the count stays bounded
const BOT_CROSS_PASSES = 3;
// one place for the numbers a measurement may sweep; the policy reads them through botTune
const botTune = {
	horizon: BOT_AIM_HORIZON,
	decay: BOT_DECAY_SEC,
	cross: BOT_CROSS_SEC,
	switchLane: BOT_SWITCH_SEC,
	mag: BOT_MAG,
	think: BOT_THINK_SEC,
	rest: BOT_REST_SHARE,
	resume: BOT_RESUME_SHARE
};

const botState = {
	clock: 0,
	think: new Float32Array(PLAYER_CAP),
	rest: new Uint8Array(PLAYER_CAP),
	aimed: new Uint8Array(PLAYER_CAP),
	targetY: new Float32Array(PLAYER_CAP),
	owner: -1,
	ownedAt: 0,
	parkedAt: -1
};
const botForceView = { energy: 0, capacity: 1 };
const botScratch = {
	t: new Float32Array(BALL_CAP),
	y: new Float32Array(BALL_CAP),
	cat: new Uint8Array(BALL_CAP),
	dir: new Int8Array(BALL_CAP),
	n: 0
};
const botPlanOut = { side: 0, match: 0 };
// needCat and spareOther are the two quotas left to fill, measured from the same satisfying split the
// difficulty priced: matching balls still to enter the named chamber and non-matching ones that may
// still leave it. One crossing fills one of them, so their sum is what is left to do.
const botPlan = { active: false, defend: false, needCat: 0, spareOther: 0, cost: 0 };

function botInit() {
	botState.clock = 0;
	botState.think.fill(0);
	botState.rest.fill(0);
	botState.aimed.fill(0);
	botState.targetY.fill(0);
	botState.owner = -1;
	botState.ownedAt = 0;
	botState.parkedAt = -1;
}

function botSetTuning(values) {
	for (const key in values) {
		if (!(key in botTune) || !Number.isFinite(values[key])) continue;
		botTune[key] = values[key];
	}
}

function botStep(dt) {
	botState.clock += dt;
	for (let id = 0; id < players.count; id++) {
		if (players.type[id] === PLAYER_BOT) botThink(id, dt);
	}
	const priority = botContest();
	for (let id = 0; id < players.count; id++) {
		if (players.type[id] === PLAYER_BOT) botAct(id, priority);
	}
}

function botDeadZone() {
	return simAperture.speed * FIXED_DT / 2 + 0.01;
}

function botWantsHole(id) {
	if (players.type[id] !== PLAYER_BOT || !botState.aimed[id] || botState.rest[id]) return 0;
	const delta = botState.targetY[id] - simAperture.y;
	if (Math.abs(delta) <= botDeadZone()) return 0;
	return delta < 0 ? -1 : 1;
}

// the first bot that wants a move, and the first bot that wants the opposite one
function botOpposed(first) {
	const direction = botWantsHole(first);
	if (!direction) return -1;
	for (let id = first + 1; id < players.count; id++) {
		if (botWantsHole(id) === -direction) return id;
	}
	return -1;
}

// Only an actual opposition yields; aligned requests still combine, and a resting or parked bot
// reserves no turn.
function botContest() {
	let first = -1;
	for (let id = 0; id < players.count && first < 0; id++) {
		if (botWantsHole(id)) first = id;
	}
	if (first < 0) return botRelease();
	const rival = botOpposed(first);
	if (rival < 0) return botRelease();
	const owner = botState.owner;
	if ((owner === first || owner === rival) && botState.clock - botState.ownedAt < BOT_CONTEST_SEC) {
		if (!botParked(owner)) return owner;
	}
	botState.owner = owner === first ? rival : first;
	botState.ownedAt = botState.clock;
	botState.parkedAt = -1;
	return botState.owner;
}

function botRelease() {
	botState.owner = -1;
	botState.parkedAt = -1;
	return -1;
}

// the owner hands the hole over once it has held its height long enough to take the crossing there
function botParked(id) {
	if (!botWantsHole(id)) return true;
	if (botState.parkedAt < 0) botState.parkedAt = botState.clock;
	return botState.clock - botState.parkedAt >= BOT_DWELL_SEC;
}

function botThink(id, dt) {
	botState.think[id] -= dt;
	if (botState.think[id] > 0) return;
	botState.think[id] = botTune.think;
	botAim(id);
}

// ---- the plan

// The goal is a split, not a direction: matching balls already in the named chamber are the quota
// that has to stay, every other ball leaving is one of them, and a matching ball leaving spends two
// crossings. Reading only "does this ball want to be on that side" cannot tell those apart.
function botPlanOpen(id) {
	botPlan.active = false;
	if (!tasksOn[id]) return false;
	const v = tasksView[id];
	if (v.waiting) return false;
	// a satisfied objective still has a plan: nothing is left to fill, so no crossing can be progress
	// and the bot simply raises no lane. A satisfied hold is still a job — the split has to survive
	// the hold — so that one mirrors the ledger and parks where harmful crossings are fewest.
	botPlan.defend = v.satisfied && v.mode === 'hold';
	const isLeft = v.side === 'left';
	const cat = tasksCatFromName(v.category);
	if (tasksCheapest(cat, v.cmp === '>' ? 0 : 1, v.threshold, isLeft, botPlanOut) < 0) return false;
	const namedMatch = isLeft ? simDist.leftPalette : simDist.rightPalette;
	const named = isLeft ? simDist.left : simDist.right;
	let catNow = 0;
	for (let p = 0; p < namedMatch.length; p++) if (tasksCatHas(cat, p)) catNow += namedMatch[p];
	// the quota the goal needs is stable while the objective stands, unlike the split the solver
	// reties every think: matching balls still to enter, and spare others that may leave
	botPlan.needCat = botPlanOut.match - catNow;
	botPlan.spareOther = (named - catNow) - (botPlanOut.side - botPlanOut.match);
	botPlan.cost = botPlan.needCat + botPlan.spareOther;
	if (botPlan.cost < 0) botPlan.cost = 0;
	botPlan.active = true;
	return true;
}

// ---- predicted crossings

// Seconds until this ball can meet the divider. A ball heading for it reaches the centre line
// directly; one heading for its outer wall has to cover all of that chamber first. The distribution
// counts a ball by which side its centre is on, so the centre line is the crossing.
function botCrossTime(i) {
	const vx = simBalls.vx[i];
	const speed = Math.abs(vx);
	if (speed < 1) return -1;
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
function botPredict(cat, isLeft) {
	const yMin = simAperture.size / 2;
	const yMax = simField.h - yMin;
	let n = 0;
	for (let i = 0; i < simBalls.count; i++) {
		const t0 = botCrossTime(i);
		if (t0 < 0) continue;
		const r = simBalls.r[i];
		const speed = Math.abs(simBalls.vx[i]);
		const left = (simField.wallX - r) * 2 / speed;
		const right = (simField.w - simField.wallX - r) * 2 / speed;
		const cat0 = tasksCatHas(cat, simBalls.palette[i]) ? 1 : 0;
		// the next crossing always goes to the opposite chamber — a ball moving away from the divider
		// turns around first — so the side it is on sets the direction, not its velocity sign
		let dir = simBalls.x[i] < simField.wallX ? 1 : -1;
		let t = t0;
		let since = 0;
		for (let k = 0; k < BOT_CROSS_PASSES && t <= botTune.horizon; k++) {
			const y = botFoldY(simBalls.y[i], simBalls.vy[i], since, r);
			botScratch.t[n] = t;
			botScratch.y[n] = y < yMin ? yMin : (y > yMax ? yMax : y);
			botScratch.cat[n] = cat0;
			botScratch.dir[n] = dir;
			n++;
			since = t;
			t += dir > 0 ? right : left;
			dir = -dir;
		}
	}
	botScratch.n = n;
	botScratch.isLeft = isLeft === true;
	return n;
}

// Crossing ledger for one height: a matching ball entering the named chamber or a non-matching one
// leaving it moves the split toward the plan; the mirror moves it away. A far crossing is worth less
// than a near one, so the hole opens for the ball it can take now instead of a lane whose traffic is
// only predicted.
function botLaneScore(n, yc) {
	const half = simAperture.size / 2;
	let net = 0;
	for (let j = 0; j < n; j++) {
		const t = botScratch.t[j];
		if (t > botTune.horizon) continue;
		if (Math.abs(botScratch.y[j] - yc) > half) continue;
		// one crossing moves one quota: a matching ball entering fills needCat, another leaving
		// spends two, and a non-matching ball leaving frees a slot only while spareOther lasts
		const useful = botCrossUseful(j);
		net += (botPlan.defend ? (useful ? -1 : 0) : (useful ? 1 : -1)) / (1 + t / botTune.decay);
	}
	return net * botTune.cross - Math.abs(yc - simAperture.y) / simAperture.speed;
}

// A crossing is progress while the quota holds: a matching ball entering the named chamber fills the
// quota, a non-matching ball leaving frees a slot. Once the chamber holds its quota of either, the
// same crossing is one the objective loses.
function botCrossUseful(j) {
	const entering = (botScratch.dir[j] < 0) === botScratch.isLeft;
	if (botScratch.cat[j]) return entering && botPlan.needCat > 0;
	return !entering && botPlan.spareOther > 0;
}

// A lane already held is worth keeping unless it lets a harmful crossing through: staying costs no
// energy, so any safe lane beats a drive to a marginally better one.
function botLaneSafe(n, yc) {
	const half = simAperture.size / 2;
	for (let j = 0; j < n; j++) {
		if (botScratch.t[j] > botTune.horizon) continue;
		if (Math.abs(botScratch.y[j] - yc) > half) continue;
		if (botPlan.defend) {
			if (botCrossUseful(j)) return false;
			continue;
		}
		if (!botCrossUseful(j)) return false;
	}
	return true;
}

// The hole parks at the height whose crossings move the chamber toward the split the plan needs. A
// lane with no net progress raises no request, so the hole never opens while the traffic is against it.
function botAim(id) {
	const prevY = botState.aimed[id] ? botState.targetY[id] : -1;
	botState.aimed[id] = 0;
	if (!botPlanOpen(id)) return false;
	const n = botPredict(tasksCatFromName(tasksView[id].category), tasksView[id].side === 'left');
	if (!n) return false;
	let best = 0;
	let bestY = 0;
	for (let k = 0; k < n; k++) {
		const yc = botScratch.y[k];
		const score = botLaneScore(n, yc);
		if (score <= best) continue;
		best = score;
		bestY = yc;
	}
	// staying in a safe lane is free and a drive is not: keep the parked lane unless another lane
	// is clearly better or the parked one is about to lose the split
	if (prevY >= 0 && botLaneSafe(n, prevY) && Math.abs(prevY - simAperture.y) <= botDeadZone()) {
		botState.targetY[id] = prevY;
		botState.aimed[id] = 1;
		return true;
	}
	if (prevY >= 0) {
		const held = botLaneScore(n, prevY) + botTune.switchLane;
		if (held >= best && held > 0) {
			bestY = prevY;
			best = held;
		}
	}
	if (best <= 0) return false;
	botState.targetY[id] = bestY;
	botState.aimed[id] = 1;
	return true;
}

function botAct(id, priority = -1) {
	const view = forceView(id, botForceView);
	const share = view.capacity > 0 ? view.energy / view.capacity : 0;
	if (botState.rest[id]) {
		if (share >= botTune.resume) botState.rest[id] = 0;
	} else if (share <= botTune.rest) {
		botState.rest[id] = 1;
	}
	if (botState.rest[id] || !botState.aimed[id] || (priority >= 0 && priority !== id)) {
		forceClear(id);
		return;
	}
	const delta = botState.targetY[id] - simAperture.y;
	// the half-step dead zone a held pointer uses, so the hole does not buzz at its target
	const dead = botDeadZone();
	if (delta > -dead && delta < dead) {
		forceClear(id);
		return;
	}
	forceSetMagnitude(id, botTune.mag);
	forceSetDirection(id, delta < 0 ? -1 : 1);
	forceHold(id, true);
}

if (typeof module !== 'undefined') module.exports = {
	botState,
	botPlan,
	botTune,
	botScratch,
	botInit,
	botSetTuning,
	botStep,
	botThink,
	botAim,
	botAct,
	botContest,
	botLaneScore,
	botPredict,
	botPlanOpen,
	botCrossTime,
	botCrossUseful,
	botWantsHole,
	botFoldY,
	BOT_CONTEST_SEC,
	BOT_DWELL_SEC,
	BOT_THINK_SEC,
	BOT_AIM_HORIZON,
	BOT_CROSS_SEC,
	BOT_MAG,
	BOT_REST_SHARE,
	BOT_RESUME_SHARE
};
