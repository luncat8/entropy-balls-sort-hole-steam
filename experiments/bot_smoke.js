// owns: bot policy, energy rests, contested turns and bot-mask smoke checks
// edit for: aim rules, rest thresholds, contest turns, participant rebuild

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

check('settings: the bot mask normalizes and encodes on its own key', settings.settingsNormalize('bots', '3') === 3
	&& settings.settingsNormalize('bots', 'bad') === 0 && settings.settingsEncode('bots', 3) === '3'
	&& settings.settingsEncode('bots', 0) === undefined);
const parsed = settings.settingsFromSearch('?bots=3');
check('settings: the URL restores two bots and the second participant', parsed.bots === 3 && parsed.humans === 2
	&& parsed.friction === false);

settings.settingsSetHumans(1, false);
settings.settingsSetBot(1, true, false);
panels.forcePanelPaint();
check('settings: a bot checkbox joins the second slot and reads as a bot', players.players.count === 2
	&& players.players.type[1] === players.PLAYER_BOT && panels.forcePanels.rows.length === 2
	&& panels.forcePanels.rows[1].kind === 'Bot' && panels.forcePanels.rows[1].controlled === false);
check('settings: the remaining human keeps the pointer and the shortcuts', input.inputState.keys === 0
	&& input.inputApplyKey() === 'Space' && input.inputControls(0) === true);
check('settings: each participant keeps its own objective', tasks.tasksOn[0] === 1 && tasks.tasksOn[1] === 1);

settings.settingsSetBot(1, true, true);
check('settings: the second bot bit is written to the URL', stubs.win.location.search === '?bots=2');
settings.settingsSetBot(0, true, false);
panels.forcePanelPaint();
check('settings: both slots can be bots with no human channel', players.players.count === 2
	&& players.players.type[0] === players.PLAYER_BOT && players.players.type[1] === players.PLAYER_BOT
	&& input.inputControls(0) === false && input.inputControls(1) === false
	&& panels.forcePanels.rows[0].controlled === false && panels.forcePanels.rows[1].controlled === false);

settings.settingsSetHumans(2, false);
check('settings: a second human replaces only the second bot', players.players.count === 2
	&& players.players.type[0] === players.PLAYER_BOT && players.players.type[1] === players.PLAYER_HUMAN
	&& settings.settingsState.bots === 1 && input.inputControls(1) === true);
settings.settingsSetHumans(1, false);
settings.settingsSetBot(0, false, false);
panels.forcePanelPaint();
check('settings: turning the second player off drops its slot and objective', players.players.count === 1
	&& tasks.tasksOn[1] === 0 && panels.forcePanels.rows.length === 1);

field(900, 200, -200, 0, 'hot');
players.playersInit(2, 3);
input.inputRebind();
force.forceInit();
bot.botInit();
bot.botState.targetY[0] = 100;
bot.botState.targetY[1] = 700;
bot.botState.aimed.fill(1);
bot.botState.think.fill(1);
sim.simAperture.y = 400;
check('contest: opposing aims give the first turn to player 1', bot.botContest() === 0);
bot.botStep(DT);
check('contest: the yielding bot releases while the other drives', force.forceState.held[0] === 1
	&& force.forceState.held[1] === 0);
bot.botState.clock = bot.BOT_CONTEST_SEC;
bot.botStep(DT);
check('contest: the next turn belongs to player 2', force.forceState.held[0] === 0
	&& force.forceState.held[1] === 1);
bot.botState.targetY[1] = 100;
check('contest: aligned aims do not reserve a turn', bot.botContest() === -1);
bot.botState.rest[0] = 1;
bot.botState.targetY[1] = 700;
check('contest: a resting bot does not block the other', bot.botContest() === -1);

check('wiring: the fixed-step hook runs both control channels', typeof main.mainControlStep === 'function');

console.log('bot_smoke pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);
