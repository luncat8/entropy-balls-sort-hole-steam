// owns: force, energy, panel, friction and input smoke checks
// edit for: funding, settings, controls and participant display

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs, document } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const canvas = apis['canvas.js'];
const force = apis['force.js'];
const panels = apis['forcepanel.js'];
const input = apis['input.js'];
const settings = apis['settings.js'];
const players = apis['players.js'];
const tasks = apis['tasks.js'];
const goal = apis['goalview.js'];
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

function near(a, b, tol = 1e-5) {
	return Math.abs(a - b) <= tol;
}

function step(n) {
	for (let i = 0; i < n; i++) sim.simStep(DT);
}

function row(id = 0) {
	return panels.forcePanels.rows[id];
}

function win(type, code, target, prevented) {
	const e = {
		code, target: target || { tagName: 'DIV' }, defaultPrevented: prevented === true,
		preventDefault() { this.defaultPrevented = true; }
	};
	for (const fn of stubs.listeners[type] || []) fn(e);
	return e;
}

function reset(participants = 1) {
	input.inputRelease();
	goal.goalClose();
	players.playersInit(participants === 2 ? 2 : 1);
	force.forceSetCapacity(CAP);
	force.forceSetCost(force.FORCE_COST);
	force.forceInit();
	settings.settingsSetFriction(false, false);
	sim.simSetSpawnRate(0);
	sim.simInit();
	sim.simBalls.count = 0;
	sim.simFillDist();
	tasks.tasksInit();
	for (let id = 0; id < players.players.count; id++) tasks.tasksAttach(id);
	input.inputRebind();
	input.inputState.value.fill(input.INPUT_FORCE_START);
	for (let id = 0; id < players.players.count; id++) input.inputSetValue(id, input.INPUT_FORCE_START);
	stubs.win.devicePixelRatio = 1;
	stubs.els.canv.clientWidth = 1200;
	stubs.els.canv.clientHeight = 800;
	canvas.canvasResize();
	panels.forcePanelPaint();
}

panels.forcePanelPaint();
check('boot: one panel and a full store', panels.forcePanels.rows.length === 1 && row().energyNumber.textContent === '100');
check('boot: signed slider is centered at zero and starts down 60%', row().slider.min === '-100' && row().slider.max === '100'
	&& row().slider.value === '60' && row().thumb.style.top === '80%' && row().selected.textContent === '↓ 60% selected');
check('boot: no force and a gross two-second cost preview', row().status.textContent === 'No force'
	&& row().fill.style.height === '100%' && row().usage.style.height === '30%' && row().usage.style.bottom === '70%'
	&& row().cost.textContent === '−30');
check('boot: slider and energy expose accessible values', row().slider.getAttribute('aria-orientation') === 'vertical'
	&& row().slider.getAttribute('aria-valuetext') === 'Down 60%' && row().meter.getAttribute('aria-valuenow') === '100');

reset();
const idleY = sim.simAperture.y;
step(10);
check('idle: selection alone does not move or spend', sim.simAperture.y === idleY
	&& sim.simAperture.drive === 0 && force.forceState.energy[0] === CAP);

reset();
const slider = row().slider;
slider.dispatch('pointerdown', { pointerId: 1, button: 0, clientY: 41.5 });
check('slider: upper half applies upward force on press', force.forceState.held[0] === 1
	&& force.forceState.dir[0] === -1 && near(force.forceState.mag[0], 0.5) && slider.hasPointerCapture(1));
step(1);
check('slider: upward request moves the hole up', sim.simAperture.drive === -0.5
	&& near(sim.simAperture.y, 400 - 0.5 * sim.simAperture.speed * DT));
slider.dispatch('pointermove', { pointerId: 1, clientY: 104.5 });
check('slider: dragging through zero reverses direction', force.forceState.dir[0] === 1
	&& near(force.forceState.mag[0], 0.5) && row().slider.value === '50');
slider.dispatch('pointerup', { pointerId: 99 });
check('slider: unrelated pointer does not release', force.forceState.held[0] === 1);
slider.dispatch('pointerup', { pointerId: 1 });
const releasedY = sim.simAperture.y;
step(1);
check('slider: release stops without losing the selection', force.forceState.held[0] === 0
	&& sim.simAperture.drive === 0 && sim.simAperture.y === releasedY && row().slider.value === '50');

reset();
row().slider.dispatch('pointerdown', { pointerId: 1, button: 2, clientY: 10 });
check('slider: secondary mouse button does not activate', force.forceState.held[0] === 0);
row().slider.dispatch('pointerdown', { pointerId: 1, clientY: 73 });
force.forceState.energy[0] = 50;
step(1);
check('slider: green center is zero force and costs nothing', force.forceState.dir[0] === 0
	&& sim.simAperture.drive === 0 && force.forceState.energy[0] > 50);
row().slider.dispatch('pointercancel', { pointerId: 1 });
check('slider: pointer cancellation releases', force.forceState.held[0] === 0);
row().slider.dispatch('pointerdown', { pointerId: 2, clientY: 10 });
row().slider.dispatch('lostpointercapture', { pointerId: 2 });
check('slider: lost capture releases', force.forceState.held[0] === 0);
row().slider.dispatch('pointerdown', { pointerId: 3, clientY: 10 });
win('blur');
check('slider: window blur releases and drops capture', force.forceState.held[0] === 0 && !row().slider.hasPointerCapture(3));
row().slider.dispatch('pointerdown', { pointerId: 4, clientY: 10 });
document.hidden = true;
for (const fn of stubs.documentListeners.visibilitychange || []) fn();
document.hidden = false;
check('slider: hiding the document releases', force.forceState.held[0] === 0);

reset();
const field = stubs.els.canv;
field.dispatch('pointerdown', { pointerId: 10, button: 0, clientY: 100 });
check('field: pointer above the hole uses slider magnitude but points up', force.forceState.held[0] === 1
	&& force.forceState.dir[0] === -1 && near(force.forceState.mag[0], 0.6) && input.inputState.value[0] === 60);
step(1);
field.dispatch('pointermove', { pointerId: 10, clientY: 700 });
check('field: moving the held pointer below the hole reverses the request', force.forceState.dir[0] === 1);
field.dispatch('pointerup', { pointerId: 10 });
step(1);
check('field: release stops and restores slider direction', force.forceState.held[0] === 0 && sim.simAperture.drive === 0
	&& force.forceState.dir[0] === 1);

reset();
force.forceState.energy[0] = 50;
field.dispatch('pointerdown', { pointerId: 11, clientY: 300 });
step(100);
const targetY = sim.simAperture.y;
const targetEnergy = force.forceState.energy[0];
step(40);
check('field: reaching a stationary target settles without hunting or spending', Math.abs(targetY - 300) < 3
	&& sim.simAperture.y === targetY && sim.simAperture.drive === 0 && force.forceState.dir[0] === 0
	&& force.forceState.energy[0] > targetEnergy);
field.dispatch('pointercancel', { pointerId: 11 });
check('field: cancellation releases', force.forceState.held[0] === 0);
field.dispatch('pointerdown', { pointerId: 12, clientY: 700 });
field.dispatch('lostpointercapture', { pointerId: 12 });
check('field: lost capture releases', force.forceState.held[0] === 0);

reset();
row().slider.dispatch('pointerdown', { pointerId: 1, clientY: 136 });
field.dispatch('pointerdown', { pointerId: 2, clientY: 100 });
row().slider.dispatch('pointerup', { pointerId: 1 });
check('multitouch: releasing the slider leaves a held field request active', force.forceState.held[0] === 1
	&& force.forceState.dir[0] === -1 && near(force.forceState.mag[0], 1));
field.dispatch('pointerup', { pointerId: 2 });
check('multitouch: last release stops the request', force.forceState.held[0] === 0);
row().slider.dispatch('pointerdown', { pointerId: 3, clientY: 136 });
field.dispatch('pointerdown', { pointerId: 4, clientY: 100 });
field.dispatch('pointerup', { pointerId: 4 });
check('multitouch: releasing the field returns to the held slider direction', force.forceState.held[0] === 1
	&& force.forceState.dir[0] === 1);
row().slider.dispatch('pointerup', { pointerId: 3 });

reset();
stubs.win.devicePixelRatio = 2;
field.clientWidth = 1000;
field.clientHeight = 1000;
canvas.canvasResize();
check('field: CSS pixels map through letterboxing and device pixel ratio', near(canvas.canvasFieldY(500), 400)
	&& near(canvas.canvasFieldY(350), 220));
field.dispatch('pointerdown', { pointerId: 1, clientY: 350 });
check('field: transformed pointer position chooses the correct direction', force.forceState.dir[0] === -1);
field.dispatch('pointerup', { pointerId: 1 });

reset();
const wheelUp = field.dispatch('wheel', { deltaY: -100 });
check('wheel: up moves the signed slider up without applying force', wheelUp.defaultPrevented
	&& row().slider.value === '55' && force.forceState.held[0] === 0);
row().panel.dispatch('wheel', { deltaY: 100 });
check('wheel: down over the panel moves it down', row().slider.value === '60');
input.inputSetValue(0, -100);
field.dispatch('wheel', { deltaY: -1 });
check('wheel: selection clamps at the upper limit', input.inputState.value[0] === -100);
input.inputSetValue(0, 100);
field.dispatch('wheel', { deltaY: 1 });
check('wheel: selection clamps at the lower limit', input.inputState.value[0] === 100);
row().slider.value = '-25';
row().slider.dispatch('input');
check('slider: native input changes selection without applying', input.inputState.value[0] === -25
	&& force.forceState.dir[0] === -1 && near(force.forceState.mag[0], 0.25) && force.forceState.held[0] === 0);

reset();
win('keydown', 'ArrowUp', row().slider);
check('keyboard: up moves the focused vertical slider up', input.inputState.value[0] === 55 && force.forceState.held[0] === 0);
win('keydown', 'Space', row().slider);
check('keyboard: holding space applies the selected force', force.forceState.held[0] === 1);
win('keyup', 'Space', { tagName: 'INPUT' });
check('keyboard: keyup releases even if focus changed', force.forceState.held[0] === 0);
win('keydown', 'Space', { tagName: 'INPUT' });
win('keydown', 'ArrowDown', { tagName: 'BUTTON' });
win('keydown', 'Space', { tagName: 'LI' }, true);
const summaryKey = win('keydown', 'Space', { tagName: 'SUMMARY' });
check('keyboard: form controls and consumed events keep their keys', force.forceState.held[0] === 0
	&& input.inputState.value[0] === 55 && !summaryKey.defaultPrevented);

reset(2);
force.forceSetDirection(0, 1);
force.forceSetDirection(1, 1);
force.forceSetMagnitude(0, 1);
force.forceSetMagnitude(1, 1);
force.forceHold(0, true);
force.forceHold(1, true);
step(1);
check('funding: combined force is clamped to full speed', sim.simAperture.drive === 1);

reset(2);
force.forceSetDirection(0, 1);
force.forceSetDirection(1, -1);
force.forceSetMagnitude(0, 1);
force.forceSetMagnitude(1, 1);
force.forceHold(0, true);
force.forceHold(1, true);
force.forceState.energy[0] = 50;
force.forceState.energy[1] = 50;
step(12);
const bill = 50 + 12 * (force.FORCE_RECHARGE - force.FORCE_COST) * DT;
check('funding: opposite requests cancel but both pay', sim.simAperture.y === 400 && sim.simAperture.drive === 0
	&& near(force.forceState.energy[0], bill, 1e-3) && near(force.forceState.energy[1], bill, 1e-3));

reset();
input.inputSetValue(0, 100);
win('keydown', 'Space');
force.forceState.energy[0] = 0.1;
step(1);
check('funding: a low store scales the actual applied request', sim.simAperture.drive > 0.85 && sim.simAperture.drive < 0.9
	&& force.forceState.energy[0] === 0 && near(force.forceView(0).applied, sim.simAperture.drive));
win('keyup', 'Space');
check('funding: release clears the applied view immediately', force.forceView(0).applied === 0);

reset();
force.forceSetCost(0);
input.inputSetValue(0, 50);
win('keydown', 'Space');
step(60);
check('funding: zero cost allows full requested movement', sim.simAperture.drive === 0.5 && force.forceState.energy[0] === CAP);

reset();
input.inputSetValue(0, 100);
win('keydown', 'Space');
force.forceState.energy[0] = 50;
step(120);
check('funding: a held second consumes cost less recharge', near(force.forceState.energy[0],
	50 + (force.FORCE_RECHARGE - force.FORCE_COST), 1e-3));
win('keyup', 'Space');
step(1200);
check('funding: idle energy recharges to capacity', force.forceState.energy[0] === CAP);

reset();
sim.simAperture.y = sim.simField.h - sim.simAperture.size / 2;
input.inputSetValue(0, 100);
win('keydown', 'Space');
step(60);
check('funding: blocked force still costs energy', sim.simAperture.y === sim.simField.h - sim.simAperture.size / 2
	&& sim.simAperture.velocity === 0 && force.forceState.energy[0] < CAP);

reset(1);
players.playersAdd(players.PLAYER_BOT);
force.forceInit();
panels.forcePanelPaint();
force.forceSetDirection(1, -1);
force.forceSetMagnitude(1, 0.75);
force.forceHold(1, true);
force.forceState.energy[1] = 50;
step(1);
panels.forcePanelPaint();
check('panels: each participant has a labeled panel and bots are read-only', panels.forcePanels.rows.length === 2
	&& row(1).panel.getAttribute('aria-label') === 'Player 2 force' && row(1).slider.disabled);
check('panels: bot selection and actual applied force are visible', row(1).slider.value === '-75'
	&& row(1).status.textContent === 'Applying ↑ 75%' && row(1).cost.textContent === '−37.5');
check('panels: bot has its own energy and red two-second segment', row(1).energyNumber.textContent === '50'
	&& row(1).usage.style.height === '38%' && row(1).usage.style.bottom === '12%');
force.forceClear(1);
panels.forcePanelPaint();
check('panels: an idle bot is not shown applying force', row(1).status.textContent === 'No force');

reset();
players.players.type[0] = players.PLAYER_BOT;
force.forceSetDirection(0, -1);
force.forceSetMagnitude(0, 0.75);
force.forceHold(0, true);
step(1);
panels.forcePanelPaint();
field.dispatch('pointerdown', { pointerId: 20, clientY: 700 });
win('keydown', 'Space');
check('panels: a bot in the first slot retains its own force and ignores human controls', row().slider.disabled
	&& row().status.textContent === 'Applying ↑ 75%' && force.forceState.dir[0] === -1 && force.forceState.held[0] === 1);

reset();
force.forceSetCapacity(40);
force.forceState.energy[0] = 15;
input.inputSetValue(0, 100);
panels.forcePanelPaint();
check('panels: usage segment is capped to energy actually in the store', row().fill.style.height === '38%'
	&& row().usage.style.height === '38%' && row().usage.style.bottom === '0%' && row().cost.textContent === '−50');
force.forceSetCapacity(0);
panels.forcePanelPaint();
check('panels: zero capacity has an empty, finite meter', row().fill.style.height === '0%'
	&& row().usage.style.height === '0%' && row().meter.getAttribute('aria-valuenow') === '0');

reset();
force.forceSetCapacity(40);
check('stores: the first participant starts at the current capacity', force.forceState.energy[0] === 40);
force.forceSetCapacity(80);
settings.settingsSetHumans(2, false);
force.forceInit();
panels.forcePanelPaint();
check('stores: enabling player 2 gives it a full store at the current capacity', force.forceState.energy[0] === 80
	&& force.forceState.energy[1] === 80 && row(1).energyNumber.textContent === '80');
settings.settingsSetHumans(1, false);

reset(2);
check('two humans: player 1 keeps the pointer and player 2 takes the keys',
	!row(0).slider.disabled && !row(1).slider.disabled && row(0).channel === 'mouse' && row(1).channel === 'keys'
	&& row(1).panel.getAttribute('data-channel') === 'keys');
win('keydown', 'ArrowDown');
check('two humans: arrows move only player 2 and apply nothing', input.inputState.value[1] === 65
	&& input.inputState.value[0] === input.INPUT_FORCE_START && force.forceState.held[1] === 0);
win('keydown', 'ArrowRight');
win('keydown', 'ArrowRight');
check('two humans: holding the apply key keeps one request, not a toggle', force.forceState.held[1] === 1
	&& force.forceState.dir[1] === 1 && near(force.forceState.mag[1], 0.65) && force.forceState.held[0] === 0);
field.dispatch('pointerdown', { pointerId: 30, clientY: 100 });
step(1);
check('two humans: both requests fund from separate stores', force.forceState.held[0] === 1
	&& force.forceState.energy[0] < CAP && force.forceState.energy[1] < CAP
	&& force.forceView(0).applied !== force.forceView(1).applied);
field.dispatch('pointerup', { pointerId: 30 });
win('keyup', 'ArrowRight');
check('two humans: releasing one player leaves the other untouched', force.forceState.held[0] === 0
	&& force.forceState.held[1] === 0);
win('keydown', 'ArrowRight');
row(0).slider.dispatch('pointerdown', { pointerId: 31, clientY: 10 });
win('keyup', 'ArrowRight');
check('two humans: player 1 pointer input does not steal player 2 keys and keyup always releases',
	force.forceState.held[0] === 1 && force.forceState.held[1] === 0
	&& input.inputState.value[1] === 65 && force.forceState.dir[0] === -1);
row(0).slider.dispatch('pointerup', { pointerId: 31 });
win('keydown', 'ArrowRight');
win('keydown', 'Space');
check('two humans: Space is player 1 only, so player 2 holds the two-human apply key',
	force.forceState.held[0] === 0 && force.forceState.held[1] === 1 && input.inputApplyKey() === 'ArrowRight');
win('blur');
check('two humans: blur releases both players', force.forceState.held[0] === 0 && force.forceState.held[1] === 0);

reset(1);
check('one human: arrows and Space stay on player 1', input.inputApplyKey() === 'Space'
	&& row().channel === 'mouse' && panels.forcePanels.rows.length === 1);
check('panels: enabling player 2 rebuilds both panels with their own channel label',
	row().kind === 'Mouse' && row().panel.getAttribute('data-channel') === 'mouse');
settings.settingsSetHumans(2, false);
panels.forcePanelPaint();
check('panels: the second pointer-free channel is labeled and keeps its own slider reachable',
	row(1).kind === 'Arrows' && row(1).panel.getAttribute('data-hint') === 'Arrows + Right'
	&& row(1).slider.className.indexOf('force-slider-keys') >= 0 && !row(1).slider.disabled);
settings.settingsSetHumans(1, false);
check('settings: turning the second player off leaves one human with the arcade controls',
	players.players.count === 1 && row().kind === 'Mouse' && input.inputApplyKey() === 'Space');
win('keydown', 'ArrowUp');
check('one human: up arrow keeps adjusting the single slider', input.inputState.value[0] === 55);
win('keydown', 'Space');
check('one human: space applies the selected force', force.forceState.held[0] === 1);
win('keyup', 'Space');

/*switch check*/

reset();
input.inputSetValue(0, 50);
win('keydown', 'Space');
sim.simAdvance(0.25);
const coarseY = sim.simAperture.y;
const coarseEnergy = force.forceState.energy[0];
reset();
input.inputSetValue(0, 50);
win('keydown', 'Space');
for (let i = 0; i < 30; i++) sim.simAdvance(DT);
check('timing: equivalent frame splits produce equal motion and billing', near(sim.simAperture.y, coarseY, 1e-4)
	&& near(force.forceState.energy[0], coarseEnergy, 1e-4));

reset();
input.inputSetValue(0, 50);
win('keydown', 'Space');
step(1);
const noFrictionSpeed = sim.simAperture.velocity;
reset();
stubs.els['settings-friction'].checked = true;
stubs.els['settings-friction'].dispatch('change');
input.inputSetValue(0, 25);
win('keydown', 'Space');
step(1);
const slowFriction = Math.abs(sim.simAperture.friction);
const slowSpeed = sim.simAperture.velocity;
input.inputSetValue(0, 50);
step(1);
check('friction: enabled resistance opposes motion and grows with speed', settings.settingsState.friction
	&& sim.simAperture.friction < 0 && Math.abs(sim.simAperture.friction) > slowFriction
	&& sim.simAperture.velocity > slowSpeed && sim.simAperture.velocity < noFrictionSpeed);
win('keyup', 'Space');
step(1);
check('friction: releasing stops without residual or reversed movement', sim.simAperture.velocity === 0
	&& sim.simAperture.friction === 0 && sim.simAperture.drive === 0);
check('settings: two humans round-trips through the URL and the default stays out',
	settings.settingsFromSearch('').humans === 1 && settings.settingsFromSearch('?humans=2').humans === 2
	&& settings.settingsFromSearch('?humans=9').humans === 1
	&& settings.settingsEncode('humans', 1) === undefined && settings.settingsEncode('humans', 2) === '2');
settings.settingsSetFriction(false, false);
stubs.win.location = new URL('http://game.test/index.html');
settings.settingsSetHumans(2, true);
check('settings: the two-human mode is written next to the friction key', stubs.win.location.search === '?humans=2');
settings.settingsSetFriction(true, true);
check('settings: both keys share one URL write', stubs.win.location.search === '?humans=2&friction=1');
settings.settingsSetHumans(1, false);
settings.settingsSetFriction(false, false);
check('friction: search decoding requires the explicit enabled value', settings.settingsFromSearch('?friction=1').friction
	&& !settings.settingsFromSearch('?friction=0').friction && !settings.settingsFromSearch('?friction=invalid').friction);

stubs.win.location = new URL('http://game.test/index.html?other=keep#field');
settings.settingsSetFriction(true, true);
check('settings: friction persists in URL without losing other parameters or hash', stubs.win.location.search === '?other=keep&friction=1'
	&& stubs.win.location.hash === '#field' && stubs.els['settings-url-wrap'].hidden);
settings.settingsSetFriction(false, true);
check('settings: default friction is omitted from the URL', stubs.win.location.search === '?other=keep');
stubs.win.location = new URL('file:///tmp/game/index.html?other=keep#field');
const replaceState = stubs.win.history.replaceState;
stubs.win.history.replaceState = () => { throw new Error('file URL blocked'); };
settings.settingsSetFriction(true, true);
check('settings: rejected file URL updates expose a copyable restoring URL', !stubs.els['settings-url-wrap'].hidden
	&& stubs.els['settings-url'].value === 'file:///tmp/game/index.html?other=keep&friction=1#field');
stubs.win.history.replaceState = replaceState;

console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
