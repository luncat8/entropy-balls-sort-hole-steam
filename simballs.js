// owns: ball arrays, roster add/remove, fired-ball aura and live distribution snapshot
// edit for: ball capacity, aura lifetime/bounce cap, snapshot counters

const BALL_CAP = 36;
const BALL_COUNT_MIN = 6;
const BALL_COUNT_DEFAULT = 24;
const BALL_START_COUNT = 9;
// a ball lying on a screen edge holds a float32 height, so an exact fit test turns back two in five of the
// balls that skim the bottom edge into an opening parked there, while the top edge passes them all
const APERTURE_FIT_SLACK = 1e-3;

const simBalls = {
	count: 0,
	x: new Float32Array(BALL_CAP),
	y: new Float32Array(BALL_CAP),
	vx: new Float32Array(BALL_CAP),
	vy: new Float32Array(BALL_CAP),
	r: new Float32Array(BALL_CAP),
	rgb: new Uint32Array(BALL_CAP),
	palette: new Uint8Array(BALL_CAP),
	css: new Array(BALL_CAP)
};

// fired-ball aura (plan 3.2): balls launched by a gun carry an armed flag while the aura is
// active; the aura removes them on hole crossing so firing into the hole cannot solve a quest
const SIM_AURA_MAX_SEC = 20;
const SIM_AURA_MAX_BOUNCES = 4;
const simBallArmed = new Uint8Array(BALL_CAP);
const simBallAuraT = new Float32Array(BALL_CAP);
const simBallAuraBounces = new Uint8Array(BALL_CAP);

const DIST_PALETTE = 6;
const simDist = {
	total: 0,
	left: 0,
	right: 0,
	hot: 0,
	cold: 0,
	leftHot: 0,
	leftCold: 0,
	rightHot: 0,
	rightCold: 0,
	palette: new Uint16Array(DIST_PALETTE),
	leftPalette: new Uint16Array(DIST_PALETTE),
	rightPalette: new Uint16Array(DIST_PALETTE),
	sig: 0,
	rev: 0
};

function simResetBalls() {
	simBalls.count = 0;
	simBallArmed.fill(0);
	simBallAuraT.fill(0);
	simBallAuraBounces.fill(0);
}

function simRemoveBall(i) {
	if (i < 0 || i >= simBalls.count) return false;
	const last = simBalls.count - 1;
	if (typeof roomsRemoveBall !== 'undefined') roomsRemoveBall(i, last);
	if (simModeHook && simModeHook.removeBall) simModeHook.removeBall(i, last);
	if (i !== last) {
		simBalls.x[i] = simBalls.x[last]; simBalls.y[i] = simBalls.y[last];
		simBalls.vx[i] = simBalls.vx[last]; simBalls.vy[i] = simBalls.vy[last];
		simBalls.r[i] = simBalls.r[last]; simBalls.rgb[i] = simBalls.rgb[last];
		simBalls.palette[i] = simBalls.palette[last]; simBalls.css[i] = simBalls.css[last];
		simBallArmed[i] = simBallArmed[last];
		simBallAuraT[i] = simBallAuraT[last];
		simBallAuraBounces[i] = simBallAuraBounces[last];
	}
	simBalls.count = last;
	simFillDist();
	return true;
}

// returns the new index, or -1 when the fixed-capacity field is full
function simAddBall(x, y, vx, vy, r, rgb, palette, css) {
	const i = simBalls.count;
	if (i >= BALL_CAP) return -1;
	simBalls.x[i] = x; simBalls.y[i] = y; simBalls.vx[i] = vx; simBalls.vy[i] = vy;
	simBalls.r[i] = r; simBalls.rgb[i] = rgb; simBalls.palette[i] = palette; simBalls.css[i] = css;
	simBallArmed[i] = 0;
	simBallAuraT[i] = 0;
	simBallAuraBounces[i] = 0;
	simBalls.count = i + 1;
	simFillDist();
	return i;
}

// marks a ball as fired by a gun (plan 3.2): the aura removes it on hole crossing for
// SIM_AURA_MAX_SEC or SIM_AURA_MAX_BOUNCES edge bounces, then disarms
function simArmBall(i) {
	if (i < 0 || i >= simBalls.count) return;
	simBallArmed[i] = 1;
	simBallAuraT[i] = 0;
	simBallAuraBounces[i] = 0;
}

// an armed ball crossing the aperture opening is consumed (draft: firing into the hole
// must not solve a quest); a mode can override the hole test via simModeHook.auraHole
function simFiredCrossesHole(i) {
	if (simModeHook && simModeHook.auraHole) return simModeHook.auraHole(i);
	const r = simBalls.r[i];
	const dx = simBalls.x[i] - simField.wallX;
	if (dx > r || dx < -r) return false;
	const half = simAperture.size / 2;
	return simBalls.y[i] > simAperture.y - half - APERTURE_FIT_SLACK
		&& simBalls.y[i] < simAperture.y + half + APERTURE_FIT_SLACK;
}

function simStepAura(dt) {
	for (let i = 0; i < simBalls.count; i++) {
		if (!simBallArmed[i]) continue;
		if (simFiredCrossesHole(i)) { simRemoveBall(i); i--; continue; }
		simBallAuraT[i] += dt;
		if (simBallAuraT[i] >= SIM_AURA_MAX_SEC || simBallAuraBounces[i] >= SIM_AURA_MAX_BOUNCES) {
			simBallArmed[i] = 0;
		}
	}
}

function simDistSig() {
	let s = simDist.total + 1;
	s = (s * 33 + simDist.left) | 0;
	s = (s * 33 + simDist.right) | 0;
	for (let p = 0; p < DIST_PALETTE; p++) {
		s = (s * 33 + simDist.leftPalette[p]) | 0;
		s = (s * 33 + simDist.rightPalette[p]) | 0;
	}
	return s;
}

function simFillDist() {
	const oldSig = simDist.sig;
	simDist.total = 0;
	simDist.left = 0;
	simDist.right = 0;
	simDist.hot = 0;
	simDist.cold = 0;
	simDist.leftHot = 0;
	simDist.leftCold = 0;
	simDist.rightHot = 0;
	simDist.rightCold = 0;
	simDist.palette.fill(0);
	simDist.leftPalette.fill(0);
	simDist.rightPalette.fill(0);
	const wallX = simField.wallX;
	for (let i = 0; i < simBalls.count; i++) {
		const p = simBalls.palette[i];
		simDist.total++;
		simDist.palette[p]++;
		if (simBalls.x[i] < wallX) {
			simDist.left++;
			simDist.leftPalette[p]++;
		} else {
			simDist.right++;
			simDist.rightPalette[p]++;
		}
	}
	for (let p = 0; p < DIST_PALETTE; p++) {
		const hue = PALETTE[p][1];
		if (colorIsWarm(hue)) {
			simDist.hot += simDist.palette[p];
			simDist.leftHot += simDist.leftPalette[p];
			simDist.rightHot += simDist.rightPalette[p];
		} else if (colorIsCold(hue)) {
			simDist.cold += simDist.palette[p];
			simDist.leftCold += simDist.leftPalette[p];
			simDist.rightCold += simDist.rightPalette[p];
		}
	}
	simDist.sig = simDistSig();
	if (simDist.sig !== oldSig) simDist.rev++;
}

if (typeof module !== 'undefined') module.exports = {
	simBalls, simDist, simResetBalls, simRemoveBall, simAddBall, simArmBall, simFiredCrossesHole,
	simStepAura, simFillDist, simBallArmed, simBallAuraT, simBallAuraBounces,
	BALL_CAP, BALL_COUNT_MIN, BALL_COUNT_DEFAULT, BALL_START_COUNT,
	APERTURE_FIT_SLACK, SIM_AURA_MAX_SEC, SIM_AURA_MAX_BOUNCES
};
