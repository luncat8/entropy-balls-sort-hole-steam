// owns: middle/left/touch gestures for the new modes — aim, pull, push and every release path
// edit for: gesture mapping, touch hold threshold

const MODE_TAP_SEC = 0.18;
const MODE_KEY_CODES = ['ArrowUp', 'ArrowDown', 'ArrowRight', 'Space', 'BracketLeft', 'BracketRight', 'Comma', 'Period'];

const modeInputState = {
	hook: null,
	down: 0,
	pointer: -1,
	pull: 0,
	pendingTap: 0,
	heldSec: 0
};

function modeInputInit() {
	const cv = inputUi.canvas;
	cv.addEventListener('pointerdown', modeInputDown);
	cv.addEventListener('pointermove', modeInputMove);
	cv.addEventListener('pointerup', modeInputUp);
	cv.addEventListener('pointercancel', modeInputEnd);
	cv.addEventListener('lostpointercapture', modeInputEnd);
	cv.addEventListener('wheel', modeInputWheel, { passive: false });
	cv.addEventListener('mousedown', modeInputMouseDown);
	cv.addEventListener('auxclick', modeInputAux);
	cv.addEventListener('contextmenu', modeInputContext);
	window.addEventListener('blur', modeInputCancel);
	window.addEventListener('keydown', modeInputKeyDown);
	window.addEventListener('keyup', modeInputKeyUp);
	document.addEventListener('visibilitychange', modeInputVisibility);
}

function modeInputSetHook(hook) {
	if (hook === modeInputState.hook) return;
	modeInputCancel();
	modeInputState.hook = hook;
}

function modeInputPull(on) {
	const s = modeInputState;
	if (!!on === !!s.pull) return;
	s.pull = on ? 1 : 0;
	if (s.hook) s.hook.pull(on);
}

function modeInputAim(e) {
	const s = modeInputState;
	if (!s.hook) return;
	const x = canvasFieldX(e.clientX === undefined ? 0 : e.clientX);
	const y = canvasFieldY(e.clientY === undefined ? 0 : e.clientY);
	s.hook.aim(x, y);
}

function modeInputCapture(e) {
	if (!e.currentTarget || !e.currentTarget.setPointerCapture) return;
	try { e.currentTarget.setPointerCapture(e.pointerId); } catch (error) { return; }
}

function modeInputDown(e) {
	const s = modeInputState;
	if (!s.hook || s.down) return;
	const button = e.button === undefined ? 0 : e.button;
	if (button !== 0 && button !== 1) return;
	e.preventDefault();
	s.down = 1;
	s.pointer = e.pointerId === undefined ? -1 : e.pointerId;
	s.heldSec = 0;
	const touch = e.pointerType === 'touch';
	s.pendingTap = touch && button === 0 ? 1 : 0;
	modeInputCapture(e);
	modeInputAim(e);
	if (button === 1) modeInputPull(1);
	else if (!touch) s.hook.push();
}

function modeInputMove(e) {
	const s = modeInputState;
	if (!s.hook) return;
	if (!s.down) { modeInputAim(e); return; }
	if (e.pointerId !== undefined && s.pointer !== -1 && e.pointerId !== s.pointer) return;
	modeInputAim(e);
}

function modeInputStep(dt) {
	const s = modeInputState;
	if (!s.hook || !s.down) return;
	s.heldSec += dt;
	if (s.pendingTap && !s.pull && s.heldSec >= MODE_TAP_SEC) modeInputPull(1);
}

function modeInputReleasePointer(e) {
	const s = modeInputState;
	if (s.pointer === -1 || !e || !e.currentTarget || !e.currentTarget.hasPointerCapture) return;
	if (e.currentTarget.hasPointerCapture(s.pointer)) e.currentTarget.releasePointerCapture(s.pointer);
}

function modeInputUp(e) {
	const s = modeInputState;
	if (!s.hook || !s.down) return;
	if (e.pointerId !== undefined && s.pointer !== -1 && e.pointerId !== s.pointer) return;
	if (s.pendingTap && s.heldSec < MODE_TAP_SEC) s.hook.push();
	modeInputPull(0);
	modeInputReleasePointer(e);
	s.down = 0;
	s.pointer = -1;
	s.pendingTap = 0;
	s.heldSec = 0;
}

function modeInputEnd(e) {
	const s = modeInputState;
	if (!s.down) return;
	if (e.pointerId !== undefined && s.pointer !== -1 && e.pointerId !== s.pointer) return;
	modeInputCancel();
}

function modeInputCancel() {
	const s = modeInputState;
	modeInputPull(0);
	s.down = 0;
	s.pointer = -1;
	s.pendingTap = 0;
	s.heldSec = 0;
	if (s.hook) s.hook.cancel();
}

function modeInputMouseDown(e) {
	if (modeInputState.hook && e.button === 1) e.preventDefault();
}

function modeInputAux(e) {
	if (modeInputState.hook && (e.button === 1 || e.button === 2)) e.preventDefault();
}

function modeInputContext(e) {
	if (modeInputState.hook) e.preventDefault();
}

function modeInputVisibility() {
	if (document.hidden) modeInputCancel();
}

function modeInputWheel(e) {
	const s = modeInputState;
	if (!s.hook) return;
	if (s.hook.wheel) { s.hook.wheel(e.deltaY); e.preventDefault(); }
}

function modeInputOwned(e) {
	const t = e.target;
	if (!t) return false;
	if (t.isContentEditable) return true;
	const tag = t.tagName;
	return tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT'
		|| tag === 'TEXTAREA' || tag === 'A' || tag === 'SUMMARY';
}

function modeInputKey(e, down) {
	const s = modeInputState;
	if (!s.hook || !s.hook.keys || modeInputOwned(e)) return;
	if (MODE_KEY_CODES.indexOf(e.code) < 0) return;
	e.preventDefault();
	s.hook.key(e.code, down);
}

function modeInputKeyDown(e) { modeInputKey(e, true); }
function modeInputKeyUp(e) { modeInputKey(e, false); }

if (typeof module !== 'undefined') module.exports = {
	modeInputState, modeInputInit, modeInputSetHook, modeInputStep, modeInputCancel,
	modeInputDown, modeInputMove, modeInputUp, modeInputEnd, modeInputKeyDown, modeInputKeyUp,
	modeInputWheel, MODE_TAP_SEC
};
