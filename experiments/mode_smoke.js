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
check('mode: territory balls move at a quarter of the standard speed',
	near(sim.simBallConfig.speed, sim.simPx(settings.settingsState.ballSpeed) * 0.25));
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

// colored rooms gradually move a ball's hue toward the room color (procedural, side-attached)
territory.territorySetRooms(true);
const rooms = apis['rooms.js'];
let redRoom = null;
for (let k = 0; k < rooms.roomsState.count; k++) if (rooms.roomsState.rooms[k].owner === mc.MODE_RED) { redRoom = rooms.roomsState.rooms[k]; break; }
if (!redRoom) redRoom = rooms.roomsState.rooms[0];
place(0, redRoom.tintX + redRoom.tintW * 0.5, redRoom.tintY + redRoom.tintH * 0.5, 0, 0, 14, 0);
territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_NONE];
territory.territoryState.bucket[0] = mc.MODE_HUE[mc.MODE_NONE] | 0;
sim.simBalls.rgb[0] = mc.modeColorRgb(135);
for (let k = 0; k < 40; k++) territory.territorySimHook.afterBalls(0.05);
check('rooms: a ball inside a red room becomes red',
	territory.territoryBallOwner(0) === mc.MODE_RED && sim.simBalls.css[0] !== '#ffffff');
check('rooms: rooms are side-attached and have walls with holes',
	rooms.roomsState.count >= 3 && rooms.roomsState.count <= 5
	&& rooms.roomsState.rooms.some(r => r.walls.length > 0)
	&& rooms.roomsState.rooms.some(r => r.walls.length === 0 || r.type === 'tint')
	&& rooms.roomsState.rooms.every(r => r.tintX === 0 || r.tintX + r.tintW >= sim.simField.w - 1 || r.tintY === 0 || r.tintY + r.tintH >= sim.simField.h - 1));
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
check('mode: ball speed quarters and hole speed quarters without changing settings',
	near(sim.simBallConfig.speed, sim.simPx(settings.settingsState.ballSpeed) * 0.25)
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
gun.gunSetForce(100);
check('gun: push cap is field-relative in the 10-20 % range',
	near(gun.gunPushStrength(), sim.simPx(150), 1));
gun.gunSetForce(60);

// deterministic target selection: the ball nearer the aim ray wins
gun.gunSetAim(sim.simField.wallX, sim.simField.h * 0.5);
place(0, sim.simField.w * 0.62, sim.simField.h * 0.30, 0, 0, 14, 0);
place(1, sim.simField.w * 0.62, sim.simField.h * 0.34, 0, 0, 14, 0);
gun.gunStep(0);
check('gun: target selection is deterministic', gun.gunState.target === 0);

// capture: a pulled ball reaching the gun is consumed into the store, without bouncing
gun.gunSetAim(600, 400);
place(0, gun.gunState.x, gun.gunState.y + 20, 0, 0, 14, 0);
sim.simBalls.count = 1;
gun.gunState.pull = 1;
gun.gunStep(0);
check('gun: pull consumes a ball at the muzzle into the store',
	gun.gunState.stored === 1 && sim.simBalls.count === 0 && gun.gunState.target === -1);
gun.gunState.pull = 0;
check('gun: capture keeps the stored ball color and radius',
	gun.gunState.storeR[0] === 14 && gun.gunState.storeCss[0] === '#ffffff');
place(0, gun.gunState.x, gun.gunState.y + 20, 0, 0, 14, 0);
gun.gunCapture(0);
place(0, gun.gunState.x, gun.gunState.y + 20, 0, 0, 14, 0);
gun.gunCapture(0);
place(0, gun.gunState.x, gun.gunState.y + 20, 0, 0, 14, 0);
check('gun: store holds at most three balls', gun.gunState.stored === 3
	&& gun.gunCapture(0) === false && sim.simBalls.count === 1);
// FIFO: relaunch order is capture order — drain back to one stored ball for the refusal checks
sim.simBalls.count = 0;
for (let drain = 0; drain < 4 && gun.gunState.stored > 1; drain++) { gun.gunSetAim(600, 650); gun.gunPush(); sim.simBalls.count = 0; }
check('gun: launches drain the store oldest first', gun.gunState.stored === 1);

// refusal: a launch predicted through the aperture is refused and keeps the stored ball
place(0, 700, 285, 0, 0, 14, 0);
sim.simBalls.count = 0;
gun.gunSetAim(sim.simField.wallX, sim.simAperture.y);
gun.gunPush();
check('gun: a predicted pass refuses the launch', gun.gunState.refused === 1
	&& gun.gunState.stored === 1 && sim.simBalls.count === 0 && gun.gunPredict() === traj.TRAJ_PASS);
gun.gunSetAim(610, 650);
gun.gunPush();
check('gun: a predicted hit launches the stored ball along the aim', gun.gunState.refused === 0
	&& gun.gunState.stored === 0 && sim.simBalls.count === 1 && sim.simBalls.vy[0] > 0);
place(0, 700, 285, 0, 0, 14, 0);
gun.gunStep(0);
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
gun.gunCapture(0);
const tapStored = gun.gunState.stored;
const tapCount = sim.simBalls.count;
canv.dispatch('pointerdown', { pointerId: 80, button: 0, pointerType: 'touch', clientX: 610, clientY: 650 });
modeInput.modeInputStep(0.05);
canv.dispatch('pointerup', { pointerId: 80, button: 0, pointerType: 'touch', clientX: 610, clientY: 650 });
check('gesture: touch tap launches a stored ball', gun.gunState.stored === tapStored - 1
	&& sim.simBalls.count === tapCount + 1);
check('gun: wheel changes force and energy cost of pull and push', (() => {
	gun.gunSetForce(20);
	const lowPush = gun.gunPushStrength();
	const lowAccel = gun.gunPullAccel(80, 10);
	gun.gunSetForce(100);
	const highPush = gun.gunPushStrength();
	const highAccel = gun.gunPullAccel(80, 10);
	gun.gunSetForce(60);
	return highPush > lowPush && highAccel > lowAccel;
})());
check('gun: energy drains on pull and recharges when idle', (() => {
	gun.gunSetForce(100);
	gun.gunState.energy = gun.gunState.energyCap;
	const before = gun.gunState.energy;
	gun.gunSetAim(gun.gunState.x + 200, gun.gunState.y + 200);
	const gx = gun.gunState.x;
	const gy = gun.gunState.y;
	place(0, gx + gun.gunState.ux * 120, gy + gun.gunState.uy * 120, 0, 0, 14, 0);
	sim.simBalls.count = 1;
	gun.gunState.pull = 1;
	gun.gunStep(0.1);
	gun.gunState.pull = 0;
	const afterPull = gun.gunState.energy;
	gun.gunStep(0.5);
	const afterRecharge = gun.gunState.energy;
	return afterPull < before && afterRecharge > afterPull;
})());
check('gun: push costs energy and is refused when energy is empty', (() => {
	place(0, gun.gunState.x, gun.gunState.y + 20, 0, 0, 14, 0);
	sim.simBalls.count = 1;
	gun.gunCapture(0);
	gun.gunSetAim(600, 650);
	gun.gunState.energy = 0;
	const stored = gun.gunState.stored;
	gun.gunPush();
	const refused = gun.gunState.refused === 1 && gun.gunState.stored === stored;
	gun.gunState.energy = gun.gunState.energyCap;
	gun.gunPush();
	return refused && gun.gunState.stored === stored - 1;
})());
check('gesture: wheel event changes gun force', (() => {
	gun.gunSetForce(60);
	const cv2 = els.canv.dispatch('wheel', { deltaY: 100 });
	return gun.gunState.force === 55;
})());

// territory ball-gun pull/consume/store/launch
setMode('territory');
check('territory: guns pull and consume neutral balls into a 3-ball store without bouncing', (() => {
	territory.territorySetRooms(false);
	const gid = 0;
	const gx = territory.territoryGunX(gid);
	const gy = territory.territoryGuns[gid].y;
	place(0, gx - 18, gy + 2, 0, 0, 14, 0);
	sim.simBalls.count = 1;
	territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_NONE];
	territory.territoryState.bucket[0] = mc.MODE_HUE[mc.MODE_NONE] | 0;
	territory.territoryGuns[gid].aimX = gx - 120;
	territory.territoryGuns[gid].aimY = gy;
	territory.territoryGuns[gid].pull = 1;
	territory.territoryGuns[gid].stored = 0;
	territory.territoryUpdateAim(gid);
	territory.territoryUpdateTarget(gid);
	territory.territoryBeforeBalls(0.05);
	const ok = territory.territoryGuns[gid].stored === 1 && sim.simBalls.count === 0;
	territory.territoryGuns[gid].pull = 0;
	return ok;
})());
check('territory: wheel changes force and energy cost for both guns', (() => {
	const before0 = territory.territoryGuns[0].force;
	territory.territoryWheel(-100);
	const after0 = territory.territoryGuns[0].force;
	territory.territoryWheel(100);
	return after0 === before0 + 5 && territory.territoryGuns[0].force === before0;
})());
check('territory: push from store costs energy and can be triggered via stored balls', (() => {
	const gid = 1;
	const g = territory.territoryGuns[gid];
	g.stored = 0;
	place(0, territory.territoryGunX(gid) + 16, g.y, 0, 0, 14, 0);
	sim.simBalls.count = 1;
	territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_NONE];
	territory.territoryState.bucket[0] = 0 | 0;
	territory.territoryCapture(gid, 0);
	const stored = g.stored;
	g.energy = g.energyCap;
	g.aimX = sim.simField.wallX + 200; g.aimY = g.y; territory.territoryUpdateAim(gid);
	const beforeEnergy = g.energy;
	territory.territoryLaunchBall(gid);
	return stored === 1 && g.stored === 0 && sim.simBalls.count === 1 && g.energy < beforeEnergy;
})());
check('territory: muzzle capture ignores t<=0 and divider does not bounce a capturable ball', (() => {
	const gid = 0;
	const g = territory.territoryGuns[gid];
	g.stored = 0;
	const gx = territory.territoryGunX(gid);
	place(0, gx, g.y, 0, 0, 14, 0);
	sim.simBalls.count = 1;
	territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_NONE];
	const captured = territory.territoryTryCaptureMuzzle(gid, 0);
	return captured && g.stored === 1 && sim.simBalls.count === 0;
})());
check('territory: rooms tint still works after refactor and HUD shows force/energy', (() => {
	territory.territorySetRooms(true);
	const rs = apis['rooms.js'].roomsState;
	let redRoom2 = null;
	for (let k = 0; k < rs.count; k++) if (rs.rooms[k].owner === mc.MODE_RED) { redRoom2 = rs.rooms[k]; break; }
	if (!redRoom2) return false;
	place(0, redRoom2.tintX + 4, redRoom2.tintY + 4, 0, 0, 14, 0);
	territory.territoryState.hue[0] = mc.MODE_HUE[mc.MODE_NONE];
	territory.territoryState.bucket[0] = 0 | 0;
	sim.simBalls.rgb[0] = mc.modeColorRgb(135);
	for (let k = 0; k < 30; k++) territory.territorySimHook.afterBalls(0.05);
	territory.territoryHudPaint();
	return territory.territoryBallOwner(0) === mc.MODE_RED && els['territory-force-0'].textContent.indexOf('%') >= 0;
})());

setMode('ball-gun');
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
