// owns: pointer/keyboard aperture input
// edit for: bindings, clamping

const KEY_UP = ['ArrowUp', 'KeyW'];
const KEY_DOWN = ['ArrowDown', 'KeyS'];

let inputTargetY = 0;
let inputKeyDir = 0;

function inputClamp(y) {
	const half = simAperture.size / 2;
	return y < half ? half : (y > simField.h - half ? simField.h - half : y);
}

function inputPointer(e) {
	inputTargetY = canvasToWorldY(e.clientY);
}

function inputKeyDown(e) {
	if (KEY_UP.includes(e.code)) inputKeyDir = -1;
	else if (KEY_DOWN.includes(e.code)) inputKeyDir = 1;
	else return;
	e.preventDefault();
}

function inputKeyUp(e) {
	if (KEY_UP.includes(e.code) && inputKeyDir < 0) inputKeyDir = 0;
	else if (KEY_DOWN.includes(e.code) && inputKeyDir > 0) inputKeyDir = 0;
}

function inputRelease() {
	inputKeyDir = 0;
}

function inputInit() {
	inputTargetY = simField.h / 2;
	root.addEventListener('pointermove', inputPointer);
	window.addEventListener('keydown', inputKeyDown);
	window.addEventListener('keyup', inputKeyUp);
	window.addEventListener('blur', inputRelease);
}

function inputUpdate(dtSec) {
	if (inputKeyDir !== 0) inputTargetY += inputKeyDir * simAperture.speed * dtSec;
	inputTargetY = inputClamp(inputTargetY);
	simSetApertureTarget(inputTargetY);
}

if (typeof module !== 'undefined') module.exports = { inputInit, inputUpdate };
