// owns: the fixed-capacity color-painted central wall — segments, localized blending, shares, passages
// edit for: segment capacity, blend rate, match blend, merge policy

const TP_SEG_CAP = 96;
const TP_SEED_CELLS = 20;
const TP_PAINT_STEP = 0.09;
const TP_MATCH_BLEND = 0.34;
const TP_MERGE_EPS = 0.06;

const territoryPaint = {
	y: new Float32Array(TP_SEG_CAP),
	h: new Float32Array(TP_SEG_CAP),
	owner: new Uint8Array(TP_SEG_CAP),
	blend: new Float32Array(TP_SEG_CAP),
	count: 0,
	wallTop: 0,
	wallH: 1
};
const territoryPaintSpanOut = { lo: 0, hi: 0 };

function territoryPaintIndexAt(pos) {
	const p = pos < territoryPaint.wallTop ? territoryPaint.wallTop
		: (pos > territoryPaint.wallTop + territoryPaint.wallH ? territoryPaint.wallTop + territoryPaint.wallH : pos);
	for (let k = 0; k < territoryPaint.count; k++) {
		if (p < territoryPaint.y[k] + territoryPaint.h[k]) return k;
	}
	return territoryPaint.count - 1;
}

function territoryPaintInsert(at) {
	if (territoryPaint.count >= TP_SEG_CAP) territoryPaintCompact();
	for (let k = territoryPaint.count; k > at; k--) {
		territoryPaint.y[k] = territoryPaint.y[k - 1];
		territoryPaint.h[k] = territoryPaint.h[k - 1];
		territoryPaint.owner[k] = territoryPaint.owner[k - 1];
		territoryPaint.blend[k] = territoryPaint.blend[k - 1];
	}
	territoryPaint.count++;
}

// splitting at the contact edges is what keeps a repaint local instead of replacing the wall
function territoryPaintSplitAt(pos) {
	const top = territoryPaint.wallTop;
	const bottom = top + territoryPaint.wallH;
	if (pos <= top + 1e-6 || pos >= bottom - 1e-6) return;
	const i = territoryPaintIndexAt(pos);
	if (pos <= territoryPaint.y[i] + 1e-6) return;
	const end = territoryPaint.y[i] + territoryPaint.h[i];
	const cut = pos - territoryPaint.y[i];
	territoryPaintInsert(i + 1);
	territoryPaint.y[i + 1] = pos;
	territoryPaint.h[i + 1] = end - pos;
	territoryPaint.owner[i + 1] = territoryPaint.owner[i];
	territoryPaint.blend[i + 1] = territoryPaint.blend[i];
	territoryPaint.h[i] = cut;
}

function territoryPaintMerge(k) {
	const p = territoryPaint;
	const h0 = p.h[k];
	const h1 = p.h[k + 1];
	const total = h0 + h1;
	const w0 = p.blend[k] * h0;
	const w1 = p.blend[k + 1] * h1;
	if (p.owner[k] !== p.owner[k + 1]) p.owner[k] = w0 >= w1 ? p.owner[k] : p.owner[k + 1];
	p.blend[k] = (w0 >= w1 ? w0 : w1) / total;
	p.h[k] = total;
	for (let j = k + 1; j < p.count - 1; j++) {
		p.y[j] = p.y[j + 1];
		p.h[j] = p.h[j + 1];
		p.owner[j] = p.owner[j + 1];
		p.blend[j] = p.blend[j + 1];
	}
	p.count--;
}

function territoryPaintCompact() {
	let k = 0;
	while (k < territoryPaint.count - 1) {
		const same = territoryPaint.owner[k] === territoryPaint.owner[k + 1]
			&& Math.abs(territoryPaint.blend[k] - territoryPaint.blend[k + 1]) < TP_MERGE_EPS;
		if (same) territoryPaintMerge(k);
		else k++;
	}
	while (territoryPaint.count > TP_SEG_CAP - 8) {
		let best = 0;
		let shortest = Infinity;
		for (let j = 0; j < territoryPaint.count - 1; j++) {
			const total = territoryPaint.h[j] + territoryPaint.h[j + 1];
			if (total >= shortest) continue;
			shortest = total;
			best = j;
		}
		territoryPaintMerge(best);
	}
}

function territoryPaintInit(wallTop, wallH) {
	const p = territoryPaint;
	p.count = 0;
	p.wallTop = wallTop;
	p.wallH = wallH;
	const cell = wallH / TP_SEED_CELLS;
	for (let k = 0; k < TP_SEED_CELLS; k++) {
		p.y[k] = wallTop + k * cell;
		p.h[k] = cell;
		p.owner[k] = MODE_NONE;
		p.blend[k] = 0;
	}
	p.count = TP_SEED_CELLS;
}

function territoryPaintSeed(owner, y0, y1) {
	const p = territoryPaint;
	const a = Math.max(p.wallTop, Math.min(p.wallTop + p.wallH, y0));
	const b = Math.max(p.wallTop, Math.min(p.wallTop + p.wallH, y1));
	if (b <= a) return;
	territoryPaintSplitAt(b);
	territoryPaintSplitAt(a);
	for (let k = 0; k < p.count; k++) {
		const mid = p.y[k] + p.h[k] / 2;
		if (mid < a || mid > b) continue;
		p.owner[k] = owner;
		p.blend[k] = 1;
	}
	territoryPaintCompact();
}

function territoryPaintContact(owner, y, r) {
	const p = territoryPaint;
	const a = Math.max(p.wallTop, Math.min(p.wallTop + p.wallH, y - r));
	const b = Math.max(p.wallTop, Math.min(p.wallTop + p.wallH, y + r));
	if (b <= a) return;
	territoryPaintSplitAt(b);
	territoryPaintSplitAt(a);
	for (let k = 0; k < p.count; k++) {
		const mid = p.y[k] + p.h[k] / 2;
		if (mid < a || mid > b) continue;
		if (p.owner[k] === owner) p.blend[k] = Math.min(1, p.blend[k] + TP_PAINT_STEP);
		else {
			p.blend[k] -= TP_PAINT_STEP;
			if (p.blend[k] <= 0) {
				p.owner[k] = owner;
				p.blend[k] = TP_PAINT_STEP;
			}
		}
	}
	if (p.count > TP_SEG_CAP - 16) territoryPaintCompact();
}

function territoryPaintOwnerAt(pos) {
	const k = territoryPaintIndexAt(pos);
	if (k < 0 || territoryPaint.blend[k] < TP_MATCH_BLEND) return MODE_NONE;
	return territoryPaint.owner[k];
}

// the whole body has to meet the same color from its lower to its upper edge; the samples sit just
// inside the footprint so a segment boundary exactly at a lip still reads as that segment
function territoryPaintPasses(owner, y, r) {
	if (owner === MODE_NONE) return false;
	const e = 0.01;
	return territoryPaintOwnerAt(y - r + e) === owner
		&& territoryPaintOwnerAt(y) === owner
		&& territoryPaintOwnerAt(y + r - e) === owner;
}

function territoryPaintShare(owner) {
	const p = territoryPaint;
	let colored = 0;
	for (let k = 0; k < p.count; k++) {
		if (p.owner[k] === owner && p.blend[k] >= TP_MATCH_BLEND) colored += p.h[k];
	}
	return p.wallH > 0 ? colored / p.wallH : 0;
}

// the nearest contiguous region of one player's color; guns may only move inside it
function territoryPaintSpan(owner, y) {
	const p = territoryPaint;
	let best = Infinity;
	let lo = p.wallTop;
	let hi = p.wallTop;
	for (let k = 0; k < p.count;) {
		if (p.owner[k] !== owner || p.blend[k] < TP_MATCH_BLEND) { k++; continue; }
		const start = p.y[k];
		let end = start;
		while (k < p.count && p.owner[k] === owner && p.blend[k] >= TP_MATCH_BLEND) {
			end = p.y[k] + p.h[k];
			k++;
		}
		const d = Math.abs(y - (start + end) / 2);
		if (d < best) { best = d; lo = start; hi = end; }
	}
	territoryPaintSpanOut.lo = lo;
	territoryPaintSpanOut.hi = hi;
	return territoryPaintSpanOut;
}

function territoryPaintRescale(wallTop, wallH) {
	const p = territoryPaint;
	if (p.count === 0 || p.wallH <= 0) return;
	const ratio = wallH / p.wallH;
	for (let k = 0; k < p.count; k++) {
		p.y[k] = wallTop + (p.y[k] - p.wallTop) * ratio;
		p.h[k] *= ratio;
	}
	p.wallTop = wallTop;
	p.wallH = wallH;
}

if (typeof module !== 'undefined') module.exports = {
	territoryPaint, territoryPaintInit, territoryPaintSeed, territoryPaintContact, territoryPaintCompact,
	territoryPaintOwnerAt, territoryPaintPasses, territoryPaintShare, territoryPaintSpan,
	territoryPaintRescale, TP_SEG_CAP, TP_MATCH_BLEND, TP_PAINT_STEP
};
