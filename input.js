// owns: hole force controls — direction, strength and the hold gesture
// edit for: bindings, strength steps, hold regions

// the slider and the wheel are one control: the slider shows the strength the wheel sets
const INPUT_MAG_STEP = 0.05;
const INPUT_MAG_START = 0.6;
const INPUT_KEYS_DIRECT = { ArrowUp: -1, ArrowDown: 1 };

const inputUi = { panel: null, pad: null, mag: null, push: null, pull: null };
const inputState = { player: 0, dir: 1, mag: INPUT_MAG_START, held: false };

function inputInit() {
	inputUi.panel = $('force-panel');
	inputUi.pad = $('force-pad');
	inputUi.mag = $('force-mag');
	inputUi.push = $('force-push');
	inputUi.pull = $('force-pull');
	inputUi.panel.addEventListener('wheel', inputWheel, { passive: false });
	inputUi.pad.addEventListener('pointerdown', inputPadDown);
	inputUi.pad.addEventListener('pointerup', inputRelease);
	inputUi.pad.addEventListener('pointercancel', inputRelease);
	inputUi.pad.addEventListener('lostpointercapture', inputRelease);
	inputUi.mag.addEventListener('input', inputMagChanged);
	inputUi.push.addEventListener('change', inputDirectionChanged);
	inputUi.pull.addEventListener('change', inputDirectionChanged);
	window.addEventListener('keydown', inputKeyDown);
	window.addEventListener('keyup', inputKeyUp);
	window.addEventListener('blur', inputRelease);
	inputState.held = false;
	inputState.dir = 1;
	inputState.mag = INPUT_MAG_START;
	inputUi.push.checked = true;
	inputUi.pull.checked = false;
	inputSetMagnitude(INPUT_MAG_START);
	inputSetDirection(1);
}

// a key that a control already consumed, or that a control needs for itself, is not a hole control
function inputOwned(e) {
	if (e.defaultPrevented) return true;
	const tag = e.target && e.target.tagName;
	return tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA';
}

function inputKeyDown(e) {
	if (inputOwned(e)) return;
	if (e.code === 'Space') {
		e.preventDefault();
		inputActivate();
		return;
	}
	const dir = INPUT_KEYS_DIRECT[e.code];
	if (dir === undefined) return;
	e.preventDefault();
	inputSetDirection(dir);
}

function inputKeyUp(e) {
	if (e.code === 'Space') inputRelease();
}

// a controller belongs to one participant; handing the controls over drops any held request first, so
// a second human or a bot can share this interface without inheriting the previous player's force
function inputSetPlayer(id) {
	if (id === inputState.player || id < 0 || id >= players.count) return;
	inputRelease();
	inputState.player = id;
	forceSetDirection(id, inputState.dir);
	forceSetMagnitude(id, inputState.mag);
}

function inputActivate() {
	if (inputState.held) return;
	inputState.held = true;
	forceHold(inputState.player, true);
}

function inputRelease() {
	if (!inputState.held) return;
	inputState.held = false;
	forceClear(inputState.player);
}

function inputPadDown(e) {
	e.preventDefault();
	if (inputUi.pad.setPointerCapture) inputUi.pad.setPointerCapture(e.pointerId);
	inputActivate();
}

function inputDirectionChanged(e) {
	if (e.target.checked) inputSetDirection(e.target.value === 'pull' ? -1 : 1);
}

function inputSetDirection(dir) {
	inputState.dir = dir < 0 ? -1 : 1;
	const pull = inputState.dir < 0;
	inputUi.pull.checked = pull;
	inputUi.push.checked = !pull;
	inputUi.pad.textContent = pull ? 'Hold to pull up' : 'Hold to push down';
	forceSetDirection(inputState.player, inputState.dir);
}

function inputMagChanged() {
	inputSetMagnitude(inputUi.mag.value / 100);
}

function inputSetMagnitude(mag) {
	const m = mag < 0 ? 0 : (mag > 1 ? 1 : mag);
	inputState.mag = m;
	inputUi.mag.value = String(Math.round(m * 100));
	forceSetMagnitude(inputState.player, m);
}

// the wheel adjusts strength only over the force panel, so it never hijacks a scroll elsewhere
function inputWheel(e) {
	e.preventDefault();
	const step = e.deltaY > 0 ? -INPUT_MAG_STEP : INPUT_MAG_STEP;
	inputSetMagnitude(inputState.mag + step);
}

if (typeof module !== 'undefined') module.exports = {
	inputInit,
	inputState,
	inputActivate,
	inputRelease,
	inputSetDirection,
	inputSetMagnitude,
	inputSetPlayer,
	INPUT_MAG_STEP,
	INPUT_MAG_START
};
