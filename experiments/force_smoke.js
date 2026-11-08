// owns: plan 0.3 smoke for hole force requests, energy funding and the force controls
// edit for: funding rules, control bindings, store rate checks

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const force = apis['force.js'];
const input = apis['input.js'];
const players = apis['players.js'];
const tasks = apis['tasks.js'];
const main = apis['main.js'];

const DT = sim.FIXED_DT;
const CAP = force.FORCE_CAPACITY;

let pass = 0;
let fail = 0;

function check(name, ok) {
	if (ok) pass++;
	else {
		fail++;
		console.log('FAIL ' + name);
	}
}

function near(a, b, tol) {
	return Math.abs(a - b) <= tol;
}

// every case starts from the same world: no spawning, no tasks, full stores, default controls
function reset(participants) {
	players.playersInit();
	for (let i = 1; i < participants; i++) players.playersAdd(players.PLAYER_BOT);
	sim.simSetSpawnRate(0);
	sim.simInit();
	sim.simBalls.count = 0;
	sim.simFillDist();
	tasks.tasksInit();
	force.forceSetCost(force.FORCE_COST);
	force.forceInit();
	// one case hands the controls to a second participant, so every case starts with them back on the first
	input.inputSetPlayer(0);
	input.inputSetMagnitude(0.6);
	input.inputSetDirection(1);
	input.inputRelease();
}

function step(n) {
	for (let i = 0; i < n; i++) sim.simStep(DT);
}

// the stub window only records listeners, so keys are delivered by calling each one with a plain event
function win(type, code, target, prevented) {
	const e = {
		code,
		target: target || { tagName: 'DIV' },
		defaultPrevented: prevented === true,
		preventDefault() { this.defaultPrevented = true; }
	};
	for (const fn of stubs.listeners[type] || []) fn(e);
	return e;
}

function el(id) {
	return stubs.els[id];
}

// the loader runs every page script, and main.js boots the page in the browser, so boot already ran
check('boot: one store row per participant', force.forceReadout.rows.length === players.players.count);
check('boot: the store starts full', force.forceState.energy[0] === CAP);
check('boot: strength starts at the slider value', near(force.forceState.mag[0], input.INPUT_MAG_START, 1e-6)
	&& el('force-mag').value === '60');
check('boot: the pad names the direction it holds', el('force-pad').textContent === 'Hold to push down');

reset(1);
const idleY = sim.simAperture.y;
step(10);
check('idle: the hole holds still without a request', sim.simAperture.y === idleY && sim.simAperture.drive === 0);

reset(1);
input.inputSetMagnitude(0.5);
input.inputActivate();
sim.simStep(DT);
const pushY = sim.simAperture.y;
check('push: a funded request drives the hole down', sim.simAperture.drive === 0.5
	&& near(pushY, 400 + 0.5 * sim.simAperture.speed * DT, 1e-6));

reset(1);
input.inputSetDirection(-1);
input.inputSetMagnitude(1);
input.inputActivate();
sim.simStep(DT);
check('pull: the opposite direction drives the hole up', sim.simAperture.drive === -1
	&& near(sim.simAperture.y, 400 - sim.simAperture.speed * DT, 1e-6));
check('direction: the pad and the radios follow the choice', el('force-pad').textContent === 'Hold to pull up'
	&& el('force-pull').checked === true && el('force-push').checked === false);

reset(1);
input.inputActivate();
step(5);
const spent = force.forceState.energy[0];
const beforeRelease = sim.simAperture.y;
input.inputRelease();
step(5);
check('release: stops on the same step with no residual momentum',
	sim.simAperture.y === beforeRelease && sim.simAperture.drive === 0);
check('release: the store stops paying and starts refilling', force.forceState.energy[0] > spent);

reset(2);
force.forceSetDirection(0, 1);
force.forceSetDirection(1, 1);
force.forceSetMagnitude(0, 1);
force.forceSetMagnitude(1, 1);
force.forceHold(0, true);
force.forceHold(1, true);
step(1);
check('speed cap: two full requests move the hole no faster than one',
	sim.simAperture.drive === 1 && near(sim.simAperture.y, 400 + sim.simAperture.speed * DT, 1e-6));

reset(2);
force.forceSetDirection(0, 1);
force.forceSetDirection(1, -1);
force.forceSetMagnitude(0, 1);
force.forceSetMagnitude(1, 1);
force.forceHold(0, true);
force.forceHold(1, true);
// below capacity, so no recharge is lost to the clamp and the bill per step is exactly cost minus source
force.forceState.energy[0] = 50;
force.forceState.energy[1] = 50;
const opposeY = sim.simAperture.y;
step(12);
const opposeBill = 50 + 12 * (force.FORCE_RECHARGE - force.FORCE_COST) * DT;
check('opposing: equal requests cancel the movement', sim.simAperture.y === opposeY && sim.simAperture.drive === 0);
check('opposing: both stores still pay', near(force.forceState.energy[0], opposeBill, 1e-3)
	&& near(force.forceState.energy[1], opposeBill, 1e-3));

reset(1);
input.inputSetMagnitude(1);
input.inputActivate();
force.forceState.energy[0] = 0.1;
sim.simStep(DT);
check('energy: a request is scaled down to what the store can pay',
	sim.simAperture.drive > 0.85 && sim.simAperture.drive < 0.9 && force.forceState.energy[0] === 0);

reset(1);
input.inputSetMagnitude(0.5);
input.inputActivate();
force.forceState.energy[0] = 0;
sim.simStep(DT);
// an empty store still gets the source rate for that step, so it can ask for the share it can fund
check('energy: an empty store moves only at the rate it refills', near(sim.simAperture.drive,
	force.FORCE_RECHARGE / force.FORCE_COST, 1e-6) && sim.simAperture.y > 400
	&& force.forceState.energy[0] === 0);

reset(1);
force.forceSetCost(0);
input.inputSetMagnitude(0.5);
input.inputActivate();
step(60);
check('zero cost: free movement at full strength', sim.simAperture.drive === 0.5 && force.forceState.energy[0] === CAP);

reset(1);
input.inputSetMagnitude(1);
input.inputActivate();
force.forceState.energy[0] = 50;
step(120);
check('recharge: one held second drains cost minus the source rate',
	near(force.forceState.energy[0], 50 + 120 * (force.FORCE_RECHARGE - force.FORCE_COST) * DT, 1e-3));
input.inputRelease();
step(1200);
check('recharge: an idle store refills and clamps at capacity', force.forceState.energy[0] === CAP);

reset(1);
sim.simAperture.y = sim.simField.h - sim.simAperture.size / 2;
force.forceSetDirection(0, 1);
force.forceSetMagnitude(0, 1);
force.forceHold(0, true);
const endEnergy = force.forceState.energy[0];
step(60);
check('endpoint: the hole stops at the track end', sim.simAperture.y === sim.simField.h - sim.simAperture.size / 2
	&& sim.simAperture.drive === 1);
check('endpoint: a blocked request still pays its bill', force.forceState.energy[0] < endEnergy);

reset(1);
el('force-pad').dispatch('pointerdown', { pointerId: 1 });
check('pad: pressing activates the request', force.forceState.held[0] === 1);
step(3);
const padY = sim.simAperture.y;
el('force-pad').dispatch('pointerup', { pointerId: 1 });
step(1);
check('pad: releasing stops the request', force.forceState.held[0] === 0 && sim.simAperture.drive === 0
	&& sim.simAperture.y === padY);

reset(1);
el('force-pad').dispatch('pointerdown', { pointerId: 1 });
el('force-pad').dispatch('pointercancel', { pointerId: 1 });
check('pad: pointer cancellation releases the request', force.forceState.held[0] === 0);

reset(1);
el('force-pad').dispatch('pointerdown', { pointerId: 1 });
el('force-pad').dispatch('lostpointercapture', { pointerId: 1 });
check('pad: losing the pointer capture releases the request', force.forceState.held[0] === 0);

reset(1);
el('force-pad').dispatch('pointerdown', { pointerId: 1 });
for (const fn of stubs.listeners.blur || []) fn();
check('pad: focus loss releases the request', force.forceState.held[0] === 0);

reset(1);
const magStart = force.forceState.mag[0];
el('force-panel').dispatch('wheel', { deltaY: -100 });
check('wheel: a notch raises the strength and the slider follows',
	near(force.forceState.mag[0], magStart + input.INPUT_MAG_STEP, 1e-6) && el('force-mag').value === '65');
el('force-panel').dispatch('wheel', { deltaY: 100 });
el('force-panel').dispatch('wheel', { deltaY: 100 });
check('wheel: the other direction lowers it', near(force.forceState.mag[0], magStart - input.INPUT_MAG_STEP, 1e-6)
	&& el('force-mag').value === '55');

reset(1);
el('force-mag').value = '30';
el('force-mag').dispatch('input');
check('slider: sets the strength the funding reads', near(force.forceState.mag[0], 0.3, 1e-6));

reset(1);
win('keydown', 'Space');
check('keyboard: holding space activates', force.forceState.held[0] === 1);
win('keyup', 'Space');
check('keyboard: releasing space stops it', force.forceState.held[0] === 0);
win('keyup', 'Space');
win('keydown', 'Space', { tagName: 'INPUT' });
check('keyboard: a key a form control needs stays with it', force.forceState.held[0] === 0);
const consumed = win('keydown', 'Space', { tagName: 'LI' }, true);
check('keyboard: a key another control consumed is not a hole control',
	force.forceState.held[0] === 0 && consumed.defaultPrevented === true);
win('keydown', 'Space');
win('keydown', 'ArrowUp');
check('keyboard: arrows pick the direction', force.forceState.dir[0] === -1
	&& el('force-pull').checked === true && el('force-pad').textContent === 'Hold to pull up');
win('keydown', 'ArrowDown');
check('keyboard: the other arrow turns it back', force.forceState.dir[0] === 1);
win('keyup', 'Space');

// two stores pay for what each asked for, not for the combined request
reset(2);
force.forceSetDirection(0, 1);
force.forceSetDirection(1, 1);
force.forceSetMagnitude(0, 1);
force.forceSetMagnitude(1, 0.25);
force.forceHold(0, true);
force.forceHold(1, true);
// start below capacity so the source rate is not lost to the clamp
force.forceState.energy[0] = 60;
force.forceState.energy[1] = 60;
step(8);
check('stores: a weak request costs a quarter of a full one',
	near(force.forceState.energy[0], 60 + 8 * (force.FORCE_RECHARGE - force.FORCE_COST) * DT, 1e-3)
	&& near(force.forceState.energy[1], 60 + 8 * (force.FORCE_RECHARGE - force.FORCE_COST * 0.25) * DT, 1e-3));

// handing the controls to another participant drops the held request instead of moving it along
reset(2);
input.inputActivate();
step(2);
input.inputSetPlayer(1);
// the drive still reads the step that was already funded, so the very next one is what must be empty
sim.simStep(DT);
check('switch: the previous participant stops paying', force.forceState.held[0] === 0
	&& force.forceState.held[1] === 0 && sim.simAperture.drive === 0);
input.inputActivate();
check('switch: the new participant takes over the same controls', force.forceState.held[1] === 1
	&& force.forceState.held[0] === 0 && input.inputState.player === 1);
input.inputRelease();
check('switch: the strength and direction follow the controls',
	near(force.forceState.mag[1], input.inputState.mag, 1e-6) && force.forceState.dir[1] === input.inputState.dir);

// the seams gui.1 will drive: cost and store size are settings, not constants baked into funding
reset(1);
force.forceSetCapacity(40);
force.forceInit();
check('capacity: a smaller store starts full at the new size',
	force.forceState.energy[0] === 40 && near(force.forceView(0).share, 1, 1e-6));
force.forceSetCapacity(20);
check('capacity: shrinking clamps what a participant still has',
	force.forceState.energy[0] === 20 && near(force.forceView(0).share, 1, 1e-6));
force.forceSetCost(15);
force.forceState.energy[0] = 10;
input.inputSetMagnitude(1);
input.inputActivate();
step(12);
check('cost: funding reads the cost setting', near(force.forceState.energy[0],
	10 + 12 * (force.FORCE_RECHARGE - 15) * DT, 1e-3));
input.inputRelease();
force.forceSetCapacity(CAP);

// the view is what a status panel or a bot reads: one object, no reaching into the store arrays
reset(1);
// the slider works in whole percent, so 75 survives its round trip exactly while 0.6 would not
input.inputSetMagnitude(0.75);
input.inputSetDirection(-1);
input.inputActivate();
const view = force.forceView(0);
check('view: reports the request and the share of the store left',
	view.held === true && view.dir === -1 && near(view.mag, 0.75, 1e-6)
	&& near(view.share, force.forceState.energy[0] / CAP, 1e-6) && near(view.energy, force.forceState.energy[0], 1e-6));
input.inputRelease();
check('view: a released request reads as not held', force.forceView(0).held === false);

reset(1);
force.forceState.energy[0] = 40;
force.forcePaint();
check('readout: shows the whole energy and its share of the store',
	force.forceReadout.rows[0].num.textContent === '40'
	&& force.forceReadout.rows[0].fill.style.width === '40%');
reset(2);
check('readout: one row per participant', force.forceReadout.rows.length === 2);

// a quarter second of holding must cost and move the same however the frames are cut
const ROOM = sim.simAperture;
reset(1);
input.inputSetMagnitude(0.5);
input.inputActivate();
sim.simAdvance(0.25);
const coarseY = ROOM.y;
const coarseEnergy = force.forceState.energy[0];
reset(1);
input.inputSetMagnitude(0.5);
input.inputActivate();
for (let i = 0; i < 30; i++) sim.simAdvance(DT);
check('frame rate: one advancing call and thirty match',
	near(ROOM.y, coarseY, 1e-4) && near(force.forceState.energy[0], coarseEnergy, 1e-4));

console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
