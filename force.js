// owns: per-participant hole requests, energy stores, funding and the store readout
// edit for: energy rates, funding rules, store readout

const FORCE_CAPACITY = 100;
const FORCE_RECHARGE = 10;
const FORCE_COST = 25;

// dir, mag and held are the control's own position; energy is what the store has left; drive is the
// combined request the field actually got this step. all four are read-only for anything outside here
const forceState = { dir: null, mag: null, held: null, energy: null, drive: 0 };

const forceReadout = { el: null, rows: [], view: { energy: 0, share: 0, dir: 0, mag: 0, held: false } };

let forceCost = FORCE_COST;
let forceCapacity = FORCE_CAPACITY;

// the participant cap belongs to players.js, so the stores are sized at boot instead of at definition
function forceInit() {
	forceState.dir = new Int8Array(PLAYER_CAP);
	forceState.mag = new Float32Array(PLAYER_CAP);
	forceState.held = new Uint8Array(PLAYER_CAP);
	forceState.energy = new Float32Array(PLAYER_CAP);
	forceState.drive = 0;
	for (let id = 0; id < players.count; id++) forceState.energy[id] = forceCapacity;
	forceBuildReadout();
}

function forceSetCost(cost) {
	forceCost = cost > 0 ? cost : 0;
}

// a store size is a setting, not a source constant: shrinking clamps what a participant still has, and
// nothing outside this file has to touch the energy array to apply it
function forceSetCapacity(capacity) {
	forceCapacity = capacity > 0 ? capacity : 0;
	for (let id = 0; id < players.count; id++) {
		if (forceState.energy[id] > forceCapacity) forceState.energy[id] = forceCapacity;
	}
	for (let id = 0; id < forceReadout.rows.length; id++) forceReadout.rows[id].shown = -1;
}

function forceSetDirection(id, dir) {
	if (id < 0 || id >= players.count) return;
	forceState.dir[id] = dir < 0 ? -1 : (dir > 0 ? 1 : 0);
}

function forceSetMagnitude(id, mag) {
	if (id < 0 || id >= players.count) return;
	forceState.mag[id] = mag < 0 ? 0 : (mag > 1 ? 1 : mag);
}

// a request exists only while a control holds it; direction and magnitude outlive the hold as the
// control's own position, so a release stops the force without losing the chosen strength
function forceHold(id, on) {
	if (id < 0 || id >= players.count) return;
	forceState.held[id] = on ? 1 : 0;
}

function forceClear(id) {
	forceHold(id, false);
}

// a store pays for the magnitude it asked for or for what it can still afford, and it pays even when
// the aperture is blocked or another request cancels the movement
function forceFund(id, dt) {
	const st = forceState;
	let e = st.energy[id] + FORCE_RECHARGE * dt;
	if (e > forceCapacity) e = forceCapacity;
	const mag = st.held[id] ? st.mag[id] : 0;
	let cost = forceCost * mag * dt;
	let paid = mag;
	if (cost > e) {
		paid = cost > 0 ? mag * e / cost : 0;
		cost = e;
	}
	st.energy[id] = e - cost;
	return st.dir[id] * paid;
}

// funded requests sum and clamp, so two stores pushing harder than the hole allows move it no faster
// than one at full strength, and equal opposites cancel while each still pays its own bill
function forceDrive(dt) {
	let sum = 0;
	for (let id = 0; id < players.count; id++) sum += forceFund(id, dt);
	if (sum > 1) sum = 1;
	else if (sum < -1) sum = -1;
	forceState.drive = sum;
	return sum;
}

function forceBuildReadout() {
	const el = $('force-stores');
	forceReadout.el = el;
	forceReadout.rows.length = 0;
	if (!el) return;
	el.textContent = '';
	const frag = document.createDocumentFragment();
	for (let id = 0; id < players.count; id++) frag.append(forceBuildStore(id));
	el.append(frag);
}

function forceBuildStore(id) {
	const row = document.createElement('div');
	row.className = 'force-store';
	const name = document.createElement('span');
	name.className = 'force-store-name';
	name.textContent = 'P' + (id + 1);
	const bar = document.createElement('span');
	bar.className = 'force-bar';
	const fill = document.createElement('i');
	bar.append(fill);
	const num = document.createElement('span');
	num.className = 'force-num';
	row.append(name, bar, num);
	forceReadout.rows.push({ fill, num, shown: -1 });
	return row;
}

// the one view model every presenter reads: what the store has left as a share of capacity, and what
// the participant asks for right now. a caller may pass its own buffer instead of sharing the scratch
function forceView(id, out) {
	const v = out || forceReadout.view;
	v.energy = forceState.energy[id];
	v.share = forceCapacity > 0 ? forceState.energy[id] / forceCapacity : 0;
	v.dir = forceState.dir[id];
	v.mag = forceState.mag[id];
	v.held = forceState.held[id] === 1;
	return v;
}

// energy moves every step, so the readout only touches the dom when the whole number it shows changes
function forcePaint() {
	for (let id = 0; id < forceReadout.rows.length; id++) {
		const row = forceReadout.rows[id];
		const view = forceView(id);
		const e = Math.round(view.energy);
		if (e === row.shown) continue;
		row.shown = e;
		row.num.textContent = String(e);
		row.fill.style.width = Math.round(view.share * 100) + '%';
	}
}

if (typeof module !== 'undefined') module.exports = {
	forceState,
	forceReadout,
	forceInit,
	forceSetCost,
	forceSetCapacity,
	forceSetDirection,
	forceSetMagnitude,
	forceHold,
	forceClear,
	forceDrive,
	forceView,
	forcePaint,
	FORCE_CAPACITY,
	FORCE_RECHARGE,
	FORCE_COST
};
