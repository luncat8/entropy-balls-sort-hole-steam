// owns: bot policy, its energy rests and the bot setting smoke checks
// edit for: aim rules, rest thresholds, participant rebuild

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, stubs } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const canvas = apis['canvas.js'];
const force = apis['force.js'];
const input = apis['input.js'];
const panels = apis['forcepanel.js'];
const settings = apis['settings.js'];
const players = apis['players.js'];
const tasks = apis['tasks.js'];
const bot = apis['bot.js'];
const main = apis['main.js'];
const DT = sim.FIXED_DT;
const CAP = force.FORCE_CAPACITY;

let pass = 0;
let fail = 0;

function check(name, ok) {
	if (ok) pass++;
	else {
		fail++;
		console.log('FAIL ' + name);
	}
}

function near(a, b, tol = 1e-5) {
	return Math.abs(a - b) <= tol;
}

function step(n) {
	for (let i = 0; i < n; i++) sim.simStep(DT);
}

function warmPalette() {
	for (let p = 0; p < 8; p++) if (tasks.tasksCatHas(0, p) === 1) return p;
	return 0;
}

function place(i, x, y, vx, vy, p) {
	const b = sim.simBalls;
	b.x[i] = x;
	b.y[i] = y;
	b.vx[i] = vx;
	b.vy[i] = vy;
	b.r[i] = 12;
	b.palette[i] = p;
	b.count = i + 1;
}

// one ball, one assigned objective: the field is hand-built so aim and crossing are exact
function field(x, y, vx, vy, catName) {
	input.inputRelease();
	players.playersInit(1);
	players.playersAdd(players.PLAYER_BOT);
	input.inputRebind();
	force.forceSetCapacity(CAP);
	force.forceSetCost(force.FORCE_COST);
	force.forceInit();
	sim.simSetSpawnRate(0);
	sim.simInit();
	sim.simBalls.count = 0;
	place(0, x, y, vx, vy, warmPalette());
	sim.simFillDist();
	tasks.tasksInit();
	tasks.tasksAssign(0, 'left', catName, '>', 30, 'immediate');
	tasks.tasksAssign(1, 'left', catName, '>', 30, 'immediate');
	bot.botInit();
	stubs.win.devicePixelRatio = 1;
	stubs.els.canv.clientWidth = 1200;
	stubs.els.canv.clientHeight = 800;
	canvas.canvasResize();
	panels.forcePanelPaint();
}

field(900, 200, -200, 0, 'hot');
check('aim: the bot picks the y of the incoming ball and drives up', bot.botAim(1) === true
	&& near(bot.botState.targetY[1], 200, 30));
check('bot acts through the force api', (bot.botAct(1), force.forceState.dir[1] === -1
	&& force.forceState.held[1] === 1 && near(force.forceState.mag[1], bot.BOT_MAG)));
const startY = sim.simAperture.y;
step(60);
check('bot: the hole travels toward the ball', sim.simAperture.y < startY - 50);
check('bot: the human input layer never claims a bot slot', input.inputControls(1) === false
	&& input.inputState.keys === 0);

let crossed = -1;
for (let i = 0; i < 600 && crossed < 0; i++) {
	sim.simStep(DT);
	if (sim.simBalls.x[0] < sim.simField.wallX) crossed = i;
}
check('bot: the fed ball crosses the divider', crossed > 0 && sim.simDist.left === 1);

// the hook, not a manual call, has to drive the bot: a fresh field steps through simStep only
field(900, 200, -200, 0, 'hot');
sim.simStep(DT);
check('boot hook: simStep alone makes the bot request force', force.forceState.held[1] === 1);

field(900, 200, -200, 0, 'hot');
force.forceState.energy[1] = 10;
bot.botThink(1, 0);
bot.botAct(1);
check('rest: a low store releases and marks the rest', force.forceState.held[1] === 0
	&& bot.botState.rest[1] === 1);
force.forceState.energy[1] = 40;
bot.botAct(1);
check('rest: a partial store keeps resting', force.forceState.held[1] === 0 && bot.botState.rest[1] === 1);
force.forceState.energy[1] = 90;
bot.botAct(1);
check('rest: a recovered store resumes the same aim', bot.botState.rest[1] === 0
	&& force.forceState.held[1] === 1 && force.forceState.dir[1] === -1);

field(900, 400, -200, 0, 'hot');
sim.simAperture.y = 400;
bot.botAim(1);
bot.botAct(1);
check('aim: a ball already on the hole line costs nothing', force.forceState.held[1] === 0
	&& force.forceState.dir[1] !== -1);

field(1150, 200, 280, 0, 'hot');
check('aim: a ball that bounces back in time is waited for', bot.botAim(1) === true
	&& near(bot.botState.targetY[1], 200, 40));
field(900, 200, 200, 0, 'hot');
check('aim: a ball that cannot come back inside the horizon is no lane', bot.botAim(1) === false);

field(200, 200, 200, 0, 'hot');
check('aim: a ball already in the named chamber is not a target', bot.botAim(1) === false
	&& (bot.botAct(1), force.forceState.held[1] === 0));

field(900, 700, -200, 0, 'cold');
check('aim: a ball of another category is ignored', bot.botAim(1) === false);

field(900, 200, -200, 0, 'hot');
place(0, 300, 200, 200, 0, warmPalette());
sim.simFillDist();
tasks.tasksAssign(1, 'left', 'hot', '>', 30, 'immediate');
check('aim: a satisfied objective lets go of the hole', tasks.tasksView[1].satisfied === true
	&& bot.botAim(1) === false);

field(900, 200, -200, 0, 'hot');
tasks.tasksAttach(1); // one ball cannot pay the cheapest crossing, so the objective waits
check('aim: a waiting objective holds nothing', tasks.tasksView[1].waiting === true
	&& bot.botAim(1) === false
	&& (bot.botAct(1), force.forceState.held[1] === 0));

field(900, 200, -200, 0, 'hot');
sim.simBalls.count = 0;
sim.simFillDist();
check('aim: an empty field has nothing to feed', bot.botAim(1) === false);

players.playersInit(2);
input.inputRebind();
force.forceInit();
bot.botInit();
tasks.tasksInit();
tasks.tasksAttach(0);
tasks.tasksAttach(1);
bot.botStep(DT);
check('two humans: no slot is a bot, so nothing is requested', force.forceState.held[1] === 0
	&& force.forceState.held[1] === 0);

check('settings: bot normalizes and encodes on its own key', settings.settingsNormalize('bot', '1') === true
	&& settings.settingsNormalize('bot', '0') === false && settings.settingsEncode('bot', true) === '1'
	&& settings.settingsEncode('bot', false) === undefined);
const parsed = settings.settingsFromSearch('?bot=1&humans=1');
check('settings: the URL restores a bot opponent', parsed.bot === true && parsed.humans === 1
	&& parsed.friction === false);

settings.settingsSetHumans(1, false);
settings.settingsSetBot(true, false);
panels.forcePanelPaint();
check('settings: the bot takes the second slot and reads as a bot', players.players.count === 2
	&& players.players.type[1] === players.PLAYER_BOT && panels.forcePanels.rows.length === 2
	&& panels.forcePanels.rows[1].kind === 'Bot' && panels.forcePanels.rows[1].controlled === false);
check('settings: the remaining human keeps the pointer and the shortcuts', input.inputState.keys === 0
	&& input.inputApplyKey() === 'Space' && input.inputControls(0) === true);
check('settings: each participant keeps its own objective', tasks.tasksOn[0] === 1 && tasks.tasksOn[1] === 1);

settings.settingsSetBot(true, true);
check('settings: bot is written to the URL', stubs.win.location.search === '?bot=1');

settings.settingsSetHumans(2, false);
check('settings: two humans win the second slot over the bot', players.players.count === 2
	&& players.players.type[1] === players.PLAYER_HUMAN && settings.settingsState.bot === false
	&& stubs.els['settings-bot'].disabled === true);
settings.settingsSetBot(true, false);
check('settings: the bot cannot take a slot a human plays', players.players.type[1] === players.PLAYER_HUMAN
	&& settings.settingsState.bot === false);
settings.settingsSetHumans(1, false);
settings.settingsSetBot(false, false);
panels.forcePanelPaint();
check('settings: turning the bot off drops its slot and its objective', players.players.count === 1
	&& tasks.tasksOn[1] === 0 && panels.forcePanels.rows.length === 1);

check('wiring: the fixed-step hook runs both control channels', typeof main.mainControlStep === 'function');

console.log('bot_smoke pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
