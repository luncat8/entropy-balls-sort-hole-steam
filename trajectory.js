// owns: the forecast of one ball's centre path — screen-edge bounces, the divider's whole-body fit, the hit or the pass
// edit for: path events, end states, point budget, mode passage rule

// The forecast is the simulation's own rules run ahead with the hole standing still: the centre turns one
// radius off a screen edge, meets the divider one radius before its centre line, and gets through only if
// the whole body stays inside the opening up to that line (simWallBounce, simDividerTouch). Change them
// together. Ball contacts and a moving hole are not forecast.
const TRAJ_POINTS = 10;
const TRAJ_NONE = 0;
const TRAJ_HIT = 1;
const TRAJ_PASS = 2;

const TRAJ_LEG_PLANE = 0;
const TRAJ_LEG_EDGE_Y = 1;
const TRAJ_LEG_EDGE_X = 2;
const TRAJ_LEG_WALL = 3;

// dist is the flight length to the first touch of the divider; side is the chamber the ball comes from
const trajPath = {
	n: 0,
	x: new Float32Array(TRAJ_POINTS),
	y: new Float32Array(TRAJ_POINTS),
	end: TRAJ_NONE,
	dist: 0,
	side: 0
};
const trajRay = { x: 0, y: 0, ux: 0, uy: 0 };
// a mode may add its own passage predicate, gate aperture and interior walls; no hook is the standard field
let trajModeHook = null;
let trajLegKind = TRAJ_LEG_PLANE;

function trajSetModeHook(hook) {
	trajModeHook = hook;
}

function trajPoint(out, ray) {
	out.x[out.n] = ray.x;
	out.y[out.n] = ray.y;
	out.n++;
}

// flies to the plane, or to the height limit ahead if that comes first, and returns the length flown;
// the caller tells the two apart by ray.x, which lands on the plane exactly
function trajLeg(ray, planeX, lo, hi) {
	const toPlane = (planeX - ray.x) / ray.ux;
	const limit = ray.uy > 0 ? hi : lo;
	const toLimit = ray.uy === 0 ? Infinity : (limit - ray.y) / ray.uy;
	if (toPlane <= toLimit) {
		ray.y += ray.uy * toPlane;
		ray.x = planeX;
		return toPlane;
	}
	ray.x += ray.ux * toLimit;
	ray.y = limit;
	return toLimit;
}

function trajWallHit(ray, r) {
	let hit = null;
	if (typeof roomsState !== 'undefined' && roomsState.enabled) hit = roomsRayHit(ray, r);
	if (trajModeHook && trajModeHook.wallHit) {
		const modeHit = trajModeHook.wallHit(ray, r);
		if (modeHit && (!hit || modeHit.dist < hit.dist)) hit = modeHit;
	}
	return hit;
}

// when a vertical room wall reverses ray.ux, planeX lies behind the ray and the outer vertical screen
// edge is the x boundary ahead; testing the forward x boundary prevents negative toPlane jumps
function trajLegWalls(ray, planeX, r, lo, hi) {
	const towardPlane = (planeX - ray.x) * ray.ux > 0;
	const targetX = towardPlane ? planeX : (ray.ux < 0 ? r : simField.w - r);
	const toX = ray.ux === 0 ? Infinity : (targetX - ray.x) / ray.ux;
	const limitY = ray.uy > 0 ? hi : lo;
	const toY = ray.uy === 0 ? Infinity : (limitY - ray.y) / ray.uy;
	let best = toX <= toY ? toX : toY;
	let kind = toX <= toY ? (towardPlane ? TRAJ_LEG_PLANE : TRAJ_LEG_EDGE_X) : TRAJ_LEG_EDGE_Y;
	const wall = trajWallHit(ray, r);
	if (wall && wall.dist > 1e-6 && wall.dist < best) {
		best = wall.dist;
		kind = TRAJ_LEG_WALL;
	}
	trajLegKind = kind;
	if (kind === TRAJ_LEG_WALL) {
		ray.x += ray.ux * best;
		ray.y += ray.uy * best;
		if (wall.nx) ray.ux = -ray.ux;
		if (wall.ny) ray.uy = -ray.uy;
		return best;
	}
	if (kind === TRAJ_LEG_PLANE) {
		ray.y += ray.uy * toX;
		ray.x = planeX;
		return toX;
	}
	if (kind === TRAJ_LEG_EDGE_X) {
		ray.y += ray.uy * toX;
		ray.x = targetX;
		ray.ux = -ray.ux;
		return toX;
	}
	ray.x += ray.ux * toY;
	ray.y = limitY;
	ray.uy = -ray.uy;
	return toY;
}

// the flight length to the plane with every edge bounce on the way, or -1 when the plane lies past the
// reach or past the points the path may still use
function trajFlight(ray, out, planeX, r, reach, points) {
	const lo = r;
	const hi = simField.h - r;
	const hasWalls = (typeof roomsState !== 'undefined' && roomsState.enabled)
		|| !!(trajModeHook && trajModeHook.wallHit);
	let dist = 0;
	if (!hasWalls) {
		while (out.n < points) {
			dist += trajLeg(ray, planeX, lo, hi);
			if (dist > reach) return -1;
			if (ray.x === planeX) return dist;
			ray.uy = -ray.uy;
			trajPoint(out, ray);
		}
		return -1;
	}
	while (out.n < points) {
		const flown = trajLegWalls(ray, planeX, r, lo, hi);
		if (flown < 0 || !Number.isFinite(flown)) return -1;
		dist += flown;
		if (dist > reach) return -1;
		if (trajLegKind === TRAJ_LEG_PLANE) return dist;
		trajPoint(out, ray);
	}
	return -1;
}

// true when the body stays inside the opening from first touch to the centre line; otherwise the ray
// stops where the plate turns the ball back, which is a lip when the body drifts onto it part-way.
// A mode's predicate answers painted passages with the same whole-body fit the simulation uses.
function trajThrough(ray, out, r, ballIndex, holeShift, points) {
	if (trajModeHook && trajModeHook.pass && trajModeHook.pass(ballIndex, ray.y, r)) return true;
	const ap = trajModeHook && trajModeHook.aperture ? trajModeHook.aperture : simAperture;
	const half = ap.size / 2;
	const center = ap.y + holeShift;
	const top = center - half + r - APERTURE_FIT_SLACK;
	const bot = center + half - r + APERTURE_FIT_SLACK;
	if (ray.y < top || ray.y > bot) return false;
	const lo = r;
	const hi = simField.h - r;
	while (out.n < points - 2) {
		trajLeg(ray, simField.wallX, top > lo ? top : lo, bot < hi ? bot : hi);
		if (ray.x === simField.wallX) return true;
		// an opening parked on a screen edge has no lip there: the ball bounces on the edge and flies on
		if (ray.uy < 0 ? top > lo : bot < hi) return false;
		ray.uy = -ray.uy;
		trajPoint(out, ray);
	}
	return false;
}

// The path ends where the divider settles the ball's fate: a hit where the plate stops the centre, a pass
// where the body has cleared the divider. What the ball does after that is not forecast.
function trajTrace(x, y, vx, vy, r, reach, out, ballIndex, budget, holeShift) {
	const points = budget || TRAJ_POINTS;
	const f = simField;
	const dir = Math.sign(vx);
	out.n = 0;
	out.end = TRAJ_NONE;
	// flying away from the divider, along it, or already touching it: nothing to forecast
	if ((f.wallX - x) * dir <= r) return TRAJ_NONE;
	const speed = Math.sqrt(vx * vx + vy * vy);
	const ray = trajRay;
	ray.x = x;
	ray.y = y;
	ray.ux = vx / speed;
	ray.uy = vy / speed;
	trajPoint(out, ray);
	out.dist = trajFlight(ray, out, f.wallX - dir * r, r, reach, points - 3);
	if (out.dist < 0) return TRAJ_NONE;
	out.side = -dir;
	out.end = TRAJ_HIT;
	if (trajThrough(ray, out, r, ballIndex === undefined ? -1 : ballIndex, holeShift || 0, points)) {
		out.end = TRAJ_PASS;
		trajFlight(ray, out, f.wallX + dir * r, r, Infinity, points - 1);
	}
	trajPoint(out, ray);
	return out.end;
}

if (typeof module !== 'undefined') module.exports = {
	trajPath, trajTrace, trajSetModeHook, TRAJ_POINTS, TRAJ_NONE, TRAJ_HIT, TRAJ_PASS
};
