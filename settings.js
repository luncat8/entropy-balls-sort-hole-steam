// owns: setting defaults, URL persistence and the settings controls
// edit for: settings keys, URL keys, settings bindings

// Every key is one table entry, so one path reads, encodes and clamps all of them. Sizes and speeds
// are shares of the field scale in thousandths, so the screen size never changes what the settings mean.
const SETTINGS_KEYS = ['friction', 'humans', 'bots', 'balls', 'ballSpeed', 'ballSize', 'ballVaried', 'collisions',
	'holeSize', 'holeSpeed', 'energyCost', 'energyStore', 'generation'];
const settingsDefaults = {
	friction: false, humans: 1, bots: 0, balls: 24, ballSpeed: BALL_SPEED_DEFAULT, ballSize: BALL_SIZE_DEFAULT,
	ballVaried: true, collisions: true,
	holeSize: APERTURE_SIZE, holeSpeed: APERTURE_SPEED, energyCost: FORCE_COST, energyStore: FORCE_CAPACITY, generation: 100
};
const settingsState = {
	friction: false, humans: 1, bots: 0, balls: 24, ballSpeed: BALL_SPEED_DEFAULT, ballSize: BALL_SIZE_DEFAULT,
	ballVaried: true, collisions: true,
	holeSize: APERTURE_SIZE, holeSpeed: APERTURE_SPEED, energyCost: FORCE_COST, energyStore: FORCE_CAPACITY, generation: 100
};
const settingsUi = {
	friction: null, humans: null, balls: null, ballSpeed: null, ballSize: null, ballVaried: null, collisions: null,
	holeSize: null, holeSpeed: null, energyCost: null, energyStore: null,
	ballsValue: null, ballSpeedValue: null, ballSizeValue: null, holeSizeValue: null, holeSpeedValue: null,
	energyCostValue: null, energyStoreValue: null, generation: null, generationValue: null, urlWrap: null, url: null
};

function settingsNumber(raw, min, max, step) {
	const value = Number(raw);
	if (raw === '' || !Number.isFinite(value)) return undefined;
	return Math.max(min, Math.min(max, Math.round(value / step) * step));
}

// one decimal is the resolution a player can act on, and a whole share never prints a trailing zero
function settingsPercent(share) {
	const text = (share / 10).toFixed(1);
	return text.endsWith('.0') ? text.slice(0, -2) : text;
}

function settingsNormalize(key, raw) {
	switch (key) {
		case 'friction':
		case 'ballVaried':
		case 'collisions': return raw === true || raw === '1' || raw === 'true';
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
		case 'ballSize': {
			const value = settingsNumber(raw, BALL_SIZE_MIN, BALL_SIZE_MAX, 1);
			return value === undefined ? settingsDefaults.ballSize : value;
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
		case 'generation': {
			const value = settingsNumber(raw, 0, 300, 5);
			return value === undefined ? settingsDefaults.generation : value;
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
		case 'collisions': return value ? undefined : '0';
		case 'humans': return value === 2 ? '2' : undefined;
		case 'bots': return value ? String(value) : undefined;
		case 'balls': return value === settingsDefaults.balls ? undefined : String(value);
		case 'ballSpeed': return value === settingsDefaults.ballSpeed ? undefined : String(value);
		case 'ballSize': return value === settingsDefaults.ballSize ? undefined : String(value);
		case 'ballVaried': return value ? undefined : '0';
		case 'holeSize': return value === settingsDefaults.holeSize ? undefined : String(value);
		case 'holeSpeed': return value === settingsDefaults.holeSpeed ? undefined : String(value);
		case 'energyCost': return value === settingsDefaults.energyCost ? undefined : String(value);
		case 'energyStore': return value === settingsDefaults.energyStore ? undefined : String(value);
		case 'generation': return value === settingsDefaults.generation ? undefined : String(value);
	}
	return undefined;
}

const SETTINGS_PARAM = {
	ballSpeed: 'speed', ballSize: 'size', holeSize: 'hole', holeSpeed: 'holeSpeed',
	energyCost: 'cost', energyStore: 'store'
};

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
	settingsUi.ballSize = $('settings-ball-size');
	settingsUi.ballVaried = $('settings-ball-varied');
	settingsUi.collisions = $('settings-collisions');
	settingsUi.ballsValue = $('settings-balls-value');
	settingsUi.ballSpeedValue = $('settings-ball-speed-value');
	settingsUi.ballSizeValue = $('settings-ball-size-value');
	settingsUi.holeSize = $('settings-hole-size');
	settingsUi.holeSpeed = $('settings-hole-speed');
	settingsUi.energyCost = $('settings-energy-cost');
	settingsUi.energyStore = $('settings-energy-store');
	settingsUi.holeSizeValue = $('settings-hole-size-value');
	settingsUi.holeSpeedValue = $('settings-hole-speed-value');
	settingsUi.energyCostValue = $('settings-energy-cost-value');
	settingsUi.energyStoreValue = $('settings-energy-store-value');
	settingsUi.generation = $('settings-generation');
	settingsUi.generationValue = $('settings-generation-value');
	settingsUi.generation.addEventListener('input', () => settingsSetGeneration(Number(settingsUi.generation.value), true));
	$('settings-copy-link').addEventListener('click', settingsCopyLink);
	settingsUi.urlWrap = $('settings-url-wrap');
	settingsUi.url = $('settings-url');
	settingsUi.friction.addEventListener('change', settingsFrictionChanged);
	settingsUi.humans.addEventListener('change', settingsHumansChanged);
	settingsUi.balls.addEventListener('input', settingsBallsChanged);
	settingsUi.ballSpeed.addEventListener('input', settingsBallSpeedChanged);
	settingsUi.ballSize.addEventListener('input', settingsBallSizeChanged);
	settingsUi.ballVaried.addEventListener('change', settingsBallVariedChanged);
	settingsUi.collisions.addEventListener('change', settingsCollisionsChanged);
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

function settingsBallSizeChanged() {
	settingsSetBallSize(Number(settingsUi.ballSize.value), true);
}

function settingsBallVariedChanged() {
	settingsSetBallVaried(settingsUi.ballVaried.checked, true);
}

function settingsCollisionsChanged() {
	settingsSetCollisions(settingsUi.collisions.checked, true);
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
	settingsUi.ballSize.value = String(settingsState.ballSize);
	settingsUi.ballVaried.checked = settingsState.ballVaried;
	settingsUi.collisions.checked = settingsState.collisions;
	settingsUi.ballsValue.textContent = String(settingsState.balls);
	settingsUi.ballSpeedValue.textContent = settingsPercent(settingsState.ballSpeed) + ' %/s';
	settingsUi.ballSizeValue.textContent = settingsPercent(settingsState.ballSize) + ' %';
	settingsUi.holeSize.value = String(settingsState.holeSize);
	settingsUi.holeSpeed.value = String(settingsState.holeSpeed);
	settingsUi.energyCost.value = String(settingsState.energyCost);
	settingsUi.energyStore.value = String(settingsState.energyStore);
	settingsUi.holeSizeValue.textContent = settingsPercent(settingsState.holeSize) + ' %';
	settingsUi.holeSpeedValue.textContent = settingsPercent(settingsState.holeSpeed) + ' %/s';
	settingsUi.energyCostValue.textContent = settingsState.energyCost + '/s';
	settingsUi.energyStoreValue.textContent = String(settingsState.energyStore);
	settingsUi.generation.value = String(settingsState.generation);
	settingsUi.generationValue.textContent = settingsState.generation + '/min';
}

function settingsApply(values, updateUrl) {
	const bots = settingsNormalize('bots', values.bots);
	const humans = values.humans === 2 || bots & 2 ? 2 : 1;
	const mask = bots & (humans === 2 ? 3 : 1);
	const balls = settingsNormalize('balls', values.balls);
	const speed = settingsNormalize('ballSpeed', values.ballSpeed);
	const ballSize = settingsNormalize('ballSize', values.ballSize);
	const holeSize = settingsNormalize('holeSize', values.holeSize);
	const holeSpeed = settingsNormalize('holeSpeed', values.holeSpeed);
	const energyCost = settingsNormalize('energyCost', values.energyCost);
	const energyStore = settingsNormalize('energyStore', values.energyStore);
	const rebuild = humans !== settingsState.humans || mask !== settingsState.bots;
	settingsState.friction = !!values.friction;
	settingsState.ballVaried = values.ballVaried === undefined
		? settingsDefaults.ballVaried : settingsNormalize('ballVaried', values.ballVaried);
	settingsState.collisions = values.collisions === undefined
		? settingsDefaults.collisions : settingsNormalize('collisions', values.collisions);
	settingsState.humans = humans;
	settingsState.bots = mask;
	settingsState.balls = balls;
	settingsState.ballSpeed = speed;
	settingsState.ballSize = ballSize;
	settingsState.holeSize = holeSize;
	settingsState.holeSpeed = holeSpeed;
	settingsState.energyCost = energyCost;
	settingsState.energyStore = energyStore;
	settingsState.generation = settingsNormalize('generation', values.generation);
	settingsSync();
	simSetFriction(settingsState.friction);
	simSetBallSpeed(settingsState.ballSpeed);
	simSetBallSize(settingsState.ballSize, settingsState.ballVaried);
	simSetBallCollisions(settingsState.collisions);
	simSetApertureSize(settingsState.holeSize);
	simSetApertureSpeed(settingsState.holeSpeed);
	forceSetCost(settingsState.energyCost);
	forceSetCapacity(settingsState.energyStore);
	simSetSpawnRate(settingsState.generation / 60);
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

function settingsSetBallSize(ballSize, updateUrl) {
	settingsApply({ ...settingsState, ballSize }, updateUrl);
}

function settingsSetBallVaried(ballVaried, updateUrl) {
	settingsApply({ ...settingsState, ballVaried }, updateUrl);
}

function settingsSetCollisions(collisions, updateUrl) {
	settingsApply({ ...settingsState, collisions }, updateUrl);
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

function settingsSetGeneration(generation, updateUrl) {
	settingsApply({ ...settingsState, generation }, updateUrl);
}

function settingsUrl() {
	const url = new URL(window.location.href);
	for (let i = 0; i < SETTINGS_KEYS.length; i++) {
		const key = SETTINGS_KEYS[i];
		const param = settingsParam(key);
		const encoded = key === 'humans' && settingsState.bots & 2 ? undefined : settingsEncode(key, settingsState[key]);
		if (encoded === undefined) url.searchParams.delete(param);
		else url.searchParams.set(param, encoded);
	}
	return url.href;
}

function settingsCopyLink() {
	const href = settingsUrl();
	if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
		navigator.clipboard.writeText(href).catch(() => settingsShowUrl(href));
	} else settingsShowUrl(href);
}

function settingsShowUrl(href) {
	settingsUi.url.value = href;
	settingsUi.urlWrap.hidden = false;
	settingsUi.url.focus();
	settingsUi.url.select();
}

function settingsWriteUrl() {
	const href = settingsUrl();
	try {
		window.history.replaceState(window.history.state, '', href);
		settingsUi.urlWrap.hidden = true;
	} catch (error) {
		// Some file:// browsers reject query replacement; the copyable URL still restores the settings.
		settingsUi.url.value = href;
		settingsUi.urlWrap.hidden = false;
	}
}

if (typeof module !== 'undefined') module.exports = {
	settingsState, settingsInit, settingsApply, settingsSetFriction, settingsSetHumans, settingsSetBot,
	settingsSetBalls, settingsSetBallSpeed, settingsSetBallSize, settingsSetBallVaried,
	settingsSetCollisions, settingsSetHoleSize, settingsSetHoleSpeed,
	settingsSetEnergyCost, settingsSetEnergyStore, settingsRebuild, settingsNormalize,
	settingsEncode, settingsFromSearch, settingsWriteUrl, SETTINGS_KEYS, settingsDefaults
};
