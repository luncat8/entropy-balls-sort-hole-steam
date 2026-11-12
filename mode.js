// owns: active game mode, lifecycle, hook registration and mode HUD/help state
// edit for: mode list, mode-specific boot/reset, help copy

const MODE_NAMES = ['standard', 'territory', 'ball-gun', 'plate-color'];
// the three non-standard modes run balls at a quarter of the standard speed; hole speed scales per mode
const MODE_BALL_SPEED = { standard: 1, territory: 0.25, 'ball-gun': 0.25, 'plate-color': 0.25 };
const MODE_HELP = [
	'',
	'Territory · P1 red moves its gun with the pointer, P2 blue with ↑↓. Hold middle mouse or → to pull neutral balls into the gun; left click or Space launches the stored ball. Wheel or ,/. and [/] changes pull/push force and energy cost. Every color crosses the top gate; a painted region is a hole only for its own color. Rooms with walls and holes tint balls.',
	'Ball gun · P1 aims with the pointer: hold middle mouse to pull a ball into the gun (stores up to 3), left click launches the oldest stored ball. Wheel changes force and energy cost. P2 moves the hole with ↑↓ and holds →. A launch predicted to pass the hole is refused; aim again. Touch: hold pulls, tap launches. Balls move at a quarter of their normal speed in both new modes.',
	'Plate color · Fixed central hole, two colorizer rooms and a shared two-hole plate. Push the plate left (P1 slider or A/D) to open the red room, right (P2 ←/→) to open the blue room. Fully tinted balls exit and are captured by the matching side gun. Aim guns (P1 pointer + middle pull + left fire; P2 ↑↓ + Shift/. pull + Space fire) to store and launch neutral balls with hole-consuming aura.'
];
const modeState = {
	active: 'standard',
	ready: false,
	select: null,
	hud: [null, null, null],
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
	modeState.hud[2] = $('plate-hud');
	modeState.help = $('mode-help');
	document.body.dataset.mode = 'standard';
	modeState.active = 'standard';
	modeState.ready = true;
	modecolorInit();
	modeInputInit();
	statusSetMode('standard');
	scoreboardSetMode('standard');
	modePaintChrome();
}

function modePaintChrome() {
	const active = modeState.active;
	const index = MODE_NAMES.indexOf(active);
	modeState.select.value = active;
	document.body.dataset.mode = active;
	modeState.hud[0].hidden = active !== 'territory';
	modeState.hud[1].hidden = active !== 'ball-gun';
	if (modeState.hud[2]) modeState.hud[2].hidden = active !== 'plate-color';
	modeState.help.textContent = MODE_HELP[index];
	modeState.help.hidden = index === 0;
}

function modeApplyInput() {
	inputSetEnabled(true);
	if (modeIs('territory')) inputSetEnabled(false);
	else if (modeIs('ball-gun')) inputSetPointerEnabled(false);
	else if (modeIs('plate-color')) {
		inputSetCanvasEnabled(false);
		inputSetKeysEnabled(false);
	}
}

function modeReleaseAll() {
	questReleaseAll();
	goalClose();
	inputRelease();
	modeInputCancel();
	territoryRelease();
	gunRelease();
	if (typeof plateRelease !== 'undefined') plateRelease();
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
	simSetModeSpeed(MODE_BALL_SPEED[next]);
	simSetModeApertureSpeed(1);
	modeApplyInput();
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
		if (typeof roomsInit !== 'undefined' && typeof roomsState !== 'undefined' && !roomsState.hue) roomsInit();
		if (typeof roomsSetEnabled !== 'undefined') roomsSetEnabled(settingsState.rooms);
		if (typeof roomsGenerate !== 'undefined' && settingsState.rooms) roomsGenerate();
		return true;
	}
	if (next === 'territory') {
		settingsRebuild();
		simSetModeHook(territorySimHook);
		trajSetModeHook(territoryTrajHook);
		canvasSetModeHook(territoryView);
		modeInputSetHook(territoryInput);
		simInit();
		territoryInit();
		territorySetRooms(settingsState.rooms);
		return true;
	}
	if (next === 'plate-color') {
		if (typeof roomsSetEnabled !== 'undefined') roomsSetEnabled(false);
		settingsRebuild();
		simSetModeHook(plateSimHook);
		trajSetModeHook(plateTrajHook);
		canvasSetModeHook(plateView);
		modeInputSetHook(plateInput);
		simInit();
		plateInit();
		tasksRegenerate();
		questRepaint();
		return true;
	}
	settingsRebuild();
	simSetModeApertureSpeed(0.25);
	canvasSetModeHook(gunView);
	modeInputSetHook(gunInput);
	simInit();
	gunInit();
	if (typeof roomsInit !== 'undefined' && typeof roomsState !== 'undefined' && !roomsState.hue) roomsInit();
	if (typeof roomsSetEnabled !== 'undefined') roomsSetEnabled(settingsState.rooms);
	if (typeof roomsGenerate !== 'undefined' && settingsState.rooms) roomsGenerate();
	return true;
}

function modeSetRooms(on) {
	if (modeIs('plate-color')) {
		if (typeof roomsSetEnabled !== 'undefined') roomsSetEnabled(false);
		return;
	}
	territorySetRooms(on);
	if (typeof roomsState !== 'undefined' && (modeStandard() || modeIs('ball-gun'))) {
		if (typeof roomsInit !== 'undefined' && !roomsState.hue) roomsInit();
		roomsSetEnabled(on);
		if (on) roomsGenerate();
	}
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
	else if (modeIs('plate-color')) plateControlStep(dt);
	else gunStep(dt);
}

function modeFrame() {
	if (modeIs('territory')) territoryHudPaint();
	else if (modeIs('ball-gun')) gunHudPaint();
	else if (modeIs('plate-color')) plateHudPaint();
}

// a new round resets play, so mode-owned state starts from its deterministic seed again
function modeRoundReset() {
	if (modeIs('territory')) {
		territoryInit();
		territorySetRooms(settingsState.rooms);
		return;
	}
	if (modeIs('plate-color')) {
		plateInit();
		return;
	}
	if (modeIs('ball-gun')) gunInit();
	if (typeof roomsInit !== 'undefined' && roomsState && roomsState.enabled) roomsInit();
}

if (typeof module !== 'undefined') module.exports = {
	modeState, modeInit, modeSet, modeSetRooms, modeApplyInput, modeControlStep, modeFrame, modeRoundReset,
	modeIs, modeStandard, modeNormalize, MODE_NAMES
};
