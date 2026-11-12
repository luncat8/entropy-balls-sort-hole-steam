// owns: the human players' hole controls — pointer, wheel and keys per participant
// edit for: bindings, hold gestures, channel assignment, mode enable

const INPUT_FORCE_STEP = 5;
const INPUT_FORCE_START = 60;
const INPUT_SLIDER_INSET = 10;
const INPUT_NONE = -1;

const inputUi = { canvas: null, sliders: [] };
// mouse and keys are participant ids: the first human owns the pointer, a second human the arrows
const inputState = {
	mouse: 0,
	keys: 0,
	value: null,
	sliderPointer: null,
	canvasPointer: null,
	canvasClientY: null,
	targetY: null,
	keyHold: null,
	pointerEnabled: true,
	canvasEnabled: true,
	keysEnabled: true
};

function inputInit() {
	inputState.value = new Int16Array(PLAYER_CAP);
	inputState.sliderPointer = new Int32Array(PLAYER_CAP);
	inputState.canvasPointer = new Int32Array(PLAYER_CAP);
	inputState.canvasClientY = new Float32Array(PLAYER_CAP);
	inputState.targetY = new Float32Array(PLAYER_CAP);
	inputState.keyHold = new Uint8Array(PLAYER_CAP);
	inputState.value.fill(INPUT_FORCE_START);
	inputState.sliderPointer.fill(INPUT_NONE);
	inputState.canvasPointer.fill(INPUT_NONE);
	inputUi.canvas = $('canv');
	inputUi.canvas.addEventListener('pointerdown', inputCanvasDown);
	inputUi.canvas.addEventListener('pointermove', inputCanvasMove);
	inputUi.canvas.addEventListener('pointerup', inputCanvasEnd);
	inputUi.canvas.addEventListener('pointercancel', inputCanvasEnd);
	inputUi.canvas.addEventListener('lostpointercapture', inputCanvasEnd);
	inputUi.canvas.addEventListener('wheel', inputWheel, { passive: false });
	window.addEventListener('keydown', inputKeyDown);
	window.addEventListener('keyup', inputKeyUp);
	window.addEventListener('blur', inputReleaseAll);
	window.addEventListener('resize', inputResize);
	document.addEventListener('visibilitychange', inputVisibilityChanged);
	inputRebind();
}

// modes own the pointer/keyboard while they are active; the hole channel comes back unchanged
function inputSetEnabled(on) {
	inputState.pointerEnabled = !!on;
	inputState.canvasEnabled = !!on;
	inputState.keysEnabled = !!on;
	if (!on) inputReleaseAll();
}

function inputSetPointerEnabled(on) {
	inputState.pointerEnabled = !!on;
	inputState.canvasEnabled = !!on;
	if (!on) inputReleaseAll();
}

// lets a mode take over canvas gestures while keeping the force-panel sliders live
function inputSetCanvasEnabled(on) {
	inputState.canvasEnabled = !!on;
	if (!on) {
		for (let id = 0; id < PLAYER_CAP; id++) {
			inputReleaseCapture(inputUi.canvas, inputState.canvasPointer[id]);
			inputState.canvasPointer[id] = INPUT_NONE;
			inputRefresh(id);
		}
	}
}

function inputSetKeysEnabled(on) {
	inputState.keysEnabled = !!on;
	if (!on) {
		for (let id = 0; id < PLAYER_CAP; id++) {
			if (!inputState.keyHold[id]) continue;
			inputState.keyHold[id] = 0;
			inputRefresh(id);
		}
	}
}

function inputTwoHumans() {
	return inputState.keys !== inputState.mouse;
}

function inputControls(id) {
	if (id < 0 || id >= players.count || players.type[id] !== PLAYER_HUMAN) return false;
	return id === inputState.mouse || id === inputState.keys;
}

// the pointer belongs to the first human, the arrows to the second; one human owns both
function inputChannel(id) {
	if (!inputControls(id)) return null;
	return id === inputState.mouse ? 'mouse' : 'keys';
}

function inputValue(id) {
	return inputState.value[id];
}

// the keys of the second human; the single human keeps the field's own shortcuts
function inputApplyKey() {
	return inputTwoHumans() ? 'ArrowRight' : 'Space';
}

function inputBindPanel(id, panel, slider) {
	if (!inputControls(id)) return false;
	slider.inputId = id;
	// the second human drives their panel with keys only, so the pointer never reaches it
	if (id !== inputState.mouse) {
		slider.className = slider.className + ' force-slider-keys';
		return true;
	}
	inputUi.sliders[id] = slider;
	panel.inputId = id;
	panel.addEventListener('wheel', inputPanelWheel, { passive: false });
	slider.addEventListener('pointerdown', inputSliderDown);
	slider.addEventListener('pointermove', inputSliderMove);
	slider.addEventListener('pointerup', inputSliderEnd);
	slider.addEventListener('pointercancel', inputSliderEnd);
	slider.addEventListener('lostpointercapture', inputSliderEnd);
	slider.addEventListener('input', inputSliderChanged);
	return true;
}

function inputPreparePanels() {
	inputReleaseAll();
	inputUi.sliders.length = 0;
}

// A lone human keeps both channels even in slot 2; a bot never reserves a human channel.
function inputRebind() {
	// boot creates the participants (and can rebuild them from the URL) before this layer exists
	if (!inputState.value) return;
	inputReleaseAll();
	let first = -1;
	let second = -1;
	for (let id = 0; id < players.count; id++) {
		if (players.type[id] !== PLAYER_HUMAN) continue;
		if (first < 0) first = id;
		else second = id;
	}
	inputState.mouse = first < 0 ? 0 : first;
	inputState.keys = second < 0 ? inputState.mouse : second;
	inputApplyAll();
}

function inputApplyAll() {
	for (let id = 0; id < players.count; id++) if (inputControls(id)) inputApplyValue(id);
}

function inputApplyValue(id) {
	forceSetMagnitude(id, Math.abs(inputState.value[id]) / 100);
	forcePanelSetValue(id, inputState.value[id]);
	inputRefresh(id);
}

function inputSetValue(id, value) {
	if (!inputControls(id) || !Number.isFinite(value)) return;
	let next = Math.round(value / INPUT_FORCE_STEP) * INPUT_FORCE_STEP;
	if (next < -100) next = -100;
	else if (next > 100) next = 100;
	inputState.value[id] = next;
	inputApplyValue(id);
}

function inputHeld(id) {
	return inputState.sliderPointer[id] !== INPUT_NONE || inputState.canvasPointer[id] !== INPUT_NONE
		|| inputState.keyHold[id] === 1;
}

function inputTargetDirection(id) {
	const delta = inputState.targetY[id] - simAperture.y;
	// Half a maximum fixed-step movement prevents a held pointer from oscillating around its target.
	const deadZone = simAperture.speed * FIXED_DT / 2 + 0.01;
	return delta < -deadZone ? -1 : (delta > deadZone ? 1 : 0);
}

// The held field aims the hole at the pointer; every other source uses the slider's signed value.
function inputRefresh(id) {
	if (!inputControls(id)) return;
	const aiming = inputState.canvasPointer[id] !== INPUT_NONE;
	forceSetDirection(id, aiming ? inputTargetDirection(id) : Math.sign(inputState.value[id]));
	forceHold(id, inputHeld(id));
}

function inputStep() {
	const id = inputState.mouse;
	if (inputState.canvasPointer[id] !== INPUT_NONE) inputRefresh(id);
}

function inputReleaseCapture(el, pointerId) {
	if (pointerId === INPUT_NONE || !el || !el.hasPointerCapture) return;
	if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
}

function inputReleasePlayer(id) {
	inputReleaseCapture(inputUi.sliders[id], inputState.sliderPointer[id]);
	inputReleaseCapture(inputUi.canvas, inputState.canvasPointer[id]);
	inputState.sliderPointer[id] = INPUT_NONE;
	inputState.canvasPointer[id] = INPUT_NONE;
	inputState.keyHold[id] = 0;
	inputRefresh(id);
}

function inputReleaseAll() {
	for (let id = 0; id < PLAYER_CAP; id++) inputReleasePlayer(id);
}

function inputRelease(id) {
	if (id === undefined) inputReleaseAll();
	else inputReleasePlayer(id);
}

function inputVisibilityChanged() {
	if (document.hidden) inputReleaseAll();
}

function inputSliderDown(e) {
	const id = e.currentTarget.inputId;
	if (!inputState.pointerEnabled || !inputControls(id)) return;
	if ((e.button !== undefined && e.button !== 0) || inputState.sliderPointer[id] !== INPUT_NONE) return;
	e.preventDefault();
	inputState.sliderPointer[id] = e.pointerId;
	if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
	e.currentTarget.focus({ preventScroll: true });
	inputSliderMove(e);
}

function inputSliderMove(e) {
	const id = e.currentTarget.inputId;
	if (!inputState.pointerEnabled || e.pointerId !== inputState.sliderPointer[id]) return;
	const rect = e.currentTarget.getBoundingClientRect();
	const ratio = (e.clientY - rect.top - INPUT_SLIDER_INSET) / (rect.height - 2 * INPUT_SLIDER_INSET);
	inputSetValue(id, -100 + ratio * 200);
}

function inputSliderEnd(e) {
	const id = e.currentTarget.inputId;
	if (!inputState.pointerEnabled || e.pointerId !== inputState.sliderPointer[id]) return;
	inputState.sliderPointer[id] = INPUT_NONE;
	inputRefresh(id);
}

function inputSliderChanged(e) {
	if (!inputState.pointerEnabled) return;
	inputSetValue(e.currentTarget.inputId, Number(e.currentTarget.value));
}

function inputTargetAt(id, clientY) {
	inputState.canvasClientY[id] = clientY;
	const half = simAperture.size / 2;
	const y = canvasFieldY(clientY);
	inputState.targetY[id] = Math.max(half, Math.min(simField.h - half, y));
}

function inputCanvasDown(e) {
	const id = inputState.mouse;
	if (!inputState.pointerEnabled || !inputState.canvasEnabled || !inputControls(id)) return;
	if ((e.button !== undefined && e.button !== 0) || inputState.canvasPointer[id] !== INPUT_NONE) return;
	e.preventDefault();
	inputState.canvasPointer[id] = e.pointerId;
	if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
	inputTargetAt(id, e.clientY);
	inputRefresh(id);
}

function inputCanvasMove(e) {
	const id = inputState.mouse;
	if (!inputState.pointerEnabled || !inputState.canvasEnabled || e.pointerId !== inputState.canvasPointer[id]) return;
	inputTargetAt(id, e.clientY);
	inputRefresh(id);
}

function inputCanvasEnd(e) {
	const id = inputState.mouse;
	if (!inputState.pointerEnabled || !inputState.canvasEnabled || e.pointerId !== inputState.canvasPointer[id]) return;
	inputState.canvasPointer[id] = INPUT_NONE;
	inputRefresh(id);
}

function inputResize() {
	for (let id = 0; id < PLAYER_CAP; id++) {
		if (inputState.canvasPointer[id] === INPUT_NONE) continue;
		inputTargetAt(id, inputState.canvasClientY[id]);
		inputRefresh(id);
	}
}

// A wheel changes selection, never activation; it moves the participant whose control it is over.
function inputWheelStep(id, deltaY) {
	if (!inputControls(id) || !deltaY) return false;
	inputSetValue(id, inputState.value[id] + (deltaY > 0 ? INPUT_FORCE_STEP : -INPUT_FORCE_STEP));
	return true;
}

function inputWheel(e) {
	if (!inputState.pointerEnabled || !inputState.canvasEnabled) return;
	if (inputWheelStep(inputState.mouse, e.deltaY)) e.preventDefault();
}

function inputPanelWheel(e) {
	if (!inputState.pointerEnabled) return;
	if (inputWheelStep(e.currentTarget.inputId, e.deltaY)) e.preventDefault();
}

function inputOwned(e) {
	if (e.defaultPrevented) return true;
	if (e.target && e.target.inputId !== undefined) return false;
	const tag = e.target && e.target.tagName;
	return e.target && e.target.isContentEditable || tag === 'INPUT' || tag === 'BUTTON'
		|| tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'A' || tag === 'SUMMARY';
}

function inputKeyDown(e) {
	const id = inputState.keys;
	if (!inputState.keysEnabled || !inputControls(id) || inputOwned(e)) return;
	if (e.code === inputApplyKey()) {
		e.preventDefault();
		inputState.keyHold[id] = 1;
		inputRefresh(id);
		return;
	}
	if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
	e.preventDefault();
	inputSetValue(id, inputState.value[id] + (e.code === 'ArrowUp' ? -INPUT_FORCE_STEP : INPUT_FORCE_STEP));
}

// Releases whatever key still holds a request, even after focus or channel changes.
function inputKeyUp(e) {
	if (!inputState.keysEnabled) return;
	if (e.code !== 'Space' && e.code !== 'ArrowRight') return;
	for (let id = 0; id < PLAYER_CAP; id++) {
		if (!inputState.keyHold[id]) continue;
		inputState.keyHold[id] = 0;
		inputRefresh(id);
	}
}

if (typeof module !== 'undefined') module.exports = {
	inputUi, inputState, inputInit, inputControls, inputValue, inputBindPanel, inputPreparePanels,
	inputChannel, inputSetValue, inputRebind, inputRelease, inputStep, inputTwoHumans, inputApplyKey,
	inputSetEnabled, inputSetPointerEnabled, inputSetCanvasEnabled, inputSetKeysEnabled,
	INPUT_FORCE_STEP, INPUT_FORCE_START, INPUT_SLIDER_INSET, INPUT_NONE
};
