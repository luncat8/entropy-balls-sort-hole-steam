// owns: the bots' aim, energy policy and fair use of a contested hole
// edit for: bot heuristics, aim horizon, rest thresholds, contest turns

const BOT_THINK_SEC = 0.2;
const BOT_AIM_HORIZON = 2.5;
const BOT_MAG = 0.8;
// a store drained to nothing then trickled reads as a dead bot: it rests low and resumes high
const BOT_REST_SHARE = 0.15;
const BOT_RESUME_SHARE = 0.55;
// a predicted crossing is worth this many seconds of hole travel: one in the right direction pays
// for one in the wrong direction, and the hole still prefers a near lane to a far one
const BOT_CROSS_SEC = 0.8;
// keeping a lane costs no travel, so a rival lane has to beat it by this much to make the hole move
const BOT_SWITCH_SEC = 0.8;
// Equal opposite requests cancel forever; alternate the right to drive instead of burning both stores.
const BOT_CONTEST_SEC = 2;

const botState = {
	clock: 0,
	think: new Float32Array(PLAYER_CAP),
	rest: new Uint8Array(PLAYER_CAP),
	aimed: new Uint8Array(PLAYER_CAP),
	targetY: new Float32Array(PLAYER_CAP)
};
const botForceView = { energy: 0, capacity: 1 };
const botScratch = {
	t: new Float32Array(BALL_CAP),
	y: new Float32Array(BALL_CAP),
	harm: new Uint8Array(BALL_CAP),
	net: 0
};

function botInit() {
	botState.clock = 0;
	botState.think.fill(0);
	botState.rest.fill(0);
	botState.aimed.fill(0);
	botState.targetY.fill(0);
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

// Only an actual opposition yields; aligned requests still combine, and a resting bot reserves no turn.
function botContest() {
	let first = -1;
	let direction = 0;
	const dead = botDeadZone();
	for (let id = 0; id < players.count; id++) {
		if (players.type[id] !== PLAYER_BOT || !botState.aimed[id] || botState.rest[id]) continue;
		const delta = botState.targetY[id] - simAperture.y;
		if (Math.abs(delta) <= dead) continue;
		const dir = delta < 0 ? -1 : 1;
		if (first < 0) {
			first = id;
			direction = dir;
		} else if (dir !== direction) {
			return ((botState.clock / BOT_CONTEST_SEC) | 0) & 1 ? id : first;
		}
	}
	return -1;
}

function botThink(id, dt) {
	botState.think[id] -= dt;
	if (botState.think[id] > 0) return;
	botState.think[id] = BOT_THINK_SEC;
	botAim(id);
}

// Seconds until this ball can meet the divider: one flying away has to bounce off the outer wall first.
function botCrossTime(i, isLeft) {
	const vx = simBalls.vx[i];
	const speed = Math.abs(vx);
	if (speed < 1) return -1;
	const r = simBalls.r[i];
	const faceX = simField.wallX - simField.wallT / 2;
	if (isLeft ? vx < 0 : vx > 0) return (Math.abs(simBalls.x[i] - faceX) - r) / speed;
	const away = isLeft ? simField.w - r : r;
	return (Math.abs(away - simBalls.x[i]) + Math.abs(away - faceX)) / speed;
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

// A ball sitting on the side where it counts is one the objective can lose: it helps while it
// stays, so its crossing works against the objective.
function botCrossHarm(i, id, isLeft) {
	const x = simBalls.x[i];
	const onTarget = isLeft ? x < simField.wallX : x > simField.wallX;
	const matches = tasksCatHas(tasksCat[id], simBalls.palette[i]) === 1;
	const counted = matches === onTarget;
	return tasksCmp[id] === 0 ? counted : !counted;
}

function botPredict(id, isLeft) {
	const yMin = simAperture.size / 2;
	const yMax = simField.h - yMin;
	let n = 0;
	for (let i = 0; i < simBalls.count; i++) {
		const t = botCrossTime(i, isLeft);
		if (t < 0) continue;
		const y = botFoldY(simBalls.y[i], simBalls.vy[i], t, simBalls.r[i]);
		botScratch.t[n] = t;
		botScratch.y[n] = y < yMin ? yMin : (y > yMax ? yMax : y);
		botScratch.harm[n] = botCrossHarm(i, id, isLeft) ? 1 : 0;
		n++;
	}
	return n;
}

// how many crossings this height would let through, counted as helpful minus wrong-way ones
function botLaneScore(n, yc) {
	let net = 0;
	for (let j = 0; j < n; j++) {
		if (botScratch.t[j] > BOT_AIM_HORIZON) continue;
		if (Math.abs(botScratch.y[j] - yc) > simAperture.size / 2) continue;
		net += botScratch.harm[j] ? -1 : 1;
	}
	botScratch.net = net;
	return net * BOT_CROSS_SEC - Math.abs(yc - simAperture.y) / simAperture.speed;
}

// The hole parks where the next crossings help the objective most: each predicted crossing inside
// one aperture is worth a ball, a wrong-way one costs a ball, and the drive there costs time.
function botAim(id) {
	const prevY = botState.aimed[id] ? botState.targetY[id] : -1;
	botState.aimed[id] = 0;
	if (!tasksOn[id]) return false;
	const v = tasksView[id];
	if (v.waiting || v.satisfied) return false;
	const n = botPredict(id, v.side === 'left');
	if (!n) return false;
	let best = -Infinity;
	let bestY = 0;
	for (let k = 0; k < n; k++) {
		const yc = botScratch.y[k];
		const score = botLaneScore(n, yc);
		// a lane that loses as many balls as it passes is no better than a closed hole
		if (botScratch.net < 1 || score <= best) continue;
		best = score;
		bestY = yc;
	}
	if (best === -Infinity) return false;
	if (prevY >= 0 && botLaneScore(n, prevY) + BOT_SWITCH_SEC >= best && botScratch.net > 0) bestY = prevY;
	botState.targetY[id] = bestY;
	botState.aimed[id] = 1;
	return true;
}

function botAct(id, priority = -1) {
	const view = forceView(id, botForceView);
	const share = view.capacity > 0 ? view.energy / view.capacity : 0;
	if (botState.rest[id]) {
		if (share >= BOT_RESUME_SHARE) botState.rest[id] = 0;
	} else if (share <= BOT_REST_SHARE) botState.rest[id] = 1;
	if (botState.rest[id] || !botState.aimed[id] || priority >= 0 && priority !== id) {
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
	forceSetMagnitude(id, BOT_MAG);
	forceSetDirection(id, delta < 0 ? -1 : 1);
	forceHold(id, true);
}

if (typeof module !== 'undefined') module.exports = {
	botState,
	botInit,
	botStep,
	botThink,
	botAim,
	botAct,
	botContest,
	BOT_CONTEST_SEC,
	BOT_THINK_SEC,
	BOT_AIM_HORIZON,
	BOT_MAG,
	BOT_REST_SHARE,
	BOT_RESUME_SHARE
};
