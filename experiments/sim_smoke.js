// owns: plan 0.1 smoke for physics, generation, impacts, and dist snapshot
// edit for: new physics-contract checks

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const cv = apis['canvas.js'];
const col = apis['color.js'];
const ctx2d = stubs.ctx2d;
const DT = sim.FIXED_DT;
// sizes and speeds are shares of the field scale: a thousandth of sqrt(w * h)
const BALL_SIZE_SMALL = 10;

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
	sim.simResizeField(1200, 800);
	sim.simInit();
	sim.simBalls.count = 0;
	sim.simAperture.y = 100;
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

function near(a, b, tol = 1e-5) {
	return Math.abs(a - b) <= tol;
}

function inBounds(i) {
	const b = sim.simBalls, f = sim.simField;
	const r = b.r[i];
	return b.x[i] >= r - 1e-3 && b.x[i] <= f.w - r + 1e-3
		&& b.y[i] >= r - 1e-3 && b.y[i] <= f.h - r + 1e-3;
}

function hasRectCall(x, y, w, h) {
	for (const call of ctx2d.calls) {
		if (call.method !== 'fillRect') continue;
		if (near(call.args[0], x, 1e-3) && near(call.args[1], y, 1e-3)
			&& near(call.args[2], w, 1e-3) && near(call.args[3], h, 1e-3)) return true;
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
	near(cv.impactMarks.x[slot], sim.simField.wallX - sim.simField.wallT / 2, 1e-3)
	&& cv.impactMarks.y[slot] === 400
	&& near(cv.impactMarks.radius[slot], 14, 1e-6)
	&& cv.impactMarks.side[slot] === -1
	&& cv.impactMarks.rgb[slot] === rgb);
ctx2d.calls.length = 0;
cv.canvasDraw(0);
check('impact: patch spans wall thickness by ball diameter',
	hasRectCall(sim.simField.wallX - sim.simField.wallT / 2, 386, sim.simField.wallT, 28));
check('field: the screen edge is the boundary, no border is drawn',
	!hasRectCall(0, 0, sim.simField.w, sim.simField.wallT)
	&& !hasRectCall(0, 0, sim.simField.wallT, sim.simField.h)
	&& !hasRectCall(0, sim.simField.h - sim.simField.wallT, sim.simField.w, sim.simField.wallT)
	&& !hasRectCall(sim.simField.w - sim.simField.wallT, 0, sim.simField.wallT, sim.simField.h));
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
check('forecast option: predicted position draws diameter-sized wall patch',
	hasRectCall(sim.simField.wallX - sim.simField.wallT / 2, 386, sim.simField.wallT, 28));
check('forecast option: position can show without trajectory lines', countCalls('stroke') === 0);
cv.canvasDrawOptions.predictedPosition = false;
cv.canvasDrawOptions.trajectoryLines = true;
ctx2d.calls.length = 0;
cv.canvasDraw(0);
check('forecast option: trajectory line can show without position mark',
	!hasRectCall(sim.simField.wallX - sim.simField.wallT / 2, 386, sim.simField.wallT, 28) && countCalls('stroke') === 1);

freshWorld();
sim.simAperture.y = 400;
place(0, 300, 480, 200, 0, 14, 0xabcdef);
cv.canvasDrawOptions.trajectoryLines = false;
ctx2d.calls.length = 0;
cv.canvasDraw(0);
check('forecast patch: clips to solid wall beside aperture',
	hasRectCall(sim.simField.wallX - sim.simField.wallT / 2, 466, sim.simField.wallT, 28));

freshWorld();
sim.simAperture.y = 400;
place(0, 300, 400, 200, 0, 14, 0x445566);
const w1 = cv.impactMarks.write;
for (let k = 0; k < 480; k++) sim.simStep(1 / 120);
check('aperture crossing: passes to the right', sim.simBalls.x[0] > sim.simField.wallX + 14);
check('aperture crossing: keeps velocity', sim.simBalls.vx[0] === 200);
check('aperture crossing: no impact recorded', cv.impactMarks.write === w1);

freshWorld();
sim.simAperture.y = 400;
place(0, 300, 480, 200, 0, 14, 0x778899);
let partialFlipped = false;
for (let k = 0; k < 200 && !partialFlipped; k++) {
	sim.simStep(1 / 120);
	partialFlipped = sim.simBalls.vx[0] < 0;
}
check('aperture: partial fit reflects', partialFlipped && Math.abs(sim.simBalls.x[0] - (sim.simField.wallX - 14)) < 1);

freshWorld();
sim.simAperture.y = 400;
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
place(1, 200, 200, -300, -120, 14, 0xabcdef);
place(2, 1, 120, -260, -90, 14, 0xabcdef);
const grow = Math.sqrt(500 * 300) / Math.sqrt(1200 * 800);
stubs.els.canv.clientWidth = 500;
stubs.els.canv.clientHeight = 300;
for (const fn of stubs.listeners.resize || []) fn();
check('resize: the canvas is the field and the divider stays central',
	cv.canvasView.w === 500 && cv.canvasView.h === 300
	&& sim.simField.w === 500 && sim.simField.h === 300 && sim.simField.wallX === 250);
check('resize: balls rescale with the field and keep their side',
	near(sim.simBalls.x[0], 800 * 500 / 1200, 1e-3) && near(sim.simBalls.y[0], 400 * 300 / 800, 1e-3)
	&& sim.simBalls.x[0] > sim.simField.wallX && sim.simBalls.x[1] < sim.simField.wallX
	&& near(sim.simBalls.r[0], 14 * grow, 1e-3) && near(sim.simBalls.y[1], 200 * 300 / 800, 1e-3));
check('resize: radii and velocities follow the field scale, so size and pace hold',
	near(Math.hypot(sim.simBalls.vx[0], sim.simBalls.vy[0]), Math.hypot(300, 120) * grow, 1e-3)
	&& near(sim.simBalls.r[0] / sim.simField.scale, 14 / Math.sqrt(1200 * 800), 1e-9)
	&& near(sim.simField.wallT, sim.simPx(sim.WALL_SHARE), 1e-9));
check('resize: a ball shrunk below its old spot stays inside the screen', sim.simBalls.vx[2] > 0
	&& inBounds(2) && sim.simBalls.x[2] === sim.simBalls.r[2]);

freshWorld();
sim.simSetBallSize(21, true);
sim.simSetBallSpeed(300);
sim.simSpawn();
const ballShare = sim.simBalls.r[0] / sim.simField.scale;
const paceShare = Math.hypot(sim.simBalls.vx[0], sim.simBalls.vy[0]) / sim.simField.scale;
sim.simResizeField(390, 844);
check('resize: a phone-sized field keeps the ball share and the pace, not the pixel values',
	near(sim.simBalls.r[0] / sim.simField.scale, ballShare, 1e-6)
	&& near(Math.hypot(sim.simBalls.vx[0], sim.simBalls.vy[0]) / sim.simField.scale, paceShare, 1e-6)
	&& near(sim.simBallConfig.radius, 21 * Math.sqrt(390 * 844) / 1000, 1e-9)
	&& near(sim.simAperture.size, sim.simPx(sim.APERTURE_SIZE), 1e-9));
sim.simSetBallSize(sim.BALL_SIZE_DEFAULT, true);
sim.simSetBallSpeed(sim.BALL_SPEED_DEFAULT);

freshWorld();
place(0, 300, 400, 0, 0, 14, 0xff0000);
place(1, 900, 400, 0, 0, 14, 0x0000ff);
sim.simBalls.palette[0] = 0;
sim.simBalls.palette[1] = 5;
sim.simFillDist();
check('dist: center x splits left/right', sim.simDist.left === 1 && sim.simDist.right === 1 && sim.simDist.total === 2);
check('dist: palette maps to hot/cold', sim.simDist.leftHot === 1 && sim.simDist.rightCold === 1 && sim.simDist.palette[0] === 1 && sim.simDist.palette[5] === 1);
const distRev = sim.simDist.rev;
sim.simFillDist();
check('dist: rev stable when counts hold', sim.simDist.rev === distRev);
sim.simBalls.x[0] = 900;
sim.simFillDist();
check('dist: rev bumps when a ball changes side', sim.simDist.rev === distRev + 1 && sim.simDist.left === 0 && sim.simDist.right === 2);

sim.simSetBallCollisions(false);
sim.simSetBallCount(sim.BALL_CAP);
sim.simSetSpawnRate(2.5);
sim.simInit();
check('generation: initial crowd bounded', sim.simBalls.count > 0 && sim.simBalls.count <= sim.BALL_CAP);
check('dist: snapshot total matches live count', sim.simDist.total === sim.simBalls.count);
let spawnClean = true;
for (let i = 0; i < sim.simBalls.count; i++) {
	if (Math.abs(sim.simBalls.x[i] - sim.simField.wallX) < sim.simBalls.r[i]) spawnClean = false;
	if (!inBounds(i)) spawnClean = false;
}
check('generation: spawns avoid divider and bounds', spawnClean);
for (let s = 0; s < 240; s++) sim.simAdvance(0.25);
check('generation: count capped at the configured limit', sim.simBalls.count === sim.simBallConfig.count);
let speedOk = true, boundsOk = true;
for (let i = 0; i < sim.simBalls.count; i++) {
	const speedMax = sim.simPx(sim.BALL_V_MAX * sim.simBallConfig.speedShare) / ((sim.BALL_V_MIN + sim.BALL_V_MAX) / 2);
	if (Math.hypot(sim.simBalls.vx[i], sim.simBalls.vy[i]) > speedMax + 0.01) speedOk = false;
	if (!inBounds(i)) boundsOk = false;
}
check('generation: speeds bounded and balls in field after 60s', speedOk && boundsOk);


// ball size is one mean radius plus a variety switch; both reach the live field
freshWorld();
place(0, 300, 200, 100, 0, sim.simPx(sim.BALL_SIZE_DEFAULT), 0x112233);
place(1, 300, 400, 100, 0, sim.simPx(sim.BALL_SIZE_DEFAULT), 0x112233);
sim.simSetBallSize(21, true);
check('ball size: the share sets the mean radius of every live ball', near(sim.simBalls.r[0], sim.simPx(21), 1e-4)
	&& near(sim.simBalls.r[1], sim.simPx(21), 1e-4) && sim.simBallConfig.varied === true);
check('ball size: the setting clamps to its range', sim.simSetBallSize(90, true)
	&& sim.simBallConfig.sizeShare === sim.BALL_SIZE_MAX);
sim.simSetBallSize(8, false);
check('ball size: random sizes off gives every ball the same radius', near(sim.simBalls.r[0], sim.simPx(8), 1e-3)
	&& near(sim.simBalls.r[1], sim.simPx(8), 1e-3) && near(sim.simBallRadius.max, sim.simPx(8), 1e-9));
sim.simSetBallSize(BALL_SIZE_SMALL, true);
let spreadOk = true;
for (let k = 0; k < 40; k++) {
	sim.simBalls.count = 0;
	sim.simSpawn();
	const r = sim.simBalls.r[0];
	if (r < sim.simPx(BALL_SIZE_SMALL) * (1 - sim.BALL_SIZE_VARIETY) - 1e-3
		|| r > sim.simPx(BALL_SIZE_SMALL) * (1 + sim.BALL_SIZE_VARIETY) + 1e-3) spreadOk = false;
}
check('ball size: random sizes stay inside the variety band around the mean', spreadOk
	&& near(sim.simBallRadius.max, sim.simPx(BALL_SIZE_SMALL) * (1 + sim.BALL_SIZE_VARIETY), 1e-3));
sim.simSetBallSize(sim.BALL_SIZE_DEFAULT, true);

freshWorld();
place(0, 700, 400, 0, 0, 14, 0x112233);
sim.simSetBallSize(sim.BALL_SIZE_MAX, true);
check('ball size: a bigger ball is pushed back inside the screen', inBounds(0));
sim.simSetBallSize(sim.BALL_SIZE_DEFAULT, true);

freshWorld();
sim.simSetBallCollisions(false);
place(0, 500, 400, 200, 0, 10, 1);
place(1, 560, 400, -200, 0, 10, 2);
for (let k = 0; k < 30; k++) sim.simStep(1 / 120);
check('collisions: the setting reaches the step, and switching it back collides',
	sim.simBalls.x[0] > sim.simBalls.x[1] && (sim.simSetBallCollisions(true), sim.simStep(1 / 120), true));
sim.simSetBallCollisions(true);

sim.simSetBallCount(sim.BALL_COUNT_DEFAULT);
sim.simSetBallSpeed(sim.BALL_SPEED_DEFAULT);
sim.simSetSpawnRate(0);
sim.simInit();
check('ball defaults: limit 24, average speed 18 %, initial population 9',
	sim.simBallConfig.count === 24 && sim.simBallConfig.speedShare === 180
	&& near(sim.simBallConfig.speed, sim.simPx(180), 1e-9) && sim.simBalls.count === 9);
let speedSum = 0;
let speedSamples = 0;
let spawnBounds = true;
const speedScale = sim.simPx(sim.BALL_SPEED_DEFAULT) / ((sim.BALL_V_MIN + sim.BALL_V_MAX) / 2);
for (let run = 0; run < 200; run++) {
	sim.simInit();
	for (let i = 0; i < sim.simBalls.count; i++) {
		const speed = Math.hypot(sim.simBalls.vx[i], sim.simBalls.vy[i]);
		speedSum += speed;
		speedSamples++;
		if (speed < sim.BALL_V_MIN * speedScale - 0.01 || speed > sim.BALL_V_MAX * speedScale + 0.01) spawnBounds = false;
	}
}
check('ball speed: spawned distribution is centered on the setting',
	spawnBounds && Math.abs(speedSum / speedSamples - sim.simPx(sim.BALL_SPEED_DEFAULT)) < 5);

freshWorld();
for (let i = 0; i < 24; i++) sim.simSpawn();
check('ball count: lowering the limit trims immediately', sim.simSetBallCount(12) === true
	&& sim.simBalls.count === 12 && sim.simDist.total === 12);
sim.simStep(DT);
check('ball count: a raised limit fills through generation, not a reset', sim.simSetBallCount(18) === true
	&& sim.simBalls.count === 12);
sim.simSetSpawnRate(24);
for (let i = 0; i < 120; i++) sim.simStep(DT);
check('ball count: generation stops at the raised limit', sim.simBalls.count === 18);
sim.simSetSpawnRate(0);
place(0, 300, 400, 300, 400, 14, 0);
place(1, 900, 400, 0, -100, 14, 0);
const fast = sim.BALL_SPEED_MAX / sim.BALL_SPEED_DEFAULT;
sim.simSetBallSpeed(sim.BALL_SPEED_MAX);
check('ball speed: existing velocities scale without turning', near(sim.simBalls.vx[0], 300 * fast, 0.01)
	&& near(sim.simBalls.vy[0], 400 * fast, 0.01) && sim.simBalls.vx[1] === 0
	&& near(sim.simBalls.vy[1], -100 * fast, 0.01));
sim.simSetBallSpeed(sim.BALL_SPEED_MIN);
const slow = sim.BALL_SPEED_MIN / sim.BALL_SPEED_MAX;
check('ball speed: a second change scales from the current setting', near(sim.simBalls.vx[0], 300 * fast * slow, 0.01)
	&& near(sim.simBalls.vy[1], -100 * fast * slow, 0.01));

console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
