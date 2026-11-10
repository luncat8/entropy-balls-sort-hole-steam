// owns: the forecast of one ball's centre path — screen-edge bounces, the divider's whole-body fit, the hit or the pass
// edit for: path events, end states, point budget

// The forecast is the simulation's own rules run ahead with the hole standing still: the centre turns one
// radius off a screen edge, meets the divider one radius before its centre line, and gets through only if
// the whole body stays inside the opening up to that line (simWallBounce, simDividerTouch). Change them
// together. Ball contacts and a moving hole are not forecast.
const TRAJ_POINTS = 10;
const TRAJ_NONE = 0;
const TRAJ_HIT = 1;
const TRAJ_PASS = 2;

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

// the flight length to the plane with every edge bounce on the way, or -1 when the plane lies past the
// reach or past the points the path may still use
function trajFlight(ray, out, planeX, r, reach, points) {
	let dist = 0;
	while (out.n < points) {
		dist += trajLeg(ray, planeX, r, simField.h - r);
		if (dist > reach) return -1;
		if (ray.x === planeX) return dist;
		ray.uy = -ray.uy;
		trajPoint(out, ray);
	}
	return -1;
}

// true when the body stays inside the opening from first touch to the centre line; otherwise the ray
// stops where the plate turns the ball back, which is a lip when the body drifts onto it part-way
function trajThrough(ray, out, r) {
	const half = simAperture.size / 2;
	const top = simAperture.y - half + r - APERTURE_FIT_SLACK;
	const bot = simAperture.y + half - r + APERTURE_FIT_SLACK;
	if (ray.y < top || ray.y > bot) return false;
	const lo = r;
	const hi = simField.h - r;
	while (out.n < TRAJ_POINTS - 2) {
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
function trajTrace(x, y, vx, vy, r, reach, out) {
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
	out.dist = trajFlight(ray, out, f.wallX - dir * r, r, reach, TRAJ_POINTS - 3);
	if (out.dist < 0) return TRAJ_NONE;
	out.side = -dir;
	out.end = TRAJ_HIT;
	if (trajThrough(ray, out, r)) {
		out.end = TRAJ_PASS;
		trajFlight(ray, out, f.wallX + dir * r, r, Infinity, TRAJ_POINTS - 1);
	}
	trajPoint(out, ray);
	return out.end;
}

if (typeof module !== 'undefined') module.exports = {
	trajPath, trajTrace, TRAJ_POINTS, TRAJ_NONE, TRAJ_HIT, TRAJ_PASS
};
