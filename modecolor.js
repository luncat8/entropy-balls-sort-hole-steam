// owns: mode hues, the shared match/capture tolerance, room colors and precomputed hue tables
// edit for: player colors, tolerances, tint saturation/light

const MODE_NONE = 0;
const MODE_RED = 1;
const MODE_BLUE = 2;
// one tolerance answers every "is this the player's color" question: capture, passage and display
const MODE_TOL = 30;
const MODE_NEUTRAL_TOL = 55;
const MODE_HUE = [135, 0, 225];
const MODE_CSS = ['#49c77b', '#f05656', '#5b7cff'];
const MODE_ROOM_FILL = ['rgba(73, 199, 123, 0.10)', 'rgba(240, 86, 86, 0.10)', 'rgba(91, 124, 255, 0.10)'];
const MODE_WALL_CSS = ['#495263', 'rgba(240, 86, 86, 0.92)', 'rgba(91, 124, 255, 0.92)'];
const MODE_PASS_FILL = ['rgba(73, 199, 123, 0.20)', 'rgba(240, 86, 86, 0.30)', 'rgba(91, 124, 255, 0.30)'];
const MODE_TINT_SAT = 0.75;
const MODE_TINT_LIGHT = 0.62;

const modeColorTables = {
	ready: false,
	rgb: new Uint32Array(360),
	css: new Array(360),
	palette: new Uint8Array(360)
};

function modecolorInit() {
	if (modeColorTables.ready) return;
	for (let h = 0; h < 360; h++) {
		modeColorTables.rgb[h] = colorHslToRgb(h, MODE_TINT_SAT, MODE_TINT_LIGHT);
		modeColorTables.css[h] = colorCss(modeColorTables.rgb[h]);
		modeColorTables.palette[h] = colorNearestPalette(h);
	}
	modeColorTables.ready = true;
}

function modeColorOwner(hue) {
	if (colorHueNear(hue, MODE_HUE[MODE_RED], MODE_TOL)) return MODE_RED;
	if (colorHueNear(hue, MODE_HUE[MODE_BLUE], MODE_TOL)) return MODE_BLUE;
	return MODE_NONE;
}

function modeColorTarget(owner) {
	return MODE_HUE[owner];
}

// shortest arc on the hue wheel: neutral green can become either player color without a jump
function modeColorToward(hue, owner, maxStep) {
	const delta = ((MODE_HUE[owner] - hue + 540) % 360) - 180;
	if (Math.abs(delta) <= maxStep) return ((MODE_HUE[owner] % 360) + 360) % 360;
	const next = hue + (delta > 0 ? maxStep : -maxStep);
	return ((next % 360) + 360) % 360;
}

function modeColorRgb(bucket) {
	return modeColorTables.rgb[bucket];
}

function modeColorCssOfHue(bucket) {
	return modeColorTables.css[bucket];
}

function modeColorPalette(bucket) {
	return modeColorTables.palette[bucket];
}

if (typeof module !== 'undefined') module.exports = {
	modecolorInit, modeColorTables, modeColorOwner, modeColorTarget, modeColorToward,
	modeColorRgb, modeColorCssOfHue, modeColorPalette,
	MODE_NONE, MODE_RED, MODE_BLUE, MODE_HUE, MODE_TOL, MODE_NEUTRAL_TOL,
	MODE_CSS, MODE_ROOM_FILL, MODE_WALL_CSS, MODE_PASS_FILL
};
