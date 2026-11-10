// owns: plan 0.6 smoke for the forecast tracer and the dashed cue it feeds
// edit for: new forecast-contract checks

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const traj = apis['trajectory.js'];
const cv = apis['canvas.js'];
const ctx2d = stubs.ctx2d;
const field = sim.simField, hole = sim.simAperture, balls = sim.simBalls;
const trace = traj.trajPath;
const R = 14;
const RGB = 0xabcdef;
const CSS = '#abcdef';

let pass = 0;
let fail = 0;

function check(name, ok) {
	if (ok) pass++;
	else {
		fail++;
		console.log('FAIL ' + name);
	}
}

function near(a, b, tol = 1e-2) {
	return Math.abs(a - b) <= tol;
}

// one ball, no contacts, no arrivals: the divider is the only thing that can happen to it
function world(holeY) {
	sim.simResizeField(1200, 800);
	sim.simInit();
	sim.simSetSpawnRate(0);
	sim.simSetBallCollisions(false);
	hole.y = holeY;
	cv.canvasDrawOptions.predictedPosition = true;
	cv.canvasDrawOptions.trajectoryLines = true;
	cv.canvasDrawOptions.slowFadeHitSpot = false;
	cv.impactMarks.age.fill(cv.IMPACT_TTL + 1);
}

function shoot(x, y, vx, vy) {
	balls.x[0] = x;
	balls.y[0] = y;
	balls.vx[0] = vx;
	balls.vy[0] = vy;
	balls.r[0] = R;
	balls.rgb[0] = RGB;
	balls.css[0] = CSS;
	balls.count = 1;
}

function traceBall(reach = Infinity) {
	return traj.trajTrace(balls.x[0], balls.y[0], balls.vx[0], balls.vy[0], R, reach, trace);
}

function pointIs(k, x, y) {
	return near(trace.x[k], x) && near(trace.y[k], y);
}

// what the stepped simulation does to the ball: only a plate turns a ball that flies at the divider
function simEnd() {
	const dir = Math.sign(balls.vx[0]);
	const side = Math.sign(balls.x[0] - field.wallX);
	for (let k = 0; k < 6000; k++) {
		sim.simStep(sim.FIXED_DT);
		if (Math.sign(balls.vx[0]) !== dir) return traj.TRAJ_HIT;
		if (Math.sign(balls.x[0] - field.wallX) !== side) return traj.TRAJ_PASS;
	}
	return traj.TRAJ_NONE;
}

function draw() {
	ctx2d.calls.length = 0;
	cv.canvasDraw(0);
}

function callsOf(method) {
	return ctx2d.calls.filter(call => call.method === method);
}

// the arguments of the last call of a method before the target call: the state the target was drawn in
function stateAt(target, method) {
	let args = null;
	for (const call of ctx2d.calls) {
		if (call === target) break;
		if (call.method === method) args = call.args;
	}
	return args;
}

function fieldFrame(call) {
	const dpr = cv.canvasView.dpr;
	return stateAt(call, 'setTransform').join() === [dpr, 0, 0, dpr, 0, 0].join();
}

function patchCalls() {
	return callsOf('fillRect').filter(call => call.fillStyle === CSS);
}

// every stroke is drawn in a frame of its own: this reads its two ends back in field units
function legs() {
	const dpr = cv.canvasView.dpr;
	const out = [];
	let m = null;
	let points = [];
	for (const call of ctx2d.calls) {
		if (call.method === 'setTransform') m = call.args;
		if (call.method === 'beginPath') points = [];
		if (call.method === 'moveTo' || call.method === 'lineTo') points.push(call.args);
		if (call.method !== 'stroke') continue;
		const a = points[0], b = points[points.length - 1];
		out.push({
			x0: (m[0] * a[0] + m[2] * a[1] + m[4]) / dpr, y0: (m[1] * a[0] + m[3] * a[1] + m[5]) / dpr,
			x1: (m[0] * b[0] + m[2] * b[1] + m[4]) / dpr, y1: (m[1] * b[0] + m[3] * b[1] + m[5]) / dpr,
			frame: m, points, offset: call.lineDashOffset
		});
	}
	return out;
}

// the one dashed shape Chromium's GPU canvas dashes in a shader: two points, level, in a frame that is
// only turned and scaled
function levelLeg(leg) {
	const m = leg.frame, p = leg.points;
	return p.length === 2 && p[0][0] === 0 && p[0][1] === 0 && p[1][0] > 0 && p[1][1] === 0
		&& near(Math.hypot(m[0], m[1]), cv.canvasView.dpr, 1e-6) && m[2] === -m[1] && m[3] === m[0];
}

world(100);
shoot(300, 400, 200, 0);
check('trace: a straight hit is two points ending one radius before the centre line',
	traceBall() === traj.TRAJ_HIT && trace.n === 2 && pointIs(0, 300, 400) && pointIs(1, field.wallX - R, 400)
	&& near(trace.dist, 286) && trace.side === -1 && trace.end === traj.TRAJ_HIT);
shoot(900, 400, -200, 0);
check('trace: the right chamber mirrors the left',
	traceBall() === traj.TRAJ_HIT && pointIs(1, field.wallX + R, 400) && near(trace.dist, 286) && trace.side === 1);

world(600);
shoot(200, 100, 150, -150);
check('trace: a screen-edge bounce is a vertex one radius off the edge',
	traceBall() === traj.TRAJ_HIT && trace.n === 3 && pointIs(1, 286, R) && pointIs(2, field.wallX - R, 314)
	&& near(trace.dist, 386 * Math.SQRT2));
check('trace: the simulation turns that ball back too', simEnd() === traj.TRAJ_HIT);

world(400);
shoot(300, 400, 200, 0);
check('trace: a pass runs until the body has cleared the divider',
	traceBall() === traj.TRAJ_PASS && trace.n === 2 && pointIs(1, field.wallX + R, 400) && near(trace.dist, 286));
check('trace: the simulation lets that ball through too', simEnd() === traj.TRAJ_PASS);

// enters inside the opening, then drifts onto the lower lip before the centre line
world(400);
shoot(704, 120, -60, 200);
check('trace: a lip clip is a hit that ends inside the divider, where the body leaves the opening',
	traceBall() === traj.TRAJ_HIT && trace.x[trace.n - 1] > field.wallX && trace.x[trace.n - 1] < field.wallX + R - 1
	&& near(trace.y[trace.n - 1], hole.y + hole.size / 2 - R) && near(trace.dist, Math.hypot(90, 300)));
check('trace: the simulation turns the lip clip back too', simEnd() === traj.TRAJ_HIT);

world(100);
shoot(300, 400, -200, 0);
const awayEnd = traceBall();
shoot(300, 400, 0, 200);
const alongEnd = traceBall();
shoot(590, 400, 200, 0);
const touchingEnd = traceBall();
shoot(300, 400, 200, 0);
check('trace: no forecast flying away, along the divider, while touching it, or past the reach',
	awayEnd === traj.TRAJ_NONE && alongEnd === traj.TRAJ_NONE && touchingEnd === traj.TRAJ_NONE
	&& traceBall(285) === traj.TRAJ_NONE && traceBall(287) === traj.TRAJ_HIT);

// an opening parked on the bottom edge is a gate: the ball bounces on the screen edge inside it
world(400);
hole.y = field.h - hole.size / 2;
shoot(510, 706, 150, 150);
check('trace: a gate on a screen edge bounces the ball through instead of clipping a lip',
	traceBall() === traj.TRAJ_PASS && trace.n === 3 && pointIs(1, 590, field.h - R) && pointIs(2, field.wallX + R, 762));
check('trace: the simulation passes the gate too', simEnd() === traj.TRAJ_PASS);

// a ball lying on a screen edge holds a float32 height, which an exact fit test rejects on the bottom edge
let rolled = 0;
for (let k = 0; k < 40; k++) {
	world(400);
	const bottom = k % 2 === 1;
	hole.y = bottom ? field.h - hole.size / 2 : hole.size / 2;
	shoot(300, 0, 200, 0);
	balls.r[0] = 9 + k * 0.237;
	balls.y[0] = bottom ? field.h - balls.r[0] : balls.r[0];
	const end = traj.trajTrace(balls.x[0], balls.y[0], balls.vx[0], balls.vy[0], balls.r[0], Infinity, trace);
	if (end === traj.TRAJ_PASS && simEnd() === traj.TRAJ_PASS) rolled++;
}
check('trace: a ball rolling along a screen edge passes a gate parked there, whatever its radius', rolled === 40);

let seed = 7;
function rnd() {
	seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
	return seed / 4294967296;
}
let traced = 0, same = 0;
for (let k = 0; k < 400; k++) {
	world(400);
	const half = hole.size / 2;
	const park = rnd();
	hole.y = park < 0.2 ? half : park < 0.4 ? field.h - half : half + rnd() * (field.h - 2 * half);
	const ang = rnd() * Math.PI * 2;
	const speed = sim.simPx(120 + rnd() * 120);
	shoot(R + rnd() * (field.w - 2 * R), R + rnd() * (field.h - 2 * R), Math.cos(ang) * speed, Math.sin(ang) * speed);
	const end = traceBall();
	if (end === traj.TRAJ_NONE) continue;
	traced++;
	if (simEnd() === end) same++;
}
check('trace: random shots end the way the stepped simulation ends them', traced > 150 && same >= traced - 2);

world(100);
shoot(300, 400, 200, 0);
draw();
const stroke = callsOf('stroke')[0];
const reach = sim.simPx(cv.FORECAST_REACH_SHARE);
const span = cv.FORECAST_DASH[0] + cv.FORECAST_DASH[1];
check('cue: the forecast is one dashed stroke in the ball colour',
	callsOf('stroke').length === 1 && stateAt(stroke, 'setLineDash')[0] === cv.FORECAST_DASH && stroke.strokeStyle === CSS);
check('cue: the frame hands back a solid line style', callsOf('setLineDash').pop().args[0].length === 0);
check('cue: a whole dash ends where the ball first touches the divider',
	near((286 + stroke.lineDashOffset) % span, cv.FORECAST_DASH[0], 1e-6));
check('cue: opacity is the share of the reach still ahead',
	near(stroke.globalAlpha, cv.FORECAST_ALPHA * (1 - 286 / reach), 1e-6)
	&& patchCalls().length === 1 && patchCalls()[0].globalAlpha === stroke.globalAlpha);
balls.x[0] = 305;
draw();
const later = callsOf('stroke')[0];
check('cue: dashes stand still, the pattern shifts by exactly the distance flown',
	near((later.lineDashOffset - stroke.lineDashOffset + span) % span, 5, 1e-6));
check('cue: a nearer ball draws a brighter cue', later.globalAlpha > stroke.globalAlpha);

world(100);
shoot(100, 100, 150, 150);
draw();
const farStrokes = callsOf('stroke').length + patchCalls().length;
shoot(110, 110, 150, 150);
draw();
check('cue: a flight longer than the reach draws nothing, a shorter one fades in',
	farStrokes === 0 && callsOf('stroke').length === 1 && callsOf('stroke')[0].globalAlpha < 0.05);

world(600);
shoot(200, 100, 150, -150);
draw();
const bounce = legs();
check('cue: the line follows the bounce, one stroke per leg',
	bounce.length === 2 && near(bounce[0].x0, 200) && near(bounce[0].y0, 100) && near(bounce[0].x1, 286) && near(bounce[0].y1, R)
	&& near(bounce[1].x0, 286) && near(bounce[1].y0, R) && near(bounce[1].x1, field.wallX - R) && near(bounce[1].y1, 314));
check('cue: past a bounce the dashes are still counted from the first touch of the divider',
	near((300 * Math.SQRT2 + bounce[1].offset) % span, cv.FORECAST_DASH[0], 1e-3));
check('cue: a leg is a level two-point line in a frame turned along it', bounce.every(levelLeg));

// two balls: the second one's plate mark is filled after the first one's line was stroked
world(100);
shoot(300, 400, 200, 0);
balls.x[1] = 900;
balls.y[1] = 500;
balls.vx[1] = -200;
balls.vy[1] = 60;
balls.r[1] = R;
balls.css[1] = CSS;
balls.count = 2;
draw();
check('cue: the field frame is back for whatever is drawn after a line',
	legs().length === 2 && patchCalls().length === 2 && callsOf('arc').length === 2
	&& patchCalls().every(fieldFrame) && callsOf('arc').every(fieldFrame));

world(100);
shoot(300, 400, 200, 0);
cv.canvasView.dpr = 2;
draw();
const dense = legs();
check('cue: on a dense screen the leg frame carries the pixel ratio, so the line stays on its ball',
	dense.length === 1 && levelLeg(dense[0]) && near(dense[0].frame[4], 600) && near(dense[0].frame[5], 800)
	&& near(dense[0].x1, field.wallX - R) && fieldFrame(callsOf('arc')[0]));
cv.canvasView.dpr = 1;

world(400);
shoot(300, 400, 200, 0);
draw();
check('cue: a pass is a line through the opening with no mark on the plate',
	legs().length === 1 && near(legs()[0].x1, field.wallX + R) && patchCalls().length === 0);

function tipIs(call, y) {
	return near(call.args[0], field.wallX - field.wallT / 2) && near(call.args[1], y)
		&& near(call.args[2], field.wallT) && near(call.args[3], field.wallT);
}
world(400);
shoot(704, 120, -60, 200);
draw();
const lowerTip = patchCalls();
shoot(704, 680, -60, -200);
draw();
check('cue: a lip clip lights the tip of the lip it hits',
	lowerTip.length === 1 && tipIs(lowerTip[0], hole.y + hole.size / 2)
	&& patchCalls().length === 1 && tipIs(patchCalls()[0], hole.y - hole.size / 2 - field.wallT));
cv.canvasDrawOptions.slowFadeHitSpot = true;
shoot(704, 120, -60, 200);
simEnd();
balls.count = 0;
draw();
check('cue: the impact mark of a lip clip lights the same tip',
	patchCalls().length === 1 && tipIs(patchCalls()[0], hole.y + hole.size / 2));

// last: the smoke has no way to hand the real goal hook back
const still = { count: 0 };
cv.canvasSetGoalHook(() => still);
world(100);
shoot(300, 400, 200, 0);
draw();
check('cue: a held goal view is a still frame and shows no forecast',
	callsOf('stroke').length === 0 && patchCalls().length === 0);

console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
