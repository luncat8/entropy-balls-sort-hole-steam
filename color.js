// owns: color conversions and warm/cold/near-target tests
// edit for: palette hues, hue boundaries, distance metric

const PALETTE = [
	['red', 0], ['orange', 35], ['yellow', 60],
	['cyan', 190], ['blue', 225], ['violet', 270]
];

const HUE_WARM_MAX = 90;
const HUE_COLD_MIN = 180;
const HUE_COLD_MAX = 300;

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

if (typeof module !== 'undefined') module.exports = { PALETTE, colorIsWarm, colorIsCold, colorHueDist, colorHueNear, colorHslToRgb, colorCss };
