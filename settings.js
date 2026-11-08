// owns: setting defaults, URL persistence and the settings controls
// edit for: settings keys, URL keys, settings bindings

// Every key is one table entry, so one path reads, encodes and clamps all of them.
const SETTINGS_KEYS = ['friction', 'humans', 'bot'];
const settingsDefaults = { friction: false, humans: 1, bot: false };
const settingsState = { friction: false, humans: 1, bot: false };
const settingsUi = { panel: null, friction: null, humans: null, bot: null, urlWrap: null, url: null };

function settingsNormalize(key, raw) {
	switch (key) {
		case 'friction': return raw === true || raw === '1' || raw === 'true';
		case 'humans': return raw === 2 || raw === '2' || raw === 'two' ? 2 : 1;
		case 'bot': return raw === true || raw === '1' || raw === 'true';
	}
	return undefined;
}

function settingsEncode(key, value) {
	switch (key) {
		case 'friction': return value ? '1' : undefined;
		case 'humans': return value === 2 ? '2' : undefined;
		case 'bot': return value ? '1' : undefined;
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
	settingsUi.bot = $('settings-bot');
	settingsUi.urlWrap = $('settings-url-wrap');
	settingsUi.url = $('settings-url');
	settingsUi.friction.addEventListener('change', settingsFrictionChanged);
	settingsUi.humans.addEventListener('change', settingsHumansChanged);
	settingsUi.bot.addEventListener('change', settingsBotChanged);
	const url = settingsFromSearch(window.location.search);
	settingsApply(url.friction, url.humans, url.bot, false);
	settingsUi.panel.open = settingsState.humans === 2 || settingsState.bot || !window.matchMedia('(max-width: 700px)').matches;
}

function settingsFrictionChanged() {
	settingsSetFriction(settingsUi.friction.checked, true);
}

function settingsHumansChanged() {
	settingsSetHumans(settingsUi.humans.checked ? 2 : 1, true);
}

function settingsBotChanged() {
	settingsSetBot(settingsUi.bot.checked, true);
}

function settingsSync() {
	settingsUi.friction.checked = settingsState.friction;
	settingsUi.humans.checked = settingsState.humans === 2;
	settingsUi.bot.checked = settingsState.bot;
	// two humans already fill both slots, so the bot only ever takes the second one from a single player
	settingsUi.bot.disabled = settingsState.humans === 2;
	// two humans is a mode the player has to be able to switch back off, so it holds the panel open
	if (settingsState.humans === 2) settingsUi.panel.open = true;
}

function settingsApply(friction, humans, bot, updateUrl) {
	const humansOn = humans === 2 ? 2 : 1;
	const botOn = !!bot && humansOn === 1;
	const rebuild = humansOn !== settingsState.humans || botOn !== settingsState.bot;
	settingsState.friction = !!friction;
	settingsState.humans = humansOn;
	settingsState.bot = botOn;
	settingsSync();
	simSetFriction(settingsState.friction);
	if (rebuild) settingsRebuild();
	if (updateUrl) settingsWriteUrl();
}

// participants first, then everything that reads the slot list: the bot needs a slot before it steps
function settingsRebuild() {
	playersInit(settingsState.humans);
	if (settingsState.bot) playersAdd(PLAYER_BOT);
	inputRebind();
	botInit();
	tasksRestart();
}

function settingsSetFriction(on, updateUrl) {
	settingsApply(on, settingsState.humans, settingsState.bot, updateUrl);
}

function settingsSetHumans(humans, updateUrl) {
	settingsApply(settingsState.friction, humans, settingsState.bot, updateUrl);
}

function settingsSetBot(bot, updateUrl) {
	settingsApply(settingsState.friction, settingsState.humans, bot, updateUrl);
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
	settingsState, settingsInit, settingsApply, settingsSetFriction, settingsSetHumans, settingsSetBot,
	settingsRebuild, settingsNormalize,
	settingsEncode, settingsFromSearch, settingsWriteUrl, SETTINGS_KEYS, settingsDefaults
};
