// owns: the goal view drawn while a quest item is held — the live balls rearranged to satisfy that quest
// edit for: which balls cross, goal seating, goal view copy

// the goal is the cheapest satisfying split tasks.js already prices: match category balls out of side
// balls in the named chamber. balls already there fill that quota first, so every ball that moves is a
// crossing the difficulty counted. the field freezes while held, so the plan cannot drift while read.
const GOAL_SEAT_PASSES = 6;

const goalField = { on: false, id: -1, active: false, moved: 0 };
const goalBalls = { count: 0, x: null, y: null, r: null, css: null, moved: null };
// read-only summary for the hold panel, so it states the same split the canvas draws
const goalSummary = { active: false, match: 0, side: 0, moved: 0 };
const goalPlan = { side: 0, match: 0 };
const goalWant = { cat: 0, other: 0 };
let goalInNamed = null;
let goalKeep = null;
let goalLabelEl = null;

// the ball cap belongs to the simulation, so the buffers are sized at boot rather than at definition
function goalInit() {
	goalInNamed = new Uint8Array(BALL_CAP);
	goalKeep = new Uint8Array(BALL_CAP);
	goalBalls.x = new Float32Array(BALL_CAP);
	goalBalls.y = new Float32Array(BALL_CAP);
	goalBalls.r = new Float32Array(BALL_CAP);
	goalBalls.moved = new Uint8Array(BALL_CAP);
	goalBalls.css = new Array(BALL_CAP);
	goalLabelEl = $('quest-goal');
	canvasSetGoalHook(goalBallsFor);
}

function goalHolding() {
	return goalField.on;
}

// the hold hook fires on every quest repaint, so opening is idempotent
function goalShow(id) {
	if (goalField.on && goalField.id === id) return;
	goalOpen(id);
}

function goalOpen(id) {
	if (!tasksOn[id]) return;
	goalField.on = true;
	goalField.id = id;
	goalBuild();
}

function goalClose() {
	if (!goalField.on) return;
	goalField.on = false;
	goalField.id = -1;
	goalField.active = false;
	goalBalls.count = 0;
	goalSummary.active = false;
	goalLabelEl.hidden = true;
}

// null hands the canvas back to the live field; that is also the honest fallback for a goal this
// population cannot reach, because the held field is frozen and still reads as the field
function goalBallsFor() {
	return goalField.active ? goalBalls : null;
}

function goalBuild() {
	const v = tasksView[goalField.id];
	goalField.active = false;
	goalSummary.active = false;
	goalBalls.count = 0;
	if (v.waiting) return goalSay('no feasible objective for this distribution yet');
	if (v.sideTotal === 0) return goalSay('an empty side cannot meet an objective');
	const cat = tasksCatFromName(v.category);
	const isLeft = v.side === 'left';
	if (tasksCheapest(cat, v.cmp === '>' ? 0 : 1, v.threshold, isLeft, goalPlan) < 0) {
		return goalSay('this field cannot satisfy the objective');
	}
	goalPlace(cat, isLeft);
	goalField.active = true;
	goalSummary.active = true;
	goalSummary.match = goalPlan.match;
	goalSummary.side = goalPlan.side;
	goalSummary.moved = goalField.moved;
	goalSay(goalText(v));
}

function goalPlace(cat, isLeft) {
	goalWant.cat = goalPlan.match;
	goalWant.other = goalPlan.side - goalPlan.match;
	for (let i = 0; i < simBalls.count; i++) {
		goalInNamed[i] = (simBalls.x[i] < simField.wallX) === isLeft ? 1 : 0;
		goalKeep[i] = 0;
	}
	// pass 1: balls already in the named chamber take their quota, keeping the field as it lies
	for (let i = 0; i < simBalls.count; i++) {
		if (goalInNamed[i]) goalTake(i, cat);
	}
	// pass 2: the remaining quota is filled by balls crossing the opening
	for (let i = 0; i < simBalls.count; i++) {
		if (!goalInNamed[i]) goalTake(i, cat);
	}
	goalWrite(isLeft);
}

// both passes drain the same quota so the named chamber ends with exactly match category balls
function goalTake(i, cat) {
	const isCat = tasksCatHas(cat, simBalls.palette[i]);
	if (isCat ? goalWant.cat === 0 : goalWant.other === 0) return;
	if (isCat) goalWant.cat--;
	else goalWant.other--;
	goalKeep[i] = 1;
}

function goalWrite(isLeft) {
	const wallX = simField.wallX;
	goalBalls.count = simBalls.count;
	goalField.moved = 0;
	for (let i = 0; i < simBalls.count; i++) {
		goalBalls.css[i] = simBalls.css[i];
		goalBalls.r[i] = simBalls.r[i];
		goalBalls.y[i] = simBalls.y[i];
		goalBalls.x[i] = simBalls.x[i];
		goalBalls.moved[i] = 0;
		if (goalKeep[i] === goalInNamed[i]) continue;
		goalBalls.x[i] = goalMirror(i, goalKeep[i] === 1 ? isLeft : !isLeft);
		goalBalls.moved[i] = 1;
		goalField.moved++;
	}
	goalSeparate();
}

// mirrored across the divider, so a paired crossing reads as two balls swapping places
function goalMirror(i, isLeft) {
	const r = simBalls.r[i];
	const lo = isLeft ? simField.wallT + r : simField.wallX + simField.wallT / 2 + r;
	const hi = isLeft ? simField.wallX - simField.wallT / 2 - r : simField.w - simField.wallT - r;
	const mirrored = simField.wallX * 2 - simBalls.x[i];
	return mirrored < lo ? lo : (mirrored > hi ? hi : mirrored);
}

// only the balls that crossed are pushed apart; a ball that stayed keeps its exact field spot, so the
// view reads as "these balls went over there" rather than a reshuffled board
function goalSeparate() {
	for (let pass = 0; pass < GOAL_SEAT_PASSES; pass++) {
		for (let i = 0; i < goalBalls.count; i++) {
			if (!goalBalls.moved[i]) continue;
			for (let j = 0; j < goalBalls.count; j++) if (j !== i) goalPush(i, j);
			goalClamp(i);
		}
	}
}

function goalPush(i, j) {
	let dx = goalBalls.x[i] - goalBalls.x[j];
	let dy = goalBalls.y[i] - goalBalls.y[j];
	const sum = goalBalls.r[i] + goalBalls.r[j];
	let d2 = dx * dx + dy * dy;
	if (d2 >= sum * sum) return;
	if (d2 < 1e-6) {
		dx = 1;
		dy = 0;
		d2 = 1;
	}
	const d = Math.sqrt(d2);
	const gap = sum - d;
	goalBalls.x[i] += dx / d * gap;
	goalBalls.y[i] += dy / d * gap;
}

function goalClamp(i) {
	const r = goalBalls.r[i];
	const padX = simField.wallT + r;
	const padY = r + 1;
	const wallX = simField.wallX;
	let x = goalBalls.x[i];
	if (x < wallX) {
		const lo = padX;
		const hi = wallX - simField.wallT / 2 - r;
		x = x < lo ? lo : (x > hi ? hi : x);
	} else {
		const lo = wallX + simField.wallT / 2 + r;
		const hi = simField.w - padX;
		x = x < lo ? lo : (x > hi ? hi : x);
	}
	goalBalls.x[i] = x;
	const y = goalBalls.y[i];
	if (y < padY) goalBalls.y[i] = padY;
	else if (y > simField.h - padY) goalBalls.y[i] = simField.h - padY;
}

function goalText(v) {
	let text = tasksSideArrow(v.side) + ' ' + v.cmp + v.threshold + '% ' + v.category;
	text += ' · goal ' + goalPlan.match + '/' + goalPlan.side;
	text += goalField.moved
		? ' · ' + goalField.moved + ' ball' + (goalField.moved === 1 ? '' : 's') + ' cross'
		: ' · already met';
	return text;
}

function goalSay(text) {
	goalLabelEl.textContent = text;
	goalLabelEl.hidden = false;
}

if (typeof module !== 'undefined') module.exports = {
	goalField,
	goalBalls,
	goalPlan,
	goalSummary,
	goalInit,
	goalOpen,
	goalShow,
	goalClose,
	goalHolding,
	goalBallsFor,
	goalBuild,
	goalText
};
