// owns: setting defaults, URL persistence and the settings controls
// edit for: settings keys, URL keys, settings bindings

// Every key is one table entry, so one path reads, encodes and clamps all of them.
const SETTINGS_KEYS = ['friction', 'humans', 'bots', 'balls', 'ballSpeed'];
const settingsDefaults = { friction: false, humans: 1, bots: 0, balls: 24, ballSpeed: 175 };
const settingsState = { friction: false, humans: 1, bots: 0, balls: 24, ballSpeed: 175 };
const settingsUi = {
	panel: null, friction: null, humans: null, balls: null, ballSpeed: null,
	ballsValue: null, ballSpeedValue: null, urlWrap: null, url: null
};

function settingsNumber(raw, min, max, step) {
	const value = Number(raw);
	if (raw === '' || !Number.isFinite(value)) return undefined;
	return Math.max(min, Math.min(max, Math.round(value / step) * step));
}

function settingsNormalize(key, raw) {
	switch (key) {
		case 'friction': return raw === true || raw === '1' || raw === 'true';
		case 'humans': return raw === 2 || raw === '2' || raw === 'two' ? 2 : 1;
		case 'bots': {
			const value = settingsNumber(raw, 0, (1 << PLAYER_CAP) - 1, 1);
			return value === undefined ? settingsDefaults.bots : value;
		}
		case 'balls': {
			const value = settingsNumber(raw, BALL_COUNT_MIN, BALL_CAP, 1);
			return value === undefined ? settingsDefaults.balls : value;
		}
		case 'ballSpeed': {
			const value = settingsNumber(raw, BALL_SPEED_MIN, BALL_SPEED_MAX, 5);
			return value === undefined ? settingsDefaults.ballSpeed : value;
		}
	}
	return undefined;
}

function settingsEncode(key, value) {
	switch (key) {
		case 'friction': return value ? '1' : undefined;
		case 'humans': return value === 2 ? '2' : undefined;
		case 'bots': return value ? String(value) : undefined;
		case 'balls': return value === settingsDefaults.balls ? undefined : String(value);
		case 'ballSpeed': return value === settingsDefaults.ballSpeed ? undefined : String(value);
	}
	return undefined;
}

function settingsParam(key) {
	return key === 'ballSpeed' ? 'speed' : key;
}

function settingsFromSearch(search) {
	const params = new URLSearchParams(search);
	const out = {};
	for (let i = 0; i < SETTINGS_KEYS.length; i++) {
		const key = SETTINGS_KEYS[i];
		const raw = params.get(settingsParam(key));
		out[key] = raw === null ? settingsDefaults[key] : settingsNormalize(key, raw);
	}
	if (out.bots & 2) out.humans = 2;
	return out;
}

function settingsInit() {
	settingsUi.panel = $('settings-panel');
	settingsUi.friction = $('settings-friction');
	settingsUi.humans = $('settings-humans');
	settingsUi.balls = $('settings-balls');
	settingsUi.ballSpeed = $('settings-ball-speed');
	settingsUi.ballsValue = $('settings-balls-value');
	settingsUi.ballSpeedValue = $('settings-ball-speed-value');
	settingsUi.urlWrap = $('settings-url-wrap');
	settingsUi.url = $('settings-url');
	settingsUi.friction.addEventListener('change', settingsFrictionChanged);
	settingsUi.humans.addEventListener('change', settingsHumansChanged);
	settingsUi.balls.addEventListener('input', settingsBallsChanged);
	settingsUi.ballSpeed.addEventListener('input', settingsBallSpeedChanged);
	const url = settingsFromSearch(window.location.search);
	settingsApply(url, false);
	settingsUi.panel.open = !window.matchMedia('(max-width: 700px)').matches;
}

function settingsFrictionChanged() {
	settingsSetFriction(settingsUi.friction.checked, true);
}

function settingsHumansChanged() {
	settingsSetHumans(settingsUi.humans.checked ? 2 : 1, true);
}

function settingsBallsChanged() {
	settingsSetBalls(Number(settingsUi.balls.value), true);
}

function settingsBallSpeedChanged() {
	settingsSetBallSpeed(Number(settingsUi.ballSpeed.value), true);
}

function settingsSync() {
	settingsUi.friction.checked = settingsState.friction;
	settingsUi.humans.checked = settingsState.humans === 2;
	settingsUi.balls.value = String(settingsState.balls);
	settingsUi.ballSpeed.value = String(settingsState.ballSpeed);
	settingsUi.ballsValue.textContent = String(settingsState.balls);
	settingsUi.ballSpeedValue.textContent = settingsState.ballSpeed + ' px/s';
}

function settingsApply(values, updateUrl) {
	const bots = settingsNormalize('bots', values.bots);
	const humans = values.humans === 2 || bots & 2 ? 2 : 1;
	const mask = bots & (humans === 2 ? 3 : 1);
	const balls = settingsNormalize('balls', values.balls);
	const speed = settingsNormalize('ballSpeed', values.ballSpeed);
	const rebuild = humans !== settingsState.humans || mask !== settingsState.bots;
	settingsState.friction = !!values.friction;
	settingsState.humans = humans;
	settingsState.bots = mask;
	settingsState.balls = balls;
	settingsState.ballSpeed = speed;
	settingsSync();
	simSetFriction(settingsState.friction);
	simSetBallSpeed(settingsState.ballSpeed);
	if (simSetBallCount(settingsState.balls)) tasksRegenerate();
	if (rebuild) settingsRebuild();
	if (updateUrl) settingsWriteUrl();
}

// participants and stores first, then reproject human selections and restart only the live objectives
function settingsRebuild() {
	playersInit(settingsState.humans, settingsState.bots);
	forceInit();
	inputRebind();
	botInit();
	tasksRestart();
}

function settingsSetFriction(on, updateUrl) {
	settingsApply({ ...settingsState, friction: on }, updateUrl);
}

function settingsSetHumans(humans, updateUrl) {
	// Choosing a human second player always replaces that slot's bot, even in an already two-slot match.
	settingsApply({ ...settingsState, humans, bots: settingsState.bots & 1 }, updateUrl);
}

function settingsSetBot(id, on, updateUrl) {
	if (id < 0 || id >= PLAYER_CAP) return;
	const bit = 1 << id;
	const bots = on ? settingsState.bots | bit : settingsState.bots & ~bit;
	const humans = id === 1 && on ? 2 : settingsState.humans;
	settingsApply({ ...settingsState, humans, bots }, updateUrl);
}

function settingsSetBalls(balls, updateUrl) {
	settingsApply({ ...settingsState, balls }, updateUrl);
}

function settingsSetBallSpeed(ballSpeed, updateUrl) {
	settingsApply({ ...settingsState, ballSpeed }, updateUrl);
}

function settingsWriteUrl() {
	const url = new URL(window.location.href);
	for (let i = 0; i < SETTINGS_KEYS.length; i++) {
		const key = SETTINGS_KEYS[i];
		const param = settingsParam(key);
		const encoded = key === 'humans' && settingsState.bots & 2 ? undefined : settingsEncode(key, settingsState[key]);
		if (encoded === undefined) url.searchParams.delete(param);
		else url.searchParams.set(param, encoded);
	}
	try {
		window.history.replaceState(window.history.state, '', url.href);
		settingsUi.urlWrap.hidden = true;
	} catch (error) {
		// Some file:// browsers reject query replacement; the copyable URL still restores the settings.
		settingsUi.url.value = url.href;
		settingsUi.urlWrap.hidden = false;
	}
}

if (typeof module !== 'undefined') module.exports = {
	settingsState, settingsInit, settingsApply, settingsSetFriction, settingsSetHumans, settingsSetBot,
	settingsSetBalls, settingsSetBallSpeed, settingsRebuild, settingsNormalize,
	settingsEncode, settingsFromSearch, settingsWriteUrl, SETTINGS_KEYS, settingsDefaults
};
