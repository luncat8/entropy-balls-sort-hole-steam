// owns: responsive settings disclosure, dismissal and saved layout preferences
// edit for: drawer breakpoint, default visibility and local preference storage

const DRAWER_WIDE_QUERY = '(min-width: 1400px) and (min-height: 650px)';
const drawerUi = { panel: null, backdrop: null, toggle: null, media: null, open: false };

function drawerStorageKey() {
	return drawerUi.media.matches ? 'entropy-drawer-wide' : 'entropy-drawer-compact';
}

function drawerInit() {
	drawerUi.panel = $('settings-panel');
	drawerUi.backdrop = $('drawer-backdrop');
	drawerUi.toggle = $('drawer-toggle');
	drawerUi.media = window.matchMedia(DRAWER_WIDE_QUERY);
	drawerRestore();
	drawerUi.panel.addEventListener('toggle', drawerToggled);
	drawerUi.backdrop.addEventListener('click', drawerClose);
	drawerUi.media.addEventListener('change', drawerRestore);
	window.addEventListener('keydown', drawerKeyDown);
}

function drawerRestore() {
	let saved = null;
	try { saved = window.localStorage.getItem(drawerStorageKey()); } catch (error) {}
	const open = saved === '1' || (saved !== '0' && drawerUi.media.matches);
	drawerUi.open = open;
	drawerUi.panel.open = open;
	drawerSyncBackdrop();
}

function drawerSyncBackdrop() {
	drawerUi.backdrop.hidden = !drawerUi.open || drawerUi.media.matches;
}

function drawerToggled() {
	if (drawerUi.open === drawerUi.panel.open) return;
	drawerUi.open = drawerUi.panel.open;
	drawerSyncBackdrop();
	try { window.localStorage.setItem(drawerStorageKey(), drawerUi.open ? '1' : '0'); } catch (error) {}
}

function drawerClose() {
	drawerUi.panel.open = false;
	drawerToggled();
	drawerUi.toggle.focus({ preventScroll: true });
}

function drawerKeyDown(e) {
	if (e.key !== 'Escape' || !drawerUi.panel.open) return;
	e.preventDefault();
	drawerClose();
}

if (typeof module !== 'undefined') module.exports = { drawerInit, drawerRestore, drawerClose };
