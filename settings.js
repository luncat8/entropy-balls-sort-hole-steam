// owns: the hole-friction setting, its control and URL persistence
// edit for: setting defaults, URL keys and settings bindings

const settingsState = { friction: false };
const settingsUi = { friction: null, urlWrap: null, url: null };

function settingsFrictionFromSearch(search) {
	return new URLSearchParams(search).get('friction') === '1';
}

function settingsInit() {
	if (window.matchMedia('(max-width: 700px)').matches) $('settings-panel').open = false;
	settingsUi.friction = $('settings-friction');
	settingsUi.urlWrap = $('settings-url-wrap');
	settingsUi.url = $('settings-url');
	settingsUi.friction.addEventListener('change', settingsFrictionChanged);
	settingsSetFriction(settingsFrictionFromSearch(window.location.search), false);
}

function settingsFrictionChanged() {
	settingsSetFriction(settingsUi.friction.checked, true);
}

function settingsSetFriction(on, updateUrl) {
	settingsState.friction = !!on;
	settingsUi.friction.checked = settingsState.friction;
	simSetFriction(settingsState.friction);
	if (updateUrl) settingsWriteUrl();
}

function settingsWriteUrl() {
	const url = new URL(window.location.href);
	if (settingsState.friction) url.searchParams.set('friction', '1');
	else url.searchParams.delete('friction');
	try {
		window.history.replaceState(window.history.state, '', url.href);
		settingsUi.urlWrap.hidden = true;
	} catch (error) {
		// Some file:// browsers reject query replacement; the copyable URL still restores the setting.
		settingsUi.url.value = url.href;
		settingsUi.urlWrap.hidden = false;
	}
}

if (typeof module !== 'undefined') module.exports = {
	settingsState, settingsInit, settingsSetFriction, settingsFrictionFromSearch, settingsWriteUrl
};
