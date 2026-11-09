// owns: responsive drawer preferences and dismissal checks
// edit for: drawer storage, defaults, Escape and backdrop behavior

const path = require('path');
const { loadGame } = require('./vmload');
const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const drawer = apis['drawer.js'];
const panel = stubs.els['settings-panel'];
const backdrop = stubs.els['drawer-backdrop'];
const media = { matches: false, addEventListener() {} };
const saved = new Map();
let pass = 0;
let fail = 0;
let focused = false;
stubs.els['drawer-toggle'].focus = () => { focused = true; };
stubs.win.matchMedia = () => media;
stubs.win.localStorage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };

function check(name, ok) {
	if (ok) pass++;
	else { fail++; console.log('FAIL ' + name); }
}

check('compact boot: closed with no backdrop', !panel.open && backdrop.hidden);
// Reinitialize against a controlled viewport and storage so restoration is independent of the VM's defaults.
drawer.drawerInit();
media.matches = true;
drawer.drawerRestore();
check('wide default: open without backdrop', panel.open && backdrop.hidden);
panel.open = false;
panel.dispatch('toggle');
check('wide choice: remembered', saved.get('entropy-drawer-wide') === '0');
drawer.drawerRestore();
check('wide restoration: closed preference wins', !panel.open);
media.matches = false;
drawer.drawerRestore();
check('compact default: independent from wide choice', !panel.open);
panel.open = true;
panel.dispatch('toggle');
check('compact open: backdrop and saved preference', !backdrop.hidden && saved.get('entropy-drawer-compact') === '1');
media.matches = true;
drawer.drawerRestore();
check('breakpoint: restores wide closed choice', !panel.open && backdrop.hidden);
media.matches = false;
drawer.drawerRestore();
check('breakpoint: restores compact open choice', panel.open && !backdrop.hidden);
backdrop.dispatch('click');
check('backdrop: closes, saves and returns focus', !panel.open && backdrop.hidden && focused
	&& saved.get('entropy-drawer-compact') === '0');
panel.open = true;
panel.dispatch('toggle');
focused = false;
let prevented = false;
for (const fn of stubs.listeners.keydown) fn({ key: 'Escape', preventDefault() { prevented = true; } });
check('Escape: closes and returns focus', !panel.open && backdrop.hidden && focused && prevented);
saved.set('entropy-drawer-compact', 'invalid');
drawer.drawerRestore();
check('invalid compact preference: closed default', !panel.open);
media.matches = true;
saved.set('entropy-drawer-wide', 'invalid');
drawer.drawerRestore();
check('invalid wide preference: open default', panel.open);
stubs.win.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
media.matches = false;
drawer.drawerRestore();
check('blocked storage: responsive default still works', !panel.open);
panel.open = true;
panel.dispatch('toggle');
check('blocked storage: drawer still opens', panel.open && !backdrop.hidden);
drawer.drawerClose();
check('blocked storage: dismissal still works', !panel.open && backdrop.hidden);
console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
