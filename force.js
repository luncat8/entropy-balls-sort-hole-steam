// owns: per-participant hole requests, energy stores, funding and the combined drive
// edit for: energy rates, funding rules and force views

const FORCE_CAPACITY = 100;
const FORCE_RECHARGE = 10;
const FORCE_COST = 25;
const FORCE_PREVIEW_SECONDS = 2;

const forceState = { dir: null, mag: null, held: null, energy: null, applied: null, drive: 0 };
const forceViewScratch = { energy: 0, capacity: 0, share: 0, dir: 0, mag: 0, held: false, applied: 0, cost2s: 0 };

let forceCost = FORCE_COST;
let forceCapacity = FORCE_CAPACITY;

function forceInit() {
	forceState.dir = new Int8Array(PLAYER_CAP);
	forceState.mag = new Float32Array(PLAYER_CAP);
	forceState.held = new Uint8Array(PLAYER_CAP);
	forceState.energy = new Float32Array(PLAYER_CAP);
	forceState.applied = new Float32Array(PLAYER_CAP);
	forceState.energy.fill(forceCapacity);
	forceState.drive = 0;
}

function forceSetCost(cost) {
	forceCost = cost > 0 ? cost : 0;
}

function forceSetCapacity(capacity) {
	forceCapacity = capacity > 0 ? capacity : 0;
	if (!forceState.energy) return;
	for (let id = 0; id < PLAYER_CAP; id++) {
		if (id >= players.count || forceState.energy[id] > forceCapacity) forceState.energy[id] = forceCapacity;
	}
}

function forceSetDirection(id, dir) {
	if (id < 0 || id >= players.count) return;
	const next = dir < 0 ? -1 : (dir > 0 ? 1 : 0);
	if (forceState.dir[id] !== next) forceState.applied[id] = 0;
	forceState.dir[id] = next;
}

function forceSetMagnitude(id, mag) {
	if (id < 0 || id >= players.count) return;
	const next = mag < 0 ? 0 : (mag > 1 ? 1 : mag);
	if (Math.abs(forceState.mag[id] - next) > 1e-6) forceState.applied[id] = 0;
	forceState.mag[id] = next;
}

// Releasing stops the request without discarding the selected direction and strength.
function forceHold(id, on) {
	if (id < 0 || id >= players.count) return;
	forceState.held[id] = on ? 1 : 0;
	if (!on) forceState.applied[id] = 0;
}

function forceClear(id) {
	forceHold(id, false);
}

// Stores pay even at a blocked endpoint or when another participant cancels their request.
function forceFund(id, dt) {
	const st = forceState;
	let e = st.energy[id] + FORCE_RECHARGE * dt;
	if (e > forceCapacity) e = forceCapacity;
	const mag = st.held[id] && st.dir[id] !== 0 ? st.mag[id] : 0;
	let cost = forceCost * mag * dt;
	let paid = mag;
	if (cost > e) {
		paid = cost > 0 ? mag * e / cost : 0;
		cost = e;
	}
	st.energy[id] = e - cost;
	st.applied[id] = st.dir[id] * paid;
	return st.applied[id];
}

function forceDrive(dt) {
	let sum = 0;
	for (let id = 0; id < players.count; id++) sum += forceFund(id, dt);
	if (sum > 1) sum = 1;
	else if (sum < -1) sum = -1;
	forceState.drive = sum;
	return sum;
}

// cost2s is a gross hold-cost preview; recharge continues while the force is held.
function forceView(id, out) {
	const v = out || forceViewScratch;
	v.energy = forceState.energy[id];
	v.capacity = forceCapacity;
	v.share = forceCapacity > 0 ? v.energy / forceCapacity : 0;
	v.dir = forceState.dir[id];
	v.mag = forceState.mag[id];
	v.held = forceState.held[id] === 1;
	v.applied = forceState.applied[id];
	v.cost2s = v.dir === 0 ? 0 : forceCost * v.mag * FORCE_PREVIEW_SECONDS;
	return v;
}

if (typeof module !== 'undefined') module.exports = {
	forceState,
	forceInit,
	forceSetCost,
	forceSetCapacity,
	forceSetDirection,
	forceSetMagnitude,
	forceHold,
	forceClear,
	forceDrive,
	forceView,
	FORCE_CAPACITY,
	FORCE_RECHARGE,
	FORCE_COST,
	FORCE_PREVIEW_SECONDS
};
