// owns: deterministic mode smoke — URL state, paint/passage/capture, gun ray/refusal, gestures
// edit for: mode contracts, gesture mapping, forecast decisions

const path = require('path');
const { loadGame } = require('./vmload');
const { apis, stubs, document: doc } = loadGame(path.join(__dirname, '..'));
const settings = apis['settings.js'];
const mode = apis['mode.js'];
const sim = apis['simulation.js'];
const traj = apis['trajectory.js'];
const cv = apis['canvas.js'];
const paint = apis['territorypaint.js'];
const territory = apis['territory.js'];
const gun = apis['gun.js'];
const modeInput = apis['modeinput.js'];
const input = apis['input.js'];
const mc = apis['modecolor.js'];
const els = stubs.els;
let pass = 0;
let fail = 0;

function check(name, ok) {
	if (ok) pass++;
	else { fail++; console.log('FAIL ' + name); }
}
function near(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-4); }
function setMode(name) { settings.settingsSetMode(name, false); }
function place(i, x, y, vx, vy, r, hue) {
	sim.simBalls.count = i + 1;
	sim.simBalls.x[i] = x;
	sim.simBalls.y[i] = y;
	sim.simBalls.vx[i] = vx;
	sim.simBalls.vy[i] = vy;
	sim.simBalls.r[i] = r;
	sim.simBalls.css[i] = '#ffffff';
}

check('url: mode normalizes and defaults to standard',
	settings.settingsNormalize('mode', 'bad') === 'standard'
	&& settings.settingsFromSearch('?').mode === 'standard');
check('url: territory turns colored rooms on by default',
	settings.settingsFromSearch('?mode=territory').mode === 'territory'
	&& settings.settingsFromSearch('?mode=territory').rooms === true
	&& settings.settingsFromSearch('?mode=territory&rooms=0').rooms === false);
check('url: standard omits mode and rooms keys',
	settings.settingsEncode('mode', 'standard') === undefined
	&& settings.settingsEncode('mode', 'ball-gun') === 'ball-gun');
check('boot: standard field has no mode hooks', mode.modeState.active === 'standard'
	&& doc.body.dataset.mode === 'standard' && els['territory-hud'].hidden && els['gun-hud'].hidden);
check('boot: standard settings speed matches the share',
	near(sim.simBallConfig.speed, sim.simPx(settings.settingsState.ballSpeed))
	&& near(sim.simAperture.speed, sim.simPx(settings.settingsState.holeSpeed)));

sim.simSetSpawnRate(0);
setMode('territory');
check('mode: territory URL state and HUD', mode.modeState.active === 'territory'
	&& settings.settingsState.rooms === true && !els['territory-hud'].hidden && els['gun-hud'].hidden
	&& doc.body.dataset.mode === 'territory');
check('mode: territory gate sits at the top and is finite', territory.territoryState.gate > 0
	&& territory.territoryState.gate < sim.simField.h * 0.25
	&& territory.territoryAperture.size === territory.territoryState.gate);
check('mode: hole channel is disabled in territory', !input.inputState.pointerEnabled && !input.inputState.keysEnabled);
check('mode: seeded regions are small, distinct and reachable',
	paint.territoryPaintShare(mc.MODE_RED) > 0 && paint.territoryPaintShare(mc.MODE_RED) < 0.3
	&& paint.territoryPaintShare(mc.MODE_BLUE) > 0 && paint.territoryPaintShare(mc.MODE_BLUE) < 0.3
	&& Math.abs(territory.territoryGuns[0].y - territory.territoryGuns[1].y) > sim.simField.h * 0.15);

function paintSig() {
	let sum = 0;
	for (let k = 0; k < paint.territoryPaint.count; k++) {
		sum += (k + 1) * (paint.territoryPaint.owner[k] + 1) * paint.territoryPaint.blend[k] * paint.territoryPaint.h[k];
	}
	return sum;
}

const midY = territory.territoryState.gate + territory.territoryState.wallH * 0.5;
place(0, sim.simField.wallX - 60, midY, 100, 0, 14, mc.MODE_HUE[mc.MODE_NONE]);
territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_NONE];
const sigBefore = paintSig();
territory.territoryDivider(0, midY, 14, -14);
check('paint: neutral ball bounces without painting', sim.simBalls.vx[0] === -100
	&& paintSig() === sigBefore && paint.territoryPaintOwnerAt(midY) === mc.MODE_NONE);
check('passage: neutral ball never crosses a solid wall', !territory.territoryPasses(0, midY, 14));

// a colored contact repaints only its footprint, gradually
const contactY = territory.territoryState.gate + territory.territoryState.wallH * 0.82;
territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_RED];
function redContact() {
	sim.simBalls.vx[0] = 100;
	sim.simBalls.x[0] = sim.simField.wallX - 60;
	territory.territoryDivider(0, contactY, 14, -14);
}
const beforeRed = paint.territoryPaintShare(mc.MODE_RED);
redContact();
check('paint: one red contact is localized and not yet a passage',
	paint.territoryPaintShare(mc.MODE_RED) === beforeRed
	&& paint.territoryPaintPasses(mc.MODE_RED, contactY, 14) === false
	&& paint.territoryPaintOwnerAt(midY) === mc.MODE_NONE);
for (let k = 0; k < 12; k++) redContact();
check('paint: repeated contacts grow the red share gradually',
	paint.territoryPaintShare(mc.MODE_RED) > beforeRed);
check('passage: matching color crosses its painted region',
	territory.territoryPasses(0, contactY, 14) === true);
territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_BLUE];
check('passage: other color is stopped by the same region',
	territory.territoryPasses(0, contactY, 14) === false);

// the trajectory hook shares the simulation's one passage predicate
const redY = territory.territoryGuns[0].y;
territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_RED];
place(0, sim.simField.wallX - 300, redY, 100, 0, 14, 0);
const redEnd = traj.trajTrace(sim.simBalls.x[0], redY, 100, 0, 14, Infinity, traj.trajPath, 0, 10, 0);
territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_BLUE];
const blueEnd = traj.trajTrace(sim.simBalls.x[0], redY, 100, 0, 14, Infinity, traj.trajPath, 0, 10, 0);
check('trajectory: matching passage forecasts a pass, mismatch a hit',
	redEnd === traj.TRAJ_PASS && blueEnd === traj.TRAJ_HIT);
check('trajectory: universal gate passes every color',
	territory.territoryPasses(0, 20, 14) === true);
// highlighted forecasts follow the player's wall color
const hitPath = { n: 2, y: [0, redY] };
check('trajectory: player-colored wall region highlights its forecast',
	territory.territoryView.forecast(0, traj.TRAJ_HIT, hitPath) === 2
	&& territory.territoryView.forecastCss() === mc.MODE_CSS[mc.MODE_RED]);

// colored rooms gradually move a ball's hue toward the room color
territory.territorySetRooms(true);
place(0, sim.simField.w * 0.18, sim.simField.h * 0.28, 0, 0, 14, 0);
territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_NONE];
territory.territoryState.bucket[0] = mc.MODE_HUE[mc.MODE_NONE] | 0;
sim.simBalls.rgb[0] = mc.modeColorRgb(135);
for (let k = 0; k < 40; k++) territory.territorySimHook.afterBalls(0.05);
check('rooms: a ball inside a red room becomes red',
	territory.territoryBallOwner(0) === mc.MODE_RED && sim.simBalls.css[0] !== '#ffffff');
territory.territorySetRooms(false);
const hueOff = territory.territoryState.hue[0];
territory.territorySimHook.afterBalls(0.5);
check('rooms: the checkbox disables recoloring', territory.territoryState.hue[0] === hueOff);

// segment storage stays bounded and tiles the wall without gaps
let seed = 7;
for (let k = 0; k < 500; k++) {
	seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
	const y = territory.territoryState.gate + seed / 4294967296 * territory.territoryState.wallH;
	paint.territoryPaintContact(k % 2 ? mc.MODE_BLUE : mc.MODE_RED, y, 12);
}
let total = 0;
for (let k = 0; k < paint.territoryPaint.count; k++) total += paint.territoryPaint.h[k];
check('paint: contacts stay under the fixed capacity', paint.territoryPaint.count <= paint.TP_SEG_CAP);
check('paint: compaction leaves no gaps', near(total, territory.territoryState.wallH, 0.5));
check('paint: ray falloff decreases with distance and aim error',
	territory.territoryPullAccel(50, 5) > territory.territoryPullAccel(200, 5)
	&& territory.territoryPullAccel(50, 5) > territory.territoryPullAccel(50, 60)
	&& territory.territoryPullAccel(sim.simPx(600), 5) === 0);
place(0, 300, 300, 0, 0, 14, 0);
place(1, 900, 300, 0, 0, 14, 0);
territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_RED];
territory.territoryState.hue[1] = mc.MODE_HUE[mc.MODE_BLUE];
territory.territoryState.hueCount = 2;
territory.territoryHudPaint();
check('capture: HUD counts use the same hue rule as passage matching',
	els['territory-balls-0'].textContent === '1 balls' && els['territory-balls-1'].textContent === '1 balls');

setMode('ball-gun');
check('mode: ball-gun URL state and HUD', mode.modeState.active === 'ball-gun'
	&& !els['gun-hud'].hidden && els['territory-hud'].hidden
	&& doc.body.dataset.mode === 'ball-gun');
check('mode: ball speed doubles and hole speed quarters without changing settings',
	near(sim.simBallConfig.speed, sim.simPx(settings.settingsState.ballSpeed) * 2)
	&& near(sim.simAperture.speed, sim.simPx(settings.settingsState.holeSpeed) * 0.25)
	&& sim.simBallConfig.speedShare === settings.settingsState.ballSpeed
	&& sim.simAperture.speedShare === settings.settingsState.holeSpeed);
check('mode: gun sits at three quarters of the width, on the top edge',
	near(gun.gunState.x, sim.simField.w * 0.75) && gun.gunState.y === 0);
check('mode: pointer hole channel is off, keys stay on',
	!input.inputState.pointerEnabled && input.inputState.keysEnabled);
check('gun: ray falloff is monotone and zero past reach',
	gun.gunPullAccel(50, 5) > gun.gunPullAccel(300, 5)
	&& gun.gunPullAccel(50, 5) > gun.gunPullAccel(50, 70)
	&& gun.gunPullAccel(sim.simPx(700), 5) === 0);
check('gun: push cap is field-relative in the 10-20 % range',
	near(gun.gunPushStrength(), sim.simPx(150), 1));

// deterministic target selection: the ball nearer the aim ray wins
gun.gunSetAim(sim.simField.wallX, sim.simField.h * 0.5);
place(0, sim.simField.w * 0.62, sim.simField.h * 0.30, 0, 0, 14, 0);
place(1, sim.simField.w * 0.62, sim.simField.h * 0.34, 0, 0, 14, 0);
gun.gunStep(0);
check('gun: target selection is deterministic', gun.gunState.target === 0);

// refusal: a post-push path through the aperture is refused; a miss permits the push
gun.gunSetAim(600, 400);
place(0, 700, 285, 0, 0, 14, 0);
gun.gunStep(0);
const vxBefore = sim.simBalls.vx[0];
gun.gunPush();
check('gun: a predicted pass refuses the push', gun.gunState.refused === 1
	&& sim.simBalls.vx[0] === vxBefore && gun.gunPredict() === traj.TRAJ_PASS);
gun.gunSetAim(610, 650);
gun.gunPush();
check('gun: a predicted hit permits the push', gun.gunState.refused === 0
	&& sim.simBalls.vx[0] !== vxBefore);
check('gun: selected ball is always forecast, other balls only on a pass',
	gun.gunView.forecast(0, traj.TRAJ_HIT, traj.trajPath) === 2
	&& gun.gunView.forecast(1, traj.TRAJ_HIT, traj.trajPath) === 0
	&& gun.gunView.forecast(1, traj.TRAJ_PASS, traj.trajPath) === 2
	&& gun.gunView.forecastBudget(0) === 10 && gun.gunView.forecastBudget(1) === 6);

// middle mouse aims/pulls, left pushes, right is unused; touch hold/tap are one press/release pair
const canv = els.canv;
const down = canv.dispatch('pointerdown', { pointerId: 77, button: 1, clientX: 600, clientY: 400 });
check('gesture: middle button starts pull and prevents autoscroll',
	down.defaultPrevented && gun.gunState.pull === 1);
const middleMouse = canv.dispatch('mousedown', { button: 1 });
check('gesture: middle mousedown prevents browser autoscroll', middleMouse.defaultPrevented);
canv.dispatch('pointerup', { pointerId: 77, button: 1, clientX: 600, clientY: 400 });
check('gesture: release stops the pull', gun.gunState.pull === 0);
canv.dispatch('pointerdown', { pointerId: 78, button: 2, clientX: 600, clientY: 400 });
check('gesture: right button is never an aim gesture', gun.gunState.pull === 0);
canv.dispatch('pointerup', { pointerId: 78, button: 2, clientX: 600, clientY: 400 });
canv.dispatch('pointerdown', { pointerId: 79, button: 0, pointerType: 'touch', clientX: 610, clientY: 650 });
modeInput.modeInputStep(0.2);
check('gesture: touch hold pulls', gun.gunState.pull === 1);
canv.dispatch('pointerup', { pointerId: 79, button: 0, pointerType: 'touch', clientX: 610, clientY: 650 });
check('gesture: touch release stops the pull', gun.gunState.pull === 0);
const tapVx = sim.simBalls.vx[0];
canv.dispatch('pointerdown', { pointerId: 80, button: 0, pointerType: 'touch', clientX: 610, clientY: 650 });
modeInput.modeInputStep(0.05);
canv.dispatch('pointerup', { pointerId: 80, button: 0, pointerType: 'touch', clientX: 610, clientY: 650 });
check('gesture: touch tap pushes', sim.simBalls.vx[0] !== tapVx);
modeInput.modeInputCancel();
check('gesture: cancellation and mode change stop force', gun.gunState.pull === 0
	&& gun.gunState.target === -1);

// returning to standard restores field, participants and the standard forecast rule
setMode('standard');
check('mode: standard restores speeds, HUD and URL state',
	mode.modeState.active === 'standard' && doc.body.dataset.mode === 'standard'
	&& els['territory-hud'].hidden && els['gun-hud'].hidden
	&& near(sim.simBallConfig.speed, sim.simPx(settings.settingsState.ballSpeed))
	&& near(sim.simAperture.speed, sim.simPx(settings.settingsState.holeSpeed))
	&& input.inputState.pointerEnabled && input.inputState.keysEnabled);
check('mode: standard forecasts still pass through the aperture',
	traj.trajTrace(sim.simField.wallX - 300, sim.simAperture.y, 200, 0, 14, Infinity, traj.trajPath) === traj.TRAJ_PASS);
check('mode: standard mode URL omits mode and rooms',
	settings.settingsEncode('mode', 'standard') === undefined);

console.log('mode_smoke pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
