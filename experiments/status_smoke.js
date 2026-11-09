// owns: status strip boot, controller changes and preview lifecycle checks
// edit for: status copy contracts, channel help, repaint caching

const path = require('path');
const { loadGame } = require('./vmload');
const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const settings = apis['settings.js'];
const main = apis['main.js'];
const goal = apis['goalview.js'];
const els = stubs.els;
let pass = 0;
let fail = 0;

function check(name, ok) {
	if (ok) pass++;
	else { fail++; console.log('FAIL ' + name); }
}

function tick() {
	main.mainFrame(0);
}

function help(id) {
	return els['game-status-control-' + id].textContent;
}

check('boot: live state', els['game-status-state'].textContent.startsWith('Live field'));
check('boot: solo help includes pointer, wheel and Space', help(0).includes('Wheel')
	&& help(0).includes('Hold the field') && help(0).includes('Space'));
check('boot: unused slot hidden', els['game-status-player-1'].hidden);
settings.settingsSetHumans(2, false);
tick();
check('two humans: pointer help drops solo shortcut', !help(0).includes('Space') && help(0).includes('slider'));
check('two humans: keyboard help uses Right', !els['game-status-player-1'].hidden
	&& help(1).includes('↑↓') && help(1).includes('→') && !help(1).includes('Wheel'));
settings.settingsSetBot(0, true, false);
tick();
check('mixed: player 1 bot help', help(0).startsWith('Bot controls'));
check('mixed: lone human in slot 2 gets both channels', help(1).includes('Wheel') && help(1).includes('Space'));
settings.settingsSetBot(1, true, false);
tick();
check('spectating: both slots show bot guidance', help(0).startsWith('Bot controls') && help(1).startsWith('Bot controls'));
goal.goalOpen(0);
tick();
check('preview: paused state and release guidance', els['game-status-state'].textContent.includes('field paused')
	&& els['game-status-state'].textContent.includes('Release'));
goal.goalClose();
tick();
check('preview close: live state restored', els['game-status-state'].textContent.startsWith('Live field'));
goal.goalOpen(0);
main.mainRestartRound();
tick();
check('restart: exits preview', els['game-status-state'].textContent.startsWith('Live field'));
settings.settingsApply(settings.settingsDefaults, false);
tick();
check('return to solo: stale player 2 help removed', els['game-status-player-1'].hidden && help(1) === '');
let writes = 0;
for (const id of ['game-status-state', 'game-status-control-0', 'game-status-control-1']) {
	const el = els[id];
	let value = el.textContent;
	Object.defineProperty(el, 'textContent', {
		get() { return value; },
		set(next) { value = next; writes++; }
	});
}
tick();
tick();
check('unchanged frame: no text writes', writes === 0);
console.log('pass=' + pass + ' fail=' + fail);
process.exitCode = fail ? 1 : 0;
