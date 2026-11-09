// owns: setting defaults, URL persistence and the settings controls
// edit for: settings keys, URL keys, settings bindings

// Every key is one table entry, so one path reads, encodes and clamps all of them.
const SETTINGS_KEYS = ['friction', 'humans', 'bots', 'balls', 'ballSpeed', 'holeSize', 'holeSpeed', 'energyCost', 'energyStore'];
const settingsDefaults = {
	friction: false, humans: 1, bots: 0, balls: 24, ballSpeed: 175,
	holeSize: APERTURE_SIZE, holeSpeed: APERTURE_SPEED, energyCost: FORCE_COST, energyStore: FORCE_CAPACITY
};
const settingsState = {
	friction: false, humans: 1, bots: 0, balls: 24, ballSpeed: 175,
	holeSize: APERTURE_SIZE, holeSpeed: APERTURE_SPEED, energyCost: FORCE_COST, energyStore: FORCE_CAPACITY
};
const settingsUi = {
	friction: null, humans: null, balls: null, ballSpeed: null,
	holeSize: null, holeSpeed: null, energyCost: null, energyStore: null,
	ballsValue: null, ballSpeedValue: null, holeSizeValue: null, holeSpeedValue: null,
	energyCostValue: null, energyStoreValue: null, urlWrap: null, url: null
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
		case 'holeSize': {
			const value = settingsNumber(raw, APERTURE_SIZE_MIN, APERTURE_SIZE_MAX, 1);
			return value === undefined ? settingsDefaults.holeSize : value;
		}
		case 'holeSpeed': {
			const value = settingsNumber(raw, APERTURE_SPEED_MIN, APERTURE_SPEED_MAX, 10);
			return value === undefined ? settingsDefaults.holeSpeed : value;
		}
		case 'energyCost': {
			const value = settingsNumber(raw, 5, 80, 1);
			return value === undefined ? settingsDefaults.energyCost : value;
		}
		case 'energyStore': {
			const value = settingsNumber(raw, 25, 300, 5);
			return value === undefined ? settingsDefaults.energyStore : value;
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
		case 'holeSize': return value === settingsDefaults.holeSize ? undefined : String(value);
		case 'holeSpeed': return value === settingsDefaults.holeSpeed ? undefined : String(value);
		case 'energyCost': return value === settingsDefaults.energyCost ? undefined : String(value);
		case 'energyStore': return value === settingsDefaults.energyStore ? undefined : String(value);
	}
	return undefined;
}

const SETTINGS_PARAM = { ballSpeed: 'speed', holeSize: 'hole', holeSpeed: 'holeSpeed', energyCost: 'cost', energyStore: 'store' };

function settingsParam(key) {
	return SETTINGS_PARAM[key] || key;
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
	settingsUi.friction = $('settings-friction');
	settingsUi.humans = $('settings-humans');
	settingsUi.balls = $('settings-balls');
	settingsUi.ballSpeed = $('settings-ball-speed');
	settingsUi.ballsValue = $('settings-balls-value');
	settingsUi.ballSpeedValue = $('settings-ball-speed-value');
	settingsUi.holeSize = $('settings-hole-size');
	settingsUi.holeSpeed = $('settings-hole-speed');
	settingsUi.energyCost = $('settings-energy-cost');
	settingsUi.energyStore = $('settings-energy-store');
	settingsUi.holeSizeValue = $('settings-hole-size-value');
	settingsUi.holeSpeedValue = $('settings-hole-speed-value');
	settingsUi.energyCostValue = $('settings-energy-cost-value');
	settingsUi.energyStoreValue = $('settings-energy-store-value');
	settingsUi.urlWrap = $('settings-url-wrap');
	settingsUi.url = $('settings-url');
	settingsUi.friction.addEventListener('change', settingsFrictionChanged);
	settingsUi.humans.addEventListener('change', settingsHumansChanged);
	settingsUi.balls.addEventListener('input', settingsBallsChanged);
	settingsUi.ballSpeed.addEventListener('input', settingsBallSpeedChanged);
	settingsUi.holeSize.addEventListener('input', settingsHoleSizeChanged);
	settingsUi.holeSpeed.addEventListener('input', settingsHoleSpeedChanged);
	settingsUi.energyCost.addEventListener('input', settingsEnergyCostChanged);
	settingsUi.energyStore.addEventListener('input', settingsEnergyStoreChanged);
	const url = settingsFromSearch(window.location.search);
	settingsApply(url, false);
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

function settingsHoleSizeChanged() {
	settingsSetHoleSize(Number(settingsUi.holeSize.value), true);
}

function settingsHoleSpeedChanged() {
	settingsSetHoleSpeed(Number(settingsUi.holeSpeed.value), true);
}

function settingsEnergyCostChanged() {
	settingsSetEnergyCost(Number(settingsUi.energyCost.value), true);
}

function settingsEnergyStoreChanged() {
	settingsSetEnergyStore(Number(settingsUi.energyStore.value), true);
}

function settingsSync() {
	settingsUi.friction.checked = settingsState.friction;
	settingsUi.humans.checked = settingsState.humans === 2;
	settingsUi.balls.value = String(settingsState.balls);
	settingsUi.ballSpeed.value = String(settingsState.ballSpeed);
	settingsUi.ballsValue.textContent = String(settingsState.balls);
	settingsUi.ballSpeedValue.textContent = settingsState.ballSpeed + ' px/s';
	settingsUi.holeSize.value = String(settingsState.holeSize);
	settingsUi.holeSpeed.value = String(settingsState.holeSpeed);
	settingsUi.energyCost.value = String(settingsState.energyCost);
	settingsUi.energyStore.value = String(settingsState.energyStore);
	settingsUi.holeSizeValue.textContent = settingsState.holeSize + ' px';
	settingsUi.holeSpeedValue.textContent = settingsState.holeSpeed + ' px/s';
	settingsUi.energyCostValue.textContent = settingsState.energyCost + '/s';
	settingsUi.energyStoreValue.textContent = String(settingsState.energyStore);
}

function settingsApply(values, updateUrl) {
	const bots = settingsNormalize('bots', values.bots);
	const humans = values.humans === 2 || bots & 2 ? 2 : 1;
	const mask = bots & (humans === 2 ? 3 : 1);
	const balls = settingsNormalize('balls', values.balls);
	const speed = settingsNormalize('ballSpeed', values.ballSpeed);
	const holeSize = settingsNormalize('holeSize', values.holeSize);
	const holeSpeed = settingsNormalize('holeSpeed', values.holeSpeed);
	const energyCost = settingsNormalize('energyCost', values.energyCost);
	const energyStore = settingsNormalize('energyStore', values.energyStore);
	const rebuild = humans !== settingsState.humans || mask !== settingsState.bots;
	settingsState.friction = !!values.friction;
	settingsState.humans = humans;
	settingsState.bots = mask;
	settingsState.balls = balls;
	settingsState.ballSpeed = speed;
	settingsState.holeSize = holeSize;
	settingsState.holeSpeed = holeSpeed;
	settingsState.energyCost = energyCost;
	settingsState.energyStore = energyStore;
	settingsSync();
	simSetFriction(settingsState.friction);
	simSetBallSpeed(settingsState.ballSpeed);
	simSetApertureSize(settingsState.holeSize);
	simSetApertureSpeed(settingsState.holeSpeed);
	forceSetCost(settingsState.energyCost);
	forceSetCapacity(settingsState.energyStore);
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

function settingsSetHoleSize(holeSize, updateUrl) {
	settingsApply({ ...settingsState, holeSize }, updateUrl);
}

function settingsSetHoleSpeed(holeSpeed, updateUrl) {
	settingsApply({ ...settingsState, holeSpeed }, updateUrl);
}

function settingsSetEnergyCost(energyCost, updateUrl) {
	settingsApply({ ...settingsState, energyCost }, updateUrl);
}

function settingsSetEnergyStore(energyStore, updateUrl) {
	settingsApply({ ...settingsState, energyStore }, updateUrl);
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
	settingsSetBalls, settingsSetBallSpeed, settingsSetHoleSize, settingsSetHoleSpeed,
	settingsSetEnergyCost, settingsSetEnergyStore, settingsRebuild, settingsNormalize,
	settingsEncode, settingsFromSearch, settingsWriteUrl, SETTINGS_KEYS, settingsDefaults
};
