// owns: setting defaults, URL persistence and the settings controls
// edit for: settings keys, URL keys, settings bindings

// Every key is one table entry, so one path reads, encodes and clamps all of them.
const SETTINGS_KEYS = ['friction', 'humans'];
const settingsDefaults = { friction: false, humans: 1 };
const settingsState = { friction: false, humans: 1 };
const settingsUi = { panel: null, friction: null, humans: null, urlWrap: null, url: null };

function settingsNormalize(key, raw) {
	switch (key) {
		case 'friction': return raw === true || raw === '1' || raw === 'true';
		case 'humans': return raw === 2 || raw === '2' || raw === 'two' ? 2 : 1;
	}
	return undefined;
}

function settingsEncode(key, value) {
	switch (key) {
		case 'friction': return value ? '1' : undefined;
		case 'humans': return value === 2 ? '2' : undefined;
	}
	return undefined;
}

function settingsFromSearch(search) {
	const params = new URLSearchParams(search);
	const out = {};
	for (let i = 0; i < SETTINGS_KEYS.length; i++) {
		const key = SETTINGS_KEYS[i];
		const raw = params.get(key);
		out[key] = raw === null ? settingsDefaults[key] : settingsNormalize(key, raw);
	}
	return out;
}

function settingsInit() {
	settingsUi.panel = $('settings-panel');
	settingsUi.friction = $('settings-friction');
	settingsUi.humans = $('settings-humans');
	settingsUi.urlWrap = $('settings-url-wrap');
	settingsUi.url = $('settings-url');
	settingsUi.friction.addEventListener('change', settingsFrictionChanged);
	settingsUi.humans.addEventListener('change', settingsHumansChanged);
	const url = settingsFromSearch(window.location.search);
	settingsApply(url.friction, url.humans, false);
	settingsUi.panel.open = settingsState.humans === 2 || !window.matchMedia('(max-width: 700px)').matches;
}

function settingsFrictionChanged() {
	settingsSetFriction(settingsUi.friction.checked, true);
}

function settingsHumansChanged() {
	settingsSetHumans(settingsUi.humans.checked ? 2 : 1, true);
}

function settingsSync() {
	settingsUi.friction.checked = settingsState.friction;
	settingsUi.humans.checked = settingsState.humans === 2;
	// two humans is a mode the player has to be able to switch back off, so it holds the panel open
	if (settingsState.humans === 2) settingsUi.panel.open = true;
}

function settingsApply(friction, humans, updateUrl) {
	const humansOn = humans === 2 ? 2 : 1;
	const rebuild = humansOn !== settingsState.humans;
	settingsState.friction = !!friction;
	settingsState.humans = humansOn;
	settingsSync();
	simSetFriction(settingsState.friction);
	if (rebuild) {
		playersInit(humansOn);
		tasksRestart();
	}
	if (updateUrl) settingsWriteUrl();
}

function settingsSetFriction(on, updateUrl) {
	settingsApply(on, settingsState.humans, updateUrl);
}

function settingsSetHumans(humans, updateUrl) {
	settingsApply(settingsState.friction, humans, updateUrl);
}

function settingsWriteUrl() {
	const url = new URL(window.location.href);
	for (let i = 0; i < SETTINGS_KEYS.length; i++) {
		const key = SETTINGS_KEYS[i];
		const encoded = settingsEncode(key, settingsState[key]);
		if (encoded === undefined) url.searchParams.delete(key);
		else url.searchParams.set(key, encoded);
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
	settingsState, settingsInit, settingsApply, settingsSetFriction, settingsSetHumans, settingsNormalize,
	settingsEncode, settingsFromSearch, settingsWriteUrl, SETTINGS_KEYS, settingsDefaults
};
