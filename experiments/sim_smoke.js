// owns: plan 0.1 smoke for physics, generation, and impacts
// edit for: new physics-contract checks

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const cv = apis['canvas.js'];
const col = apis['color.js'];
const ctx2d = stubs.ctx2d;

let pass = 0;
let fail = 0;

function check(name, ok) {
	if (ok) pass++;
	else {
		fail++;
		console.log('FAIL ' + name);
	}
}

function freshWorld() {
	sim.simInit();
	sim.simBalls.count = 0;
	sim.simAperture.y = 100;
	sim.simAperture.targetY = 100;
	sim.simSetBallCollisions(true);
	sim.simSetSpawnRate(0);
	cv.canvasDrawOptions.predictedPosition = true;
	cv.canvasDrawOptions.trajectoryLines = true;
	cv.canvasDrawOptions.slowFadeHitSpot = false;
	cv.impactMarks.age.fill(cv.IMPACT_TTL + 1);
}

function place(i, x, y, vx, vy, r, rgb) {
	sim.simBalls.x[i] = x;
	sim.simBalls.y[i] = y;
	sim.simBalls.vx[i] = vx;
	sim.simBalls.vy[i] = vy;
	sim.simBalls.r[i] = r;
	sim.simBalls.rgb[i] = rgb;
	sim.simBalls.palette[i] = 0;
	sim.simBalls.css[i] = '#000000';
	if (sim.simBalls.count <= i) sim.simBalls.count = i + 1;
}

function inBounds(i) {
	const b = sim.simBalls, f = sim.simField;
	const r = b.r[i];
	return b.x[i] >= r - 1e-3 && b.x[i] <= f.w - r + 1e-3
		&& b.y[i] >= r - 1e-3 && b.y[i] <= f.h - r + 1e-3;
}

function hasRectCall(x, y, w, h) {
	for (const call of ctx2d.calls) {
		if (call.method === 'fillRect' && call.args[0] === x && call.args[1] === y
			&& call.args[2] === w && call.args[3] === h) return true;
	}
	return false;
}

function countCalls(method) {
	let count = 0;
	for (const call of ctx2d.calls) if (call.method === method) count++;
	return count;
}

let warm = 0, cold = 0;
for (const entry of col.PALETTE) {
	if (col.colorIsWarm(entry[1])) warm++;
	if (col.colorIsCold(entry[1])) cold++;
}
check('palette: three warm and three cold hues', warm === 3 && cold === 3);
check('color: hsl packs 0xRRGGBB', col.colorHslToRgb(0, 1, 0.5) === 0xff0000 && col.colorCss(0xff0000) === '#ff0000');

const predictedControl = stubs.els['draw-predicted-position'];
const trajectoryControl = stubs.els['draw-trajectory-lines'];
const fadeControl = stubs.els['draw-slow-fade-hit-spot'];
check('visual cues: predicted position and lines on, hit fade off by default',
	cv.canvasDrawOptions.predictedPosition && cv.canvasDrawOptions.trajectoryLines
	&& !cv.canvasDrawOptions.slowFadeHitSpot
	&& predictedControl.checked && trajectoryControl.checked && !fadeControl.checked);
predictedControl.checked = false;
predictedControl.dispatch('change');
check('visual cue option: predicted position toggles independently', !cv.canvasDrawOptions.predictedPosition);
predictedControl.checked = true;
predictedControl.dispatch('change');
trajectoryControl.checked = false;
trajectoryControl.dispatch('change');
check('visual cue option: trajectory lines toggle independently', !cv.canvasDrawOptions.trajectoryLines);
trajectoryControl.checked = true;
trajectoryControl.dispatch('change');
fadeControl.checked = true;
fadeControl.dispatch('change');
check('visual cue option: hit fade is user-selectable', cv.canvasDrawOptions.slowFadeHitSpot);
fadeControl.checked = false;
fadeControl.dispatch('change');

freshWorld();
place(0, 580, 400, 300, 0, 14, 0x112233);
const disabledMarkWrite = cv.impactMarks.write;
for (let k = 0; k < 20; k++) sim.simStep(1 / 120);
check('hit spot: disabled by default without affecting collision',
	sim.simBalls.vx[0] < 0 && cv.impactMarks.write === disabledMarkWrite);

freshWorld();
place(0, 800, 400, 300, 0, 14, 0x112233);
let wallBounced = false, wallSafe = true;
for (let k = 0; k < 240; k++) {
	const prevVx = sim.simBalls.vx[0];
	sim.simStep(1 / 120);
	if (sim.simBalls.vx[0] !== prevVx) wallBounced = true;
	if (!inBounds(0)) wallSafe = false;
}
check('wall reflection: ball stays in field', wallSafe);
check('wall reflection: right wall flips vx', wallBounced && sim.simBalls.vx[0] === -300);

freshWorld();
fadeControl.checked = true;
fadeControl.dispatch('change');
const rgb = 0xa1b2c3;
place(0, 300, 400, 300, 0, 14, rgb);
const w0 = cv.impactMarks.write;
let flipped = false, hitX = 0;
for (let k = 0; k < 200; k++) {
	const prevVx = sim.simBalls.vx[0];
	sim.simStep(1 / 120);
	if (sim.simBalls.vx[0] !== prevVx && !flipped) {
		flipped = true;
		hitX = sim.simBalls.x[0];
	}
}
check('divider reflection: flips at the face', flipped && Math.abs(hitX - (sim.simField.wallX - 14)) < 0.01);
check('divider reflection: ball returns left', sim.simBalls.x[0] < sim.simField.wallX - 14);
const slot = w0 % cv.IMPACT_CAP;
check('impact: face, diameter, approach side, and ball color',
	cv.impactMarks.x[slot] === sim.simField.wallX - sim.simField.wallT / 2
	&& cv.impactMarks.y[slot] === 400
	&& cv.impactMarks.radius[slot] === 14
	&& cv.impactMarks.side[slot] === -1
	&& cv.impactMarks.rgb[slot] === rgb);
ctx2d.calls.length = 0;
cv.canvasDraw(0);
check('impact: patch spans wall thickness by ball diameter', hasRectCall(596, 386, 8, 28));
let lastBallFill = null;
for (const call of ctx2d.calls) if (call.method === 'fill') lastBallFill = call;
check('draw layers: balls remain opaque after forecast and impact cues', lastBallFill && lastBallFill.globalAlpha === 1);
cv.canvasDraw(1.6);
cv.canvasDraw(1.6);
check('impact: slow fade expires by age', cv.impactMarks.age[slot] > cv.IMPACT_TTL);
fadeControl.checked = false;
fadeControl.dispatch('change');

freshWorld();
place(0, 300, 400, 200, 0, 14, 0xabcdef);
cv.canvasDrawOptions.predictedPosition = true;
cv.canvasDrawOptions.trajectoryLines = false;
ctx2d.calls.length = 0;
cv.canvasDraw(0);
check('forecast option: predicted position draws diameter-sized wall patch', hasRectCall(596, 386, 8, 28));
check('forecast option: position can show without trajectory lines', countCalls('stroke') === 0);
cv.canvasDrawOptions.predictedPosition = false;
cv.canvasDrawOptions.trajectoryLines = true;
ctx2d.calls.length = 0;
cv.canvasDraw(0);
check('forecast option: trajectory line can show without position mark',
	!hasRectCall(596, 386, 8, 28) && countCalls('stroke') === 1);

freshWorld();
sim.simAperture.y = 400;
sim.simAperture.targetY = 400;
place(0, 300, 480, 200, 0, 14, 0xabcdef);
cv.canvasDrawOptions.trajectoryLines = false;
ctx2d.calls.length = 0;
cv.canvasDraw(0);
check('forecast patch: clips to solid wall beside aperture', hasRectCall(596, 466, 8, 28));

freshWorld();
sim.simAperture.y = 400;
sim.simAperture.targetY = 400;
place(0, 300, 400, 200, 0, 14, 0x445566);
const w1 = cv.impactMarks.write;
for (let k = 0; k < 480; k++) sim.simStep(1 / 120);
check('aperture crossing: passes to the right', sim.simBalls.x[0] > sim.simField.wallX + 14);
check('aperture crossing: keeps velocity', sim.simBalls.vx[0] === 200);
check('aperture crossing: no impact recorded', cv.impactMarks.write === w1);

freshWorld();
sim.simAperture.y = 400;
sim.simAperture.targetY = 400;
place(0, 300, 480, 200, 0, 14, 0x778899);
let partialFlipped = false;
for (let k = 0; k < 200 && !partialFlipped; k++) {
	sim.simStep(1 / 120);
	partialFlipped = sim.simBalls.vx[0] < 0;
}
check('aperture: partial fit reflects', partialFlipped && Math.abs(sim.simBalls.x[0] - (sim.simField.wallX - 14)) < 1);

freshWorld();
sim.simAperture.y = 400;
sim.simAperture.targetY = 400;
place(0, 300, 400, 200, 0, 100, 0x778899);
let bigFlipped = false;
for (let k = 0; k < 200 && !bigFlipped; k++) {
	sim.simStep(1 / 120);
	bigFlipped = sim.simBalls.vx[0] < 0;
}
check('aperture: oversized ball reflects', bigFlipped && Math.abs(sim.simBalls.x[0] - (sim.simField.wallX - 100)) < 1);

freshWorld();
place(0, 500, 400, 200, 0, 10, 1);
place(1, 560, 400, -200, 0, 10, 2);
for (let k = 0; k < 20; k++) sim.simStep(1 / 120);
check('collisions on: head-on velocities exchange', sim.simBalls.vx[0] === -200 && sim.simBalls.vx[1] === 200);
check('collisions on: balls separate', sim.simBalls.x[1] - sim.simBalls.x[0] >= 20 - 0.01);

freshWorld();
sim.simSetBallCollisions(false);
place(0, 500, 400, 200, 0, 10, 1);
place(1, 560, 400, -200, 0, 10, 2);
for (let k = 0; k < 30; k++) sim.simStep(1 / 120);
check('collisions off: balls pass through',
	sim.simBalls.vx[0] === 200 && sim.simBalls.vx[1] === -200 && sim.simBalls.x[0] > sim.simBalls.x[1]);

freshWorld();
place(0, 800, 400, 300, 120, 14, 0xabcdef);
sim.simStep(1 / 120);
const snap = [sim.simBalls.x[0], sim.simBalls.y[0], sim.simBalls.vx[0], sim.simBalls.vy[0]];
const scale0 = cv.canvasView.scale;
stubs.els.canv.clientWidth = 500;
stubs.els.canv.clientHeight = 300;
for (const fn of stubs.listeners.resize || []) fn();
check('resize: view transform changes, world state does not',
	cv.canvasView.scale !== scale0
	&& sim.simBalls.x[0] === snap[0] && sim.simBalls.y[0] === snap[1]
	&& sim.simBalls.vx[0] === snap[2] && sim.simBalls.vy[0] === snap[3]);

sim.simSetBallCollisions(false);
sim.simSetSpawnRate(2.5);
sim.simInit();
check('generation: initial crowd bounded', sim.simBalls.count > 0 && sim.simBalls.count <= sim.BALL_CAP);
let spawnClean = true;
for (let i = 0; i < sim.simBalls.count; i++) {
	if (Math.abs(sim.simBalls.x[i] - sim.simField.wallX) < sim.simBalls.r[i]) spawnClean = false;
	if (!inBounds(i)) spawnClean = false;
}
check('generation: spawns avoid divider and bounds', spawnClean);
for (let s = 0; s < 240; s++) sim.simAdvance(0.25);
check('generation: count capped at BALL_CAP', sim.simBalls.count === sim.BALL_CAP);
let speedOk = true, boundsOk = true;
for (let i = 0; i < sim.simBalls.count; i++) {
	if (Math.hypot(sim.simBalls.vx[i], sim.simBalls.vy[i]) > sim.BALL_V_MAX + 0.01) speedOk = false;
	if (!inBounds(i)) boundsOk = false;
}
check('generation: speeds bounded and balls in field after 60s', speedOk && boundsOk);

console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
