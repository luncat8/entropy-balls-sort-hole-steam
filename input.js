// owns: the human player's signed force selection and hold gestures
// edit for: pointer, wheel and keyboard controls

const INPUT_FORCE_STEP = 5;
const INPUT_FORCE_START = 60;
const INPUT_SLIDER_INSET = 10;

const inputUi = { canvas: null, panel: null, slider: null };
const inputState = {
	player: 0, value: INPUT_FORCE_START, sliderPointer: null, canvasPointer: null,
	canvasClientY: 0, targetY: 0, keyHeld: false
};

function inputInit() {
	inputUi.canvas = $('canv');
	inputUi.canvas.addEventListener('pointerdown', inputCanvasDown);
	inputUi.canvas.addEventListener('pointermove', inputCanvasMove);
	inputUi.canvas.addEventListener('pointerup', inputCanvasEnd);
	inputUi.canvas.addEventListener('pointercancel', inputCanvasEnd);
	inputUi.canvas.addEventListener('lostpointercapture', inputCanvasEnd);
	inputUi.canvas.addEventListener('wheel', inputWheel, { passive: false });
	window.addEventListener('keydown', inputKeyDown);
	window.addEventListener('keyup', inputKeyUp);
	window.addEventListener('blur', inputRelease);
	window.addEventListener('resize', inputResize);
	document.addEventListener('visibilitychange', inputVisibilityChanged);
	inputState.player = 0;
	inputState.sliderPointer = null;
	inputState.canvasPointer = null;
	inputState.keyHeld = false;
	inputSetValue(INPUT_FORCE_START);
}

function inputControls(id) {
	return id === inputState.player && players.type[id] === PLAYER_HUMAN;
}

function inputValue() {
	return inputState.value;
}

function inputBindPanel(id, panel, slider) {
	if (!inputControls(id)) return false;
	inputUi.panel = panel;
	inputUi.slider = slider;
	panel.addEventListener('wheel', inputWheel, { passive: false });
	slider.addEventListener('pointerdown', inputSliderDown);
	slider.addEventListener('pointermove', inputSliderMove);
	slider.addEventListener('pointerup', inputSliderEnd);
	slider.addEventListener('pointercancel', inputSliderEnd);
	slider.addEventListener('lostpointercapture', inputSliderEnd);
	slider.addEventListener('input', inputSliderChanged);
	return true;
}

function inputPreparePanels() {
	inputRelease();
	inputUi.panel = null;
	inputUi.slider = null;
}

function inputSetPlayer(id) {
	if (id === inputState.player || id < 0 || id >= players.count || players.type[id] !== PLAYER_HUMAN) return;
	inputRelease();
	inputState.player = id;
	inputSetValue(inputState.value);
	forcePanelRebuild();
}

function inputSetValue(value) {
	if (!inputControls(inputState.player) || !Number.isFinite(value)) return;
	let next = Math.round(value / INPUT_FORCE_STEP) * INPUT_FORCE_STEP;
	if (next < -100) next = -100;
	else if (next > 100) next = 100;
	inputState.value = next;
	forceSetMagnitude(inputState.player, Math.abs(next) / 100);
	forcePanelSetValue(inputState.player, next);
	inputRefreshRequest();
}

function inputTargetDirection() {
	const delta = inputState.targetY - simAperture.y;
	// Half a maximum fixed-step movement prevents a held pointer from oscillating around its target.
	const deadZone = simAperture.speed * FIXED_DT / 2 + 0.01;
	return delta < -deadZone ? -1 : (delta > deadZone ? 1 : 0);
}

function inputRefreshRequest() {
	if (!inputControls(inputState.player)) return;
	const canvasHeld = inputState.canvasPointer !== null;
	const dir = canvasHeld ? inputTargetDirection() : Math.sign(inputState.value);
	forceSetDirection(inputState.player, dir);
	forceHold(inputState.player, canvasHeld || inputState.sliderPointer !== null || inputState.keyHeld);
}

function inputStep() {
	if (inputState.canvasPointer !== null) inputRefreshRequest();
}

function inputReleaseCapture(el, id) {
	if (id !== null && el && el.hasPointerCapture && el.hasPointerCapture(id)) el.releasePointerCapture(id);
}

function inputRelease() {
	const sliderId = inputState.sliderPointer;
	const canvasId = inputState.canvasPointer;
	inputState.sliderPointer = null;
	inputState.canvasPointer = null;
	inputState.keyHeld = false;
	inputReleaseCapture(inputUi.slider, sliderId);
	inputReleaseCapture(inputUi.canvas, canvasId);
	inputRefreshRequest();
}

function inputVisibilityChanged() {
	if (document.hidden) inputRelease();
}

function inputSliderDown(e) {
	if ((e.button !== undefined && e.button !== 0) || inputState.sliderPointer !== null) return;
	e.preventDefault();
	inputState.sliderPointer = e.pointerId;
	if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
	e.currentTarget.focus({ preventScroll: true });
	inputSliderMove(e);
}

function inputSliderMove(e) {
	if (e.pointerId !== inputState.sliderPointer) return;
	const rect = e.currentTarget.getBoundingClientRect();
	const ratio = (e.clientY - rect.top - INPUT_SLIDER_INSET) / (rect.height - 2 * INPUT_SLIDER_INSET);
	inputSetValue(-100 + ratio * 200);
}

function inputSliderEnd(e) {
	if (e.pointerId !== inputState.sliderPointer) return;
	inputState.sliderPointer = null;
	inputRefreshRequest();
}

function inputSliderChanged(e) {
	inputSetValue(Number(e.currentTarget.value));
}

function inputTargetAt(clientY) {
	inputState.canvasClientY = clientY;
	const half = simAperture.size / 2;
	const y = canvasFieldY(clientY);
	inputState.targetY = Math.max(half, Math.min(simField.h - half, y));
}

function inputCanvasDown(e) {
	if (!inputControls(inputState.player)) return;
	if ((e.button !== undefined && e.button !== 0) || inputState.canvasPointer !== null) return;
	e.preventDefault();
	inputState.canvasPointer = e.pointerId;
	if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
	inputTargetAt(e.clientY);
	inputRefreshRequest();
}

function inputCanvasMove(e) {
	if (e.pointerId !== inputState.canvasPointer) return;
	inputTargetAt(e.clientY);
	inputRefreshRequest();
}

function inputCanvasEnd(e) {
	if (e.pointerId !== inputState.canvasPointer) return;
	inputState.canvasPointer = null;
	inputRefreshRequest();
}

function inputResize() {
	if (inputState.canvasPointer !== null) inputTargetAt(inputState.canvasClientY);
}

// A wheel over the field or this player's panel changes selection, never activation.
function inputWheel(e) {
	if (!inputControls(inputState.player) || !e.deltaY) return;
	e.preventDefault();
	inputSetValue(inputState.value + (e.deltaY > 0 ? INPUT_FORCE_STEP : -INPUT_FORCE_STEP));
}

function inputOwned(e) {
	if (e.defaultPrevented) return true;
	if (e.target === inputUi.slider) return false;
	const tag = e.target && e.target.tagName;
	return e.target && e.target.isContentEditable || tag === 'INPUT' || tag === 'BUTTON'
		|| tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'A' || tag === 'SUMMARY';
}

function inputKeyDown(e) {
	if (!inputControls(inputState.player) || inputOwned(e)) return;
	if (e.code === 'Space') {
		e.preventDefault();
		inputState.keyHeld = true;
		inputRefreshRequest();
		return;
	}
	if (e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
	e.preventDefault();
	inputSetValue(inputState.value + (e.code === 'ArrowUp' ? -INPUT_FORCE_STEP : INPUT_FORCE_STEP));
}

function inputKeyUp(e) {
	if (e.code !== 'Space' || !inputState.keyHeld) return;
	inputState.keyHeld = false;
	inputRefreshRequest();
}

if (typeof module !== 'undefined') module.exports = {
	inputUi, inputState, inputInit, inputControls, inputValue, inputBindPanel, inputPreparePanels,
	inputSetPlayer, inputSetValue, inputRelease, inputStep,
	INPUT_FORCE_STEP, INPUT_FORCE_START, INPUT_SLIDER_INSET
};
