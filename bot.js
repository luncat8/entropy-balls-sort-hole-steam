// owns: bot characters, lane aim, energy rests and fair use of a contested hole
// edit for: characters and their weights, aim horizon, rest thresholds, contest turns

const BOT_THINK_SEC = 0.2;
// A crossing further out than BOT_DECAY_SEC is worth less than one arriving now, so the hole opens
// for the ball it can take instead of waiting on a lane whose traffic is only predicted.
// A crossing has to be worth more than the drive to it, or every possible lane scores below zero
// and the bot stands still: BOT_CROSS_SEC is how many seconds of hole travel one crossing buys. It is
// measured, not reasoned: keeping the plan's one second left most lanes negative at BOT_MAG 0.8.
const BOT_AIM_HORIZON = 2.5;
const BOT_DECAY_SEC = 1.5;
const BOT_CROSS_SEC = 3.2;
const BOT_SWITCH_SEC = 0.3;
// A crossing that loses ground costs more than a crossing that gains it: progress can be made again
// later, while a lost crossing also burns the travel that was spent arriving.
const BOT_HARM = 1.6;
const BOT_MAG = 0.8;
// a store drained to nothing then trickled reads as a dead bot: it rests low and resumes high
const BOT_REST_SHARE = 0.15;
const BOT_RESUME_SHARE = 0.55;
// Equal opposite requests cancel forever, so one bot owns the hole at a time. A turn has to outlast
// the drive it asks for: with a flat two-second turn two bots reversed each other on most thinks and
// neither objective advanced, because a turn barely covered the travel. A turn therefore ends only
// when the owner parks or a rival outbids it — a fixed cap never survived the lapse between them.
// a rival plan has to be worth this much more than the sitting owner's before the turn is taken
const BOT_PREEMPT = 2;
// how far the wait pass looks for the objective's next ball when nothing pays inside the horizon
const BOT_WAIT_SEC = 10;
// one place for the numbers a measurement may sweep; the policy reads them through botTune
const botTune = {
	horizon: BOT_AIM_HORIZON,
	decay: BOT_DECAY_SEC,
	cross: BOT_CROSS_SEC,
	switchLane: BOT_SWITCH_SEC,
	harm: BOT_HARM,
	mag: BOT_MAG,
	think: BOT_THINK_SEC,
	rest: BOT_REST_SHARE,
	resume: BOT_RESUME_SHARE,
	// scale on the characters' denial weight: a measurement needs to sweep how much of its own
	// progress a denier will trade for the opponent's, without editing the character table
	rival: 1
};

// A lane is worth what its crossings do to a score, and the character decides whose score. A profit
// bot plays only for its own completions, which is the tuned policy. A denier also charges the lane for
// the crossings the opponent would gain from — `rival` is that cost — so it gives up a crossing of its
// own to close one of theirs. Not spite: the crossings that cost the opponent are not sought, because
// the lane that hurts the opponent's plan usually hurts the bot's own (measured, plan 2.6). A slot
// draws its character when it becomes a bot and keeps it while it stays one.
const BOT_CHARS = [
	{ id: 'profit', name: 'Profit', icon: '💰', hint: 'Plays for its own completions', rival: 0 },
	{ id: 'denier', name: 'Denier', icon: '🚫', hint: 'Closes the crossings the opponent needs', rival: -0.75 }
];
const BOT_CHAR_PROFIT = 0;
const BOT_CHAR_DENIER = 1;
// -1 is "not drawn yet": a slot that stops being a bot drops its character and draws a new one later
const botChar = new Int8Array(PLAYER_CAP).fill(-1);
const botWeight = { rival: 0 };

let botRand = Math.random;

const botState = {
	think: new Float32Array(PLAYER_CAP),
	rest: new Uint8Array(PLAYER_CAP),
	aimed: new Uint8Array(PLAYER_CAP),
	targetY: new Float32Array(PLAYER_CAP),
	// the lane score the aim chose: what a contested hole is allocated by
	gain: new Float32Array(PLAYER_CAP),
	owner: -1
};
const botForceView = { energy: 0, capacity: 1 };

function botInit() {
	botState.think.fill(0);
	botState.rest.fill(0);
	botState.aimed.fill(0);
	botState.targetY.fill(0);
	botState.gain.fill(0);
	botState.owner = -1;
	botRivalPlan.active = false;
	botRollChars();
}

// A slot draws its character once per bot role, so a settings change or a new round does not reshuffle
// the match under the player while the same bot stays in the slot.
function botRollChars() {
	for (let id = 0; id < PLAYER_CAP; id++) {
		if (players.type[id] !== PLAYER_BOT) botChar[id] = -1;
		else if (botChar[id] < 0) botChar[id] = (botRand() * BOT_CHARS.length) | 0;
	}
}

function botSetRand(fn) {
	botRand = fn;
}

function botCharSet(id, char) {
	if (id < 0 || id >= PLAYER_CAP) return;
	botChar[id] = char >= 0 && char < BOT_CHARS.length ? char : -1;
}

function botCharOf(id) {
	return id >= 0 && id < PLAYER_CAP ? BOT_CHARS[botChar[id]] || null : null;
}

// the lane score reads the denial weight through one scratch, set once per think
function botWeightSet(id) {
	const char = botCharOf(id) || BOT_CHARS[BOT_CHAR_PROFIT];
	botWeight.rival = char.rival * botTune.rival;
}

function botSetTuning(values) {
	for (const key in values) {
		if (!(key in botTune) || !Number.isFinite(values[key])) continue;
		botTune[key] = values[key];
	}
}

function botStep(dt) {
	for (let id = 0; id < players.count; id++) {
		if (players.type[id] === PLAYER_BOT) botThink(id, dt);
	}
	const priority = botContest();
	for (let id = 0; id < players.count; id++) {
		if (players.type[id] === PLAYER_BOT) botAct(id, priority);
	}
}

// One step of the drive the bot actually applies. A tighter zone can never be satisfied: the
// aperture overshoots its target by up to a whole step and reverses, so the hole buzzes instead of
// parking (measured 3793 velocity reversals per minute at the half-step zone).
function botDeadZone() {
	return simAperture.speed * botTune.mag * FIXED_DT + 0.01;
}

function botWantsHole(id) {
	if (players.type[id] !== PLAYER_BOT || !botState.aimed[id] || botState.rest[id]) return 0;
	const delta = botState.targetY[id] - simAperture.y;
	if (Math.abs(delta) <= botDeadZone()) return 0;
	return delta < 0 ? -1 : 1;
}

// an aim is a lane whether or not the hole is still driving to it: arriving must not end a turn
function botHoldsLane(id) {
	return players.type[id] === PLAYER_BOT && botState.aimed[id] === 1 && botState.rest[id] === 0;
}

// Two aims conflict when the opening cannot serve both at once: a gap the aperture can span is one
// lane, so only a wider gap needs a turn. Comparing targets rather than "does the hole still want to
// move" keeps the answer stable when the hole arrives — the old test read arrival as the end of the
// conflict and handed the hole back every step (measured 1993 turn ends and 3793 aperture reversals
// a minute).
function botContested() {
	if (players.count < 2) return false;
	if (!botHoldsLane(0) || !botHoldsLane(1)) return false;
	return botLanesApart() > simAperture.size - 2 * simBallRadius.max;
}

// Two aims that oppose each other cancel through forceDrive while both stores pay, so only one bot
// drives at a time. The turn goes to the plan with more crossings to gain and the owner keeps it
// until it has no lane left or a rival is worth BOT_PREEMPT times more.
//
// The turn must not be read off "does the owner still want to move": an arrival drops that to zero,
// the turn ended the same frame and the rival drove the hole straight back, so the two traded it
// every step (measured 1993 turn ends and 3793 aperture reversals a minute). A parked aim is still a
// lane, and the owner keeps it — a parked plan's gain is small, so a rival with real traffic outbids
// it within one think.
function botContest() {
	botJoinLanes();
	const owner = botState.owner;
	if (owner >= 0 && botHoldsLane(owner) && !botOutbid(owner)) return owner;
	if (!botContested()) return botRelease();
	const best = botBestWant(owner >= 0 && botHoldsLane(owner) ? owner : -1);
	if (best < 0) return botRelease();
	botState.owner = best;
	return best;
}

// An opening tall enough for both balls serves both aims at one position, so two lanes that fit
// inside it are one lane: the hole parks between them and neither plan loses. Half of all contested
// time was two targets a single aperture position already covered, which the turn had no answer for.
// Joining here rather than in the aim keeps it one rule per step: the aim is a per-bot think, and two
// thinks that each make a reasonable choice still produce one lane between them.
function botJoinLanes() {
	if (players.count < 2) return;
	if (!botHoldsLane(0) || !botHoldsLane(1)) return;
	const gap = botLanesApart();
	if (gap > simAperture.size - 2 * simBallRadius.max) return;
	const a = botLaneOf(0);
	const b = botLaneOf(1);
	if (a === 0 || b === 0) return;
	const mid = botClampLane((a + b) / 2);
	botState.targetY[0] = mid;
	botState.targetY[1] = mid;
}

// The lanes that actually need serving: a bot already on its lane is served by where the hole is,
// while a bot still driving needs its target. Reading targets alone made a parked owner and its
// rival look joined whenever the owner had arrived, and a rival could never take a parked lane.
function botLanesApart() {
	const a = botLaneOf(0);
	const b = botLaneOf(1);
	if (a === b) return 0;
	if (a === 0 || b === 0) return botState.targetY[0] === botState.targetY[1] ? 0 : 1e9;
	return Math.abs(a - b);
}

function botLaneOf(id) {
	if (!botHoldsLane(id)) return 0;
	return botWantsHole(id) ? botState.targetY[id] : simAperture.y;
}

// the moving bot with the most to gain; the sitting owner is not a candidate
function botBestWant(skip) {
	let best = -1;
	let bestGain = 0;
	for (let id = 0; id < players.count; id++) {
		if (id === skip || !botWantsHole(id)) continue;
		if (best >= 0 && botState.gain[id] <= bestGain) continue;
		best = id;
		bestGain = botState.gain[id];
	}
	return best;
}

// A rival whose plan is worth much more can take the hole early, so a dodge never holds it hostage.
// Any live lane can outbid, parked or moving: reading only "wants to move" let a parked owner keep a
// lane worth almost nothing against a rival with traffic, because arriving drops both to zero. A
// negative defensive score is floored at zero: multiplying it would let a worse plan outbid it.
function botOutbid(owner) {
	if (owner < 0) return false;
	for (let id = 0; id < players.count; id++) {
		if (id === owner || !botHoldsLane(id)) continue;
		const ownerGain = Math.max(0, botState.gain[owner]);
		if (botState.gain[id] > ownerGain * BOT_PREEMPT + 1e-6) return true;
	}
	return false;
}

function botRelease() {
	botState.owner = -1;
	return -1;
}

function botThink(id, dt) {
	botState.think[id] -= dt;
	if (botState.think[id] > 0) return;
	botState.think[id] = botTune.think;
	botAim(id);
}

// The hole parks at the lane whose crossings move the chamber toward the split the plan needs, and
// the lane it already holds is the baseline: a drive is not free, so another lane has to beat it by
// more than the switch bonus. That baseline is also the whole defence, because a satisfied objective
// scores every crossing at or below zero — the best lane is then the one that lets the fewest harmful
// balls through. Without it the hole stood still whenever nothing scored above zero, and leaked the
// one crossing that ended a hold.
function botAim(id) {
	const prevY = botState.aimed[id] ? botState.targetY[id] : -1;
	botState.aimed[id] = 0;
	botState.gain[id] = 0;
	botWeightSet(id);
	botRivalPlan.active = false;
	if (!botPlanOpen(id, botPlan)) return false;
	botRivalOpen(id);
	const n = botPredict();
	const here = botClampLane(prevY >= 0 ? prevY : simAperture.y);
	let best = n ? botLaneScore(n, here) + (prevY >= 0 ? botTune.switchLane : 0) : 0;
	let bestY = here;
	for (let k = 0; k < n; k++) {
		const yc = botClampLane(botScratch.y[k]);
		const score = botLaneScore(n, yc);
		if (score <= best) continue;
		best = score;
		bestY = yc;
	}
	// with nothing to drive for, only a lane that sheds traffic is worth the energy: the candidate
	// lanes are beside each predicted crossing, out of that ball's reach
	if (best <= 0) {
		const gap = simAperture.size / 2 + simPx(2);
		for (let k = 0; k < n; k++) {
			const off = gap + botScratch.r[k];
			for (let side = -1; side <= 1; side += 2) {
				const yc = botClampLane(botScratch.y[k] + side * off);
				const score = botLaneScore(n, yc);
				if (score <= best) continue;
				best = score;
				bestY = yc;
			}
		}
	}
	// If no traffic is imminent, wait for any helpful first crossing, including non-category balls.
	// Later passes assume earlier crossings happened, so they cannot justify an unattended wait.
	if (best <= 0 && botPlan.cost > 0 && (n === 0 || botPlan.needCat !== 0)) {
		const waitY = botWaitLane(botPredict(BOT_WAIT_SEC, 1));
		if (waitY >= 0) {
			botState.targetY[id] = waitY;
			botState.gain[id] = 0;
			botState.aimed[id] = 1;
			return true;
		}
	}
	if (best <= 0 && bestY === here) return false;
	botState.targetY[id] = bestY;
	botState.gain[id] = best;
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
	botRivalPlan,
	botTune,
	botScratch,
	botChar,
	botWeight,
	BOT_CHARS,
	BOT_CHAR_PROFIT,
	BOT_CHAR_DENIER,
	botCharOf,
	botCharSet,
	botRollChars,
	botWeightSet,
	botSetRand,
	botInit,
	botSetTuning,
	botStep,
	botThink,
	botAim,
	botAct,
	botContest,
	botLaneScore,
	botLaneTravel,
	botLaneHits,
	botLaneHalf,
	botPredict,
	botPlanOpen,
	botRivalOpen,
	botCrossTime,
	botCrossValue,
	botCrossValueRival,
	botCrossScore,
	botRivalScore,
	botWantsHole,
	botFoldY,
	BOT_PREEMPT,
	BOT_THINK_SEC,
	BOT_AIM_HORIZON,
	BOT_CROSS_SEC,
	BOT_HARM,
	BOT_MAG,
	BOT_REST_SHARE,
	BOT_RESUME_SHARE
};
