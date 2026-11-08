// owns: the bots' plan, lane aim, energy rests and fair use of a contested hole
// edit for: bot heuristics, aim horizon, rest thresholds, contest turns

const BOT_THINK_SEC = 0.2;
// A crossing further out than BOT_DECAY_SEC is worth less than one arriving now, so the hole opens
// for the ball it can take instead of waiting on a lane whose traffic is only predicted.
// A crossing has to be worth more than the drive to it, or every possible lane scores below zero
// and the bot stands still: BOT_CROSS_SEC is how many seconds of hole travel one crossing buys. It is
// measured, not reasoned: keeping the plan's one second left most lanes negative at BOT_MAG 0.8.
const BOT_AIM_HORIZON = 4;
const BOT_DECAY_SEC = 1.5;
const BOT_CROSS_SEC = 3.2;
const BOT_SWITCH_SEC = 0.3;
const BOT_MAG = 0.8;
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
	r: new Float32Array(BALL_CAP),
	cat: new Uint8Array(BALL_CAP),
	dir: new Int8Array(BALL_CAP),
	n: 0
};
const botPlanOut = { side: 0, match: 0 };
// needCat and spareOther are the two signed changes the split the difficulty priced still needs in the
// named chamber: matching balls to add (or to leave, when negative) and the same for the other balls.
// Their magnitudes are the crossings still to make, and their signs say which crossing makes one.
const botPlan = { active: false, defend: false, cmp: 0, needCat: 0, spareOther: 0, cost: 0 };

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
	botPlan.cmp = v.cmp === '>' ? 0 : 1;
	const isLeft = v.side === 'left';
	const cat = tasksCatFromName(v.category);
	if (tasksCheapest(cat, botPlan.cmp, v.threshold, isLeft, botPlanOut) < 0) return false;
	const namedMatch = isLeft ? simDist.leftPalette : simDist.rightPalette;
	const named = isLeft ? simDist.left : simDist.right;
	let catNow = 0;
	for (let p = 0; p < namedMatch.length; p++) if (tasksCatHas(cat, p)) catNow += namedMatch[p];
	// the quota the goal needs is stable while the objective stands, unlike the split the solver
	// reties every think: matching balls still to enter, and spare others that may leave
	botPlan.needCat = botPlanOut.match - catNow;
	botPlan.spareOther = (named - catNow) - (botPlanOut.side - botPlanOut.match);
	botPlan.cost = Math.abs(botPlan.needCat) + Math.abs(botPlan.spareOther);
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
		// the height of a crossing is the vertical fold at that crossing's own time: reading the
		// current height instead aims the hole where the ball is now, one crossing behind
		for (let t = t0, k = 0; k < BOT_CROSS_PASSES && t <= botTune.horizon; k++) {
			const y = botFoldY(simBalls.y[i], simBalls.vy[i], t, r);
			botScratch.t[n] = t;
			botScratch.y[n] = y < yMin ? yMin : (y > yMax ? yMax : y);
			botScratch.r[n] = r;
			botScratch.cat[n] = cat0;
			botScratch.dir[n] = dir;
			n++;
			t += dir > 0 ? right : left;
			dir = -dir;
		}
	}
	botScratch.n = n;
	botScratch.isLeft = isLeft === true;
	return n;
}

// The opening only takes a ball whose whole body fits, so the usable half-height is the aperture's
// half minus that ball's radius; counting the full half aims at lanes where the plate still blocks.
function botLaneHalf(j) {
	const half = simAperture.size / 2 - botScratch.r[j];
	return half > 0 ? half : 0;
}

function botLaneTravel(yc) {
	return Math.abs(yc - simAperture.y) / (simAperture.speed * botTune.mag);
}

// A crossing is catchable only if the ball fits the opening and arrives after the hole can be there:
// a ball that reaches the plate first bounces off it, so that lane never paid for the drive.
function botLaneHits(j, yc, travel) {
	return botScratch.t[j] >= travel && Math.abs(botScratch.y[j] - yc) <= botLaneHalf(j);
}

// Crossing ledger for one height, read from the moment the hole arrives: the discount starts there,
// because a crossing already gone by the time the hole gets there is not the lane's business.
function botLaneScore(n, yc) {
	const travel = botLaneTravel(yc);
	let net = 0;
	for (let j = 0; j < n; j++) {
		if (botScratch.t[j] > botTune.horizon || !botLaneHits(j, yc, travel)) continue;
		const value = 1 / (1 + (botScratch.t[j] - travel) / botTune.decay);
		net += botCrossUseful(j) ? value : -value;
	}
	return net * botTune.cross - travel;
}

// The hold's mirror of the same ledger: only the crossings that end the hold are counted, so a lane
// of harmless traffic scores zero and the cheapest safe lane wins.
function botLaneHarm(n, yc) {
	const travel = botLaneTravel(yc);
	let harm = 0;
	for (let j = 0; j < n; j++) {
		if (botScratch.t[j] > botTune.horizon || !botLaneHits(j, yc, travel)) continue;
		if (!botCrossHurts(j)) continue;
		harm += 1 / (1 + (botScratch.t[j] - travel) / botTune.decay);
	}
	return harm;
}

// The crossing that fills a quota, read from the quota's sign: a matching ball entering the named
// chamber fills a positive needCat, and one leaving it fills a negative one — "left hot < 40%" is
// reached by hot leaving the left. Testing only "entering && needCat > 0" scores the crossing a
// "less than" objective needs as the one it loses.
function botCrossUseful(j) {
	const entering = (botScratch.dir[j] < 0) === botScratch.isLeft;
	if (botScratch.cat[j]) return entering ? botPlan.needCat > 0 : botPlan.needCat < 0;
	return entering ? botPlan.spareOther < 0 : botPlan.spareOther > 0;
}

// A crossing that raises the named chamber's share: a matching ball entering, or another one leaving.
// A satisfied hold survives any crossing that only pushes the split further past its threshold.
function botCrossHurts(j) {
	const entering = (botScratch.dir[j] < 0) === botScratch.isLeft;
	const raises = botScratch.cat[j] ? entering : !entering;
	return botPlan.cmp > 0 ? raises : !raises;
}

// A lane already held is worth keeping unless it lets a harmful crossing through: staying costs no
// energy, so any safe lane beats a drive to a marginally better one.
function botLaneSafe(n, yc) {
	for (let j = 0; j < n; j++) {
		if (botScratch.t[j] > botTune.horizon) continue;
		if (Math.abs(botScratch.y[j] - yc) > botLaneHalf(j)) continue;
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
	if (botPlan.defend) return botAimHold(id, n);
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

// A satisfied hold only has to survive, so nothing scores above zero and the plain lane score would
// leave the hole wherever it stands. The lane it already holds is the baseline instead: another lane
// has to be safer by more than the drive costs.
function botAimHold(id, n) {
	const half = simAperture.size / 2;
	const here = simAperture.y < half ? half : (simAperture.y > simField.h - half ? simField.h - half : simAperture.y);
	let best = -botLaneHarm(n, here) * botTune.cross;
	let bestY = here;
	for (let k = 0; k < n; k++) {
		const yc = botScratch.y[k];
		const score = -botLaneHarm(n, yc) * botTune.cross - botLaneTravel(yc);
		if (score <= best) continue;
		best = score;
		bestY = yc;
	}
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
	botLaneHarm,
	botLaneTravel,
	botLaneHits,
	botLaneHalf,
	botPredict,
	botPlanOpen,
	botCrossTime,
	botCrossUseful,
	botCrossHurts,
	botAimHold,
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
