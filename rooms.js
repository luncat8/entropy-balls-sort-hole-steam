// owns: colored rooms — generation, tint, walls/holes, physics and forecast support
// edit for: room layout, wall thickness, tint rate, hole ratio

const ROOMS_TINT_RATE = 110;
const ROOMS_COUNT_MIN = 3;
const ROOMS_COUNT_MAX = 5;
const ROOMS_WALL_HOLE = 0.38;
const ROOMS_TINT_SHARE = 0.10;

const roomsState = {
	enabled: false,
	count: 0,
	rooms: [],
	rand: 0,
	hue: null,
	bucket: null,
	hueCount: 0
};
const roomsHitOut = { nx: 0, ny: 0, overlap: 0 };
const roomsRayOut = { dist: 0, x: 0, y: 0, nx: 0, ny: 0 };

function roomsRand() {
	roomsState.rand = (Math.imul(roomsState.rand, 1664525) + 1013904223) >>> 0;
	return roomsState.rand / 4294967296;
}

function roomsHueInit() {
	const cap = simBalls.x.length;
	if (!roomsState.hue || roomsState.hue.length < cap) {
		roomsState.hue = new Float32Array(cap);
		roomsState.bucket = new Int16Array(cap);
	}
	roomsState.hueCount = 0;
}

function roomsEnsureHues() {
	if (roomsState.hueCount > simBalls.count) roomsState.hueCount = simBalls.count;
	for (let i = roomsState.hueCount; i < simBalls.count; i++) {
		const hue = colorRgbHue(simBalls.rgb[i]);
		roomsState.hue[i] = hue;
		roomsState.bucket[i] = hue | 0;
	}
	roomsState.hueCount = simBalls.count;
}

function roomsRemoveBall(i, last) {
	if (!roomsState.hue || roomsState.hueCount <= 0) return;
	if (i !== last && i < roomsState.hueCount) {
		const hue = last < roomsState.hueCount ? roomsState.hue[last] : colorRgbHue(simBalls.rgb[last]);
		roomsState.hue[i] = hue;
		roomsState.bucket[i] = hue | 0;
	}
	if (roomsState.hueCount > last) roomsState.hueCount = last;
}

function roomsBallOwner(i) {
	return modeColorOwner(roomsState.hue[i]);
}

function roomsSyncBounds(rm) {
	let minX = rm.x, maxX = rm.x + rm.w, minY = rm.y, maxY = rm.y + rm.h;
	for (let s = 0; s < rm.walls.length; s++) {
		const seg = rm.walls[s];
		const loX = seg.x1 < seg.x2 ? seg.x1 : seg.x2;
		const hiX = seg.x1 > seg.x2 ? seg.x1 : seg.x2;
		const loY = seg.y1 < seg.y2 ? seg.y1 : seg.y2;
		const hiY = seg.y1 > seg.y2 ? seg.y1 : seg.y2;
		if (loX < minX) minX = loX;
		if (hiX > maxX) maxX = hiX;
		if (loY < minY) minY = loY;
		if (hiY > maxY) maxY = hiY;
		if (hiX - loX < 0.5) { seg.axis = 1; seg.pos = seg.x1; seg.lo = loY; seg.hi = hiY; }
		else if (hiY - loY < 0.5) { seg.axis = 2; seg.pos = seg.y1; seg.lo = loX; seg.hi = hiX; }
		else seg.axis = 0;
	}
	rm.minX = minX;
	rm.maxX = maxX;
	rm.minY = minY;
	rm.maxY = maxY;
}

function roomsOverlap(a, b) {
	if (a.x + a.w < b.x || b.x + b.w < a.x) return false;
	if (a.y + a.h < b.y || b.y + b.h < a.y) return false;
	const interW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
	const interH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
	return interW * interH > Math.min(a.w * a.h, b.w * b.h) * 0.18;
}

function roomsMakeCorner(owner, w, h) {
	const corner = (roomsRand() * 4) | 0;
	const sx = w * (0.18 + roomsRand() * 0.12);
	const sy = h * (0.18 + roomsRand() * 0.12);
	let x = 0, y = 0, rx = 0, ry = 0;
	const walls = [];
	if (corner === 0) {
		x = 0; y = 0; rx = sx; ry = sy;
		walls.push({ x1: rx, y1: 0, x2: rx, y2: ry }, { x1: 0, y1: ry, x2: rx, y2: ry });
	} else if (corner === 1) {
		x = w - sx; y = 0; rx = w - sx; ry = sy;
		walls.push({ x1: rx, y1: 0, x2: rx, y2: ry }, { x1: rx, y1: ry, x2: w, y2: ry });
	} else if (corner === 2) {
		x = 0; y = h - sy; rx = sx; ry = h - sy;
		walls.push({ x1: rx, y1: ry, x2: rx, y2: h }, { x1: 0, y1: ry, x2: rx, y2: ry });
	} else {
		x = w - sx; y = h - sy; rx = w - sx; ry = h - sy;
		walls.push({ x1: rx, y1: ry, x2: rx, y2: h }, { x1: rx, y1: ry, x2: w, y2: ry });
	}
	const holeWall = (roomsRand() * walls.length) | 0;
	const withHole = roomsSplitWall(walls[holeWall]);
	walls.splice(holeWall, 1, withHole[0], withHole[1]);
	const rm = { x, y, w: rx - x + (corner % 2 === 0 ? sx : w - rx), h: ry - y + (corner < 2 ? sy : h - ry), owner, walls, tintX: x, tintY: y, tintW: sx, tintH: sy, type: 'corner' };
	roomsSyncBounds(rm);
	return rm;
}

function roomsMakeSide(owner, w, h) {
	const side = (roomsRand() * 4) | 0;
	const pw = w * (0.14 + roomsRand() * 0.09);
	const ph = h * (0.18 + roomsRand() * 0.12);
	let x = 0, y = 0;
	const walls = [];
	if (side === 0) {
		x = 0;
		y = Math.min(h - ph - 4, h * (0.08 + roomsRand() * 0.55));
		walls.push({ x1: 0, y1: y, x2: pw, y2: y }, { x1: pw, y1: y, x2: pw, y2: y + ph }, { x1: 0, y1: y + ph, x2: pw, y2: y + ph });
	} else if (side === 1) {
		x = w - pw;
		y = Math.min(h - ph - 4, h * (0.08 + roomsRand() * 0.55));
		walls.push({ x1: w - pw, y1: y, x2: w, y2: y }, { x1: w - pw, y1: y, x2: w - pw, y2: y + ph }, { x1: w - pw, y1: y + ph, x2: w, y2: y + ph });
	} else if (side === 2) {
		x = Math.min(w - pw - 4, w * (0.08 + roomsRand() * 0.55));
		y = 0;
		walls.push({ x1: x, y1: 0, x2: x, y2: ph }, { x1: x, y1: ph, x2: x + pw, y2: ph }, { x1: x + pw, y1: 0, x2: x + pw, y2: ph });
	} else {
		x = Math.min(w - pw - 4, w * (0.08 + roomsRand() * 0.55));
		y = h - ph;
		walls.push({ x1: x, y1: y, x2: x, y2: h }, { x1: x, y1: y, x2: x + pw, y2: y }, { x1: x + pw, y1: y, x2: x + pw, y2: h });
	}
	const withHole = roomsSplitWall(walls[1]);
	walls.splice(1, 1, withHole[0], withHole[1]);
	const bx = side === 0 ? 0 : (side === 1 ? w - pw : x);
	const by = side === 2 ? 0 : (side === 3 ? h - ph : y);
	const rm = { x: bx, y: by, w: pw, h: ph, owner, walls, tintX: bx, tintY: by, tintW: pw, tintH: ph, type: 'side' };
	roomsSyncBounds(rm);
	return rm;
}

function roomsMakeTint(owner, w, h) {
	const side = (roomsRand() * 4) | 0;
	const pw = w * (0.14 + roomsRand() * 0.08);
	const ph = h * (0.14 + roomsRand() * 0.10);
	let x = 0, y = 0;
	if (side === 0) { x = 0; y = h * (0.08 + roomsRand() * 0.60); }
	else if (side === 1) { x = w - pw; y = h * (0.08 + roomsRand() * 0.60); }
	else if (side === 2) { x = w * (0.08 + roomsRand() * 0.60); y = 0; }
	else { x = w * (0.08 + roomsRand() * 0.60); y = h - ph; }
	const rm = { x, y, w: pw, h: ph, owner, walls: [], tintX: x, tintY: y, tintW: pw, tintH: ph, type: 'tint' };
	roomsSyncBounds(rm);
	return rm;
}

function roomsSplitWall(wall) {
	const dx = wall.x2 - wall.x1;
	const dy = wall.y2 - wall.y1;
	const len = Math.sqrt(dx * dx + dy * dy) || 1;
	const half = len * ROOMS_WALL_HOLE * 0.5;
	const ux = dx / len;
	const uy = dy / len;
	const cx = wall.x1 + dx * 0.5;
	const cy = wall.y1 + dy * 0.5;
	return [
		{ x1: wall.x1, y1: wall.y1, x2: cx - ux * half, y2: cy - uy * half },
		{ x1: cx + ux * half, y1: cy + uy * half, x2: wall.x2, y2: wall.y2 }
	];
}

function roomsGenerate() {
	const w = simField.w;
	const h = simField.h;
	roomsState.rooms.length = 0;
	roomsState.count = 0;
	const n = ROOMS_COUNT_MIN + ((roomsRand() * (ROOMS_COUNT_MAX - ROOMS_COUNT_MIN + 1)) | 0);
	for (let attempt = 0; attempt < n * 12 && roomsState.count < n; attempt++) {
		const owner = (roomsRand() * 3) | 0;
		const kind = roomsRand();
		const room = kind < 0.28 ? roomsMakeTint(owner, w, h)
			: (kind < 0.62 ? roomsMakeCorner(owner, w, h) : roomsMakeSide(owner, w, h));
		let bad = false;
		for (let k = 0; k < roomsState.count; k++) if (roomsOverlap(room, roomsState.rooms[k])) { bad = true; break; }
		if (bad) continue;
		room._w = w; room._h = h;
		roomsState.rooms[roomsState.count++] = room;
	}
	if (roomsState.count === 0) {
		const room = roomsMakeTint(0, w, h);
		room._w = w; room._h = h;
		roomsState.rooms[0] = room;
		roomsState.count = 1;
	}
}

function roomsInit() {
	roomsHueInit();
	roomsState.rand = 0x2f6b1d ^ 0x9e3779;
	roomsGenerate();
	roomsEnsureHues();
}

function roomsSetEnabled(on) {
	roomsState.enabled = !!on;
	if (roomsState.enabled && roomsState.count === 0) roomsGenerate();
}

function roomsResize() {
	const w = simField.w;
	const h = simField.h;
	if (!roomsState.rooms.length) return;
	for (let k = 0; k < roomsState.count; k++) {
		const rm = roomsState.rooms[k];
		const sx = w / (rm._w || w);
		const sy = h / (rm._h || h);
		rm.x *= sx; rm.y *= sy; rm.w *= sx; rm.h *= sy;
		rm.tintX *= sx; rm.tintY *= sy; rm.tintW *= sx; rm.tintH *= sy;
		for (let ww = 0; ww < rm.walls.length; ww++) {
			const seg = rm.walls[ww];
			seg.x1 *= sx; seg.y1 *= sy; seg.x2 *= sx; seg.y2 *= sy;
		}
		rm._w = w; rm._h = h;
		roomsSyncBounds(rm);
	}
}

function roomsDrawBackground(ctx) {
	if (!roomsState.enabled) return;
	for (let k = 0; k < roomsState.count; k++) {
		const rm = roomsState.rooms[k];
		ctx.fillStyle = MODE_ROOM_FILL[rm.owner];
		ctx.fillRect(rm.tintX, rm.tintY, rm.tintW, rm.tintH);
		ctx.strokeStyle = MODE_CSS[rm.owner];
		ctx.lineWidth = 1.2;
		ctx.strokeRect(rm.tintX, rm.tintY, rm.tintW, rm.tintH);
	}
}

function roomsDrawWalls(ctx) {
	if (!roomsState.enabled) return;
	ctx.lineWidth = simField.wallT * 0.9;
	for (let k = 0; k < roomsState.count; k++) {
		const rm = roomsState.rooms[k];
		if (!rm.walls.length) continue;
		ctx.strokeStyle = MODE_CSS[rm.owner];
		ctx.beginPath();
		for (let w = 0; w < rm.walls.length; w++) {
			const seg = rm.walls[w];
			ctx.moveTo(seg.x1, seg.y1);
			ctx.lineTo(seg.x2, seg.y2);
		}
		ctx.stroke();
	}
}

function roomsTint(dt) {
	roomsEnsureHues();
	if (!roomsState.enabled) return;
	const step = ROOMS_TINT_RATE * dt;
	for (let i = 0; i < simBalls.count; i++) {
		const x = simBalls.x[i];
		const y = simBalls.y[i];
		let owner = -1;
		for (let k = 0; k < roomsState.count; k++) {
			const rm = roomsState.rooms[k];
			if (x < rm.tintX || x > rm.tintX + rm.tintW || y < rm.tintY || y > rm.tintY + rm.tintH) continue;
			owner = rm.owner;
			break;
		}
		if (owner < 0) continue;
		const hue = modeColorToward(roomsState.hue[i], owner, step);
		roomsState.hue[i] = hue;
		const bucket = hue | 0;
		if (bucket === roomsState.bucket[i]) continue;
		roomsState.bucket[i] = bucket;
		simBalls.rgb[i] = modeColorRgb(bucket);
		simBalls.css[i] = modeColorCssOfHue(bucket);
		simBalls.palette[i] = modeColorPalette(bucket);
	}
}

// writes into roomsHitOut so 120 Hz substep collision checks stay completely allocation-free
function roomsSegmentHit(px, py, r, seg) {
	const abx = seg.x2 - seg.x1, aby = seg.y2 - seg.y1;
	const apx = px - seg.x1, apy = py - seg.y1;
	const ab2 = abx * abx + aby * aby || 1;
	let t = (apx * abx + apy * aby) / ab2;
	if (t < 0) t = 0; else if (t > 1) t = 1;
	const dx = px - (seg.x1 + abx * t);
	const dy = py - (seg.y1 + aby * t);
	const dist2 = dx * dx + dy * dy;
	if (dist2 >= r * r) return false;
	const dist = Math.sqrt(dist2) || 1;
	roomsHitOut.nx = dx / dist;
	roomsHitOut.ny = dy / dist;
	roomsHitOut.overlap = r - dist + 0.02;
	return true;
}

function roomsWallBounce(i) {
	if (!roomsState.enabled) return false;
	const x = simBalls.x[i];
	const y = simBalls.y[i];
	const r = simBalls.r[i];
	const vx = simBalls.vx[i];
	const vy = simBalls.vy[i];
	for (let k = 0; k < roomsState.count; k++) {
		const rm = roomsState.rooms[k];
		if (!rm.walls.length) continue;
		if (x + r < rm.minX || x - r > rm.maxX || y + r < rm.minY || y - r > rm.maxY) continue;
		for (let s = 0; s < rm.walls.length; s++) {
			if (!roomsSegmentHit(x, y, r, rm.walls[s])) continue;
			const dot = vx * roomsHitOut.nx + vy * roomsHitOut.ny;
			if (dot >= 0) continue;
			simBalls.vx[i] = vx - 2 * dot * roomsHitOut.nx;
			simBalls.vy[i] = vy - 2 * dot * roomsHitOut.ny;
			simBalls.x[i] = x + roomsHitOut.nx * roomsHitOut.overlap;
			simBalls.y[i] = y + roomsHitOut.ny * roomsHitOut.overlap;
			return true;
		}
	}
	return false;
}

function roomsRaySeg(ray, seg, r) {
	const rad = r || 0;
	const axis = seg.axis !== undefined ? seg.axis
		: (Math.abs(seg.x1 - seg.x2) < 0.5 ? 1 : (Math.abs(seg.y1 - seg.y2) < 0.5 ? 2 : 0));
	if (axis === 1) {
		if (ray.ux === 0) return -1;
		const wx = seg.pos !== undefined ? seg.pos : seg.x1;
		const faceX = Math.abs(wx - ray.x) <= rad ? wx : (ray.ux > 0 ? wx - rad : wx + rad);
		const t = (faceX - ray.x) / ray.ux;
		if (t <= 1e-6) return -1;
		const y = ray.y + ray.uy * t;
		const lo = (seg.lo !== undefined ? seg.lo : Math.min(seg.y1, seg.y2)) - rad * 0.5 - 0.5;
		const hi = (seg.hi !== undefined ? seg.hi : Math.max(seg.y1, seg.y2)) + rad * 0.5 + 0.5;
		return y >= lo && y <= hi ? t : -1;
	}
	if (axis === 2) {
		if (ray.uy === 0) return -1;
		const wy = seg.pos !== undefined ? seg.pos : seg.y1;
		const faceY = Math.abs(wy - ray.y) <= rad ? wy : (ray.uy > 0 ? wy - rad : wy + rad);
		const t = (faceY - ray.y) / ray.uy;
		if (t <= 1e-6) return -1;
		const x = ray.x + ray.ux * t;
		const lo = (seg.lo !== undefined ? seg.lo : Math.min(seg.x1, seg.x2)) - rad * 0.5 - 0.5;
		const hi = (seg.hi !== undefined ? seg.hi : Math.max(seg.x1, seg.x2)) + rad * 0.5 + 0.5;
		return x >= lo && x <= hi ? t : -1;
	}
	const sdx = seg.x2 - seg.x1, sdy = seg.y2 - seg.y1;
	const denom = ray.ux * sdy - ray.uy * sdx;
	if (Math.abs(denom) < 1e-9) return -1;
	const t = ((seg.x1 - ray.x) * sdy - (seg.y1 - ray.y) * sdx) / denom;
	const u = ((seg.x1 - ray.x) * ray.uy - (seg.y1 - ray.y) * ray.ux) / denom;
	return t > 1e-6 && u >= 0 && u <= 1 ? t : -1;
}

function roomsRayHit(ray, r) {
	if (!roomsState.enabled) return null;
	let best = Infinity;
	let bestSeg = null;
	for (let k = 0; k < roomsState.count; k++) {
		const rm = roomsState.rooms[k];
		for (let s = 0; s < rm.walls.length; s++) {
			const seg = rm.walls[s];
			const t = roomsRaySeg(ray, seg, r);
			if (t > 1e-6 && t < best) { best = t; bestSeg = seg; }
		}
	}
	if (!bestSeg) return null;
	roomsRayOut.dist = best;
	roomsRayOut.x = ray.x + ray.ux * best;
	roomsRayOut.y = ray.y + ray.uy * best;
	const vertical = bestSeg.axis !== undefined ? bestSeg.axis === 1 : Math.abs(bestSeg.x1 - bestSeg.x2) < 0.01;
	roomsRayOut.nx = vertical ? (ray.ux > 0 ? -1 : 1) : 0;
	roomsRayOut.ny = vertical ? 0 : (ray.uy > 0 ? -1 : 1);
	return roomsRayOut;
}

if (typeof module !== 'undefined') module.exports = {
	roomsState, roomsInit, roomsSetEnabled, roomsGenerate, roomsResize, roomsDrawBackground, roomsDrawWalls,
	roomsTint, roomsWallBounce, roomsRayHit, roomsEnsureHues, roomsRemoveBall, roomsBallOwner, roomsHueInit
};
