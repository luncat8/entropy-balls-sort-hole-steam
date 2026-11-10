// owns: color conversions and warm/cold/near-target tests
// edit for: palette hues, hue boundaries, distance metric, hue tables

const PALETTE = [
	['red', 0], ['orange', 35], ['yellow', 60],
	['cyan', 190], ['blue', 225], ['violet', 270]
];

const HUE_WARM_MAX = 90;
const HUE_COLD_MIN = 180;
const HUE_COLD_MAX = 300;

// every spawned ball uses this envelope, so a goal preview drawn from it matches the field
const BALL_SAT_MIN = 0.6;
const BALL_SAT_MAX = 0.9;
const BALL_LIGHT_MIN = 0.5;
const BALL_LIGHT_MAX = 0.75;

// green and magenta fall between the warm and cold bands and read neutral
function colorIsWarm(hue) {
	return hue < HUE_WARM_MAX;
}

function colorIsCold(hue) {
	return hue >= HUE_COLD_MIN && hue < HUE_COLD_MAX;
}

function colorHueDist(a, b) {
	const d = Math.abs(a - b) % 360;
	return d > 180 ? 360 - d : d;
}

function colorHueNear(hue, target, tol) {
	return colorHueDist(hue, target) <= tol;
}

// circular mean: summing unit vectors keeps 350 and 10 degrees adjacent instead of antipodal
function colorMeanHue(a, b) {
	const rad = Math.PI / 180;
	const x = Math.cos(a * rad) + Math.cos(b * rad);
	const y = Math.sin(a * rad) + Math.sin(b * rad);
	if (x === 0 && y === 0) return a;
	const mean = Math.atan2(y, x) / rad;
	return ((mean % 360) + 360) % 360;
}

const SECTOR_PICK = [[0, 1, 2], [1, 0, 2], [2, 0, 1], [2, 1, 0], [1, 2, 0], [0, 2, 1]];
const hslV = [0, 0, 0];

// packed 0xRRGGBB; sector table plus scratch keeps the spawn path allocation-free
function colorHslToRgb(h, s, l) {
	const hn = (((h % 360) + 360) % 360) / 360;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const m = l - c / 2;
	hslV[0] = c;
	hslV[1] = c * (1 - Math.abs((hn * 6) % 2 - 1));
	hslV[2] = 0;
	const pick = SECTOR_PICK[(hn * 6) | 0];
	return (Math.round((hslV[pick[0]] + m) * 255) << 16)
		| (Math.round((hslV[pick[1]] + m) * 255) << 8)
		| Math.round((hslV[pick[2]] + m) * 255);
}

function colorCss(packed) {
	return '#' + packed.toString(16).padStart(6, '0');
}

// hue of a packed RGB color; the mode tint stores hue and rebuilds RGB from a precomputed table
function colorRgbHue(packed) {
	const r = ((packed >> 16) & 255) / 255;
	const g = ((packed >> 8) & 255) / 255;
	const b = (packed & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	if (d === 0) return 0;
	let h = max === r ? (g - b) / d : (max === g ? (b - r) / d + 2 : (r - g) / d + 4);
	h *= 60;
	return h < 0 ? h + 360 : h;
}

function colorNearestPalette(hue) {
	let best = 0;
	let gap = 361;
	for (let p = 0; p < PALETTE.length; p++) {
		const d = colorHueDist(hue, PALETTE[p][1]);
		if (d >= gap) continue;
		gap = d;
		best = p;
	}
	return best;
}

if (typeof module !== 'undefined') module.exports = {
	PALETTE,
	BALL_SAT_MIN,
	BALL_SAT_MAX,
	BALL_LIGHT_MIN,
	BALL_LIGHT_MAX,
	colorIsWarm,
	colorIsCold,
	colorHueDist,
	colorHueNear,
	colorMeanHue,
	colorHslToRgb,
	colorCss,
	colorRgbHue,
	colorNearestPalette
};
