// owns: active game mode, lifecycle, hook registration and mode HUD/help state
// edit for: mode list, mode-specific boot/reset, help copy

const MODE_NAMES = ['standard', 'territory', 'ball-gun'];
const MODE_HELP = [
	'',
	'Territory · P1 red moves its gun with the pointer, P2 blue with ↑↓. Hold the middle mouse button or → to pull neutral balls; left click or Space pushes. Touch: hold pulls, tap pushes. Every color crosses the top gate; a painted region is a hole only for its own color. Grow your wall share.',
	'Ball gun · P1 aims with the pointer: hold the middle mouse button to pull a ball, left click to push it. P2 moves the hole with ↑↓ and holds →. A push predicted to pass the hole is refused; aim again. Touch: hold pulls, tap pushes.'
];
const modeState = {
	active: 'standard',
	ready: false,
	select: null,
	hud: [null, null],
	help: null
};

function modeNormalize(name) {
	return MODE_NAMES.indexOf(name) < 0 ? 'standard' : name;
}

function modeIs(name) {
	return modeState.active === name;
}

function modeStandard() {
	return modeState.active === 'standard';
}

function modeInit() {
	modeState.select = $('settings-mode');
	modeState.hud[0] = $('territory-hud');
	modeState.hud[1] = $('gun-hud');
	modeState.help = $('mode-help');
	modeState.select.addEventListener('change', modeSelectChanged);
	document.body.dataset.mode = 'standard';
	modeState.active = 'standard';
	modeState.ready = true;
	modecolorInit();
	modeInputInit();
	statusSetMode('standard');
	scoreboardSetMode('standard');
	modePaintChrome();
}

function modeSelectChanged() {
	settingsSetMode(modeState.select.value, true);
}

function modePaintChrome() {
	const active = modeState.active;
	const index = MODE_NAMES.indexOf(active);
	modeState.select.value = active;
	document.body.dataset.mode = active;
	modeState.hud[0].hidden = active !== 'territory';
	modeState.hud[1].hidden = active !== 'ball-gun';
	modeState.help.textContent = MODE_HELP[index];
	modeState.help.hidden = index === 0;
}

function modeReleaseAll() {
	questReleaseAll();
	goalClose();
	inputRelease();
	modeInputCancel();
	territoryRelease();
	gunRelease();
}

function modeSet(name) {
	const next = modeNormalize(name);
	const prev = modeState.active;
	if (modeState.ready && next === prev) return false;
	modeState.active = next;
	modeReleaseAll();
	simSetModeHook(null);
	trajSetModeHook(null);
	canvasSetModeHook(null);
	simSetModeSpeed(1);
	simSetModeApertureSpeed(1);
	inputSetEnabled(true);
	inputSetPointerEnabled(true);
	modeInputSetHook(null);
	modePaintChrome();
	statusSetMode(next);
	scoreboardSetMode(next);
	if (next === 'standard') {
		if (prev !== 'standard') {
			settingsRebuild();
			simInit();
		}
		questRepaint();
		return true;
	}
	if (next === 'territory') {
		playersInit(2, 0);
		forceInit();
		inputRebind();
		inputSetEnabled(false);
		simSetModeHook(territorySimHook);
		trajSetModeHook(territoryTrajHook);
		canvasSetModeHook(territoryView);
		modeInputSetHook(territoryInput);
		simInit();
		territoryInit();
		territorySetRooms(settingsState.rooms);
		return true;
	}
	playersInit(2, 0);
	forceInit();
	inputRebind();
	inputSetPointerEnabled(false);
	simSetModeSpeed(2);
	simSetModeApertureSpeed(0.25);
	canvasSetModeHook(gunView);
	modeInputSetHook(gunInput);
	simInit();
	gunInit();
	return true;
}

function modeSetRooms(on) {
	territorySetRooms(on);
}

// one control boundary: the standard field keeps its two channels, a mode owns the rest
function modeControlStep(dt) {
	if (modeStandard()) {
		inputStep();
		botStep(dt);
		return;
	}
	modeInputStep(dt);
	if (modeIs('territory')) territoryControlStep(dt);
	else gunStep(dt);
}

function modeFrame() {
	if (modeIs('territory')) territoryHudPaint();
	else if (modeIs('ball-gun')) gunHudPaint();
}

// a new round resets play, so mode-owned state starts from its deterministic seed again
function modeRoundReset() {
	if (modeIs('territory')) territoryInit();
	else if (modeIs('ball-gun')) gunInit();
}

if (typeof module !== 'undefined') module.exports = {
	modeState, modeInit, modeSet, modeSetRooms, modeControlStep, modeFrame, modeRoundReset,
	modeIs, modeStandard, modeNormalize, MODE_NAMES
};
