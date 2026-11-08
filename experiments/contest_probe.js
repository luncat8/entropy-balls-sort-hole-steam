// owns: hole-contest ledger for two bots — who wants the hole, who owns it, how often they oppose
// edit for: seed, run length, reported counters

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const roster = apis['players.js'];
const force = apis['force.js'];
const tasks = apis['tasks.js'];
const bot = apis['bot.js'];

let x = Number(process.argv[2] || 3);
ctx.Math.random = () => {
	x = (x * 1664525 + 1013904223) >>> 0;
	return x / 4294967296;
};

const SECONDS = Number(process.argv[3] || 60);
const DT = sim.FIXED_DT;

sim.simSetSpawnRate(1.6666666666666667);
sim.simInit();
force.forceSetCapacity(force.FORCE_CAPACITY);
force.forceSetCost(force.FORCE_COST);
roster.playersInit(2, 3);
force.forceInit();
bot.botInit();
tasks.tasksInit();
tasks.tasksSetRand(ctx.Math.random);
tasks.tasksAttach(0);
tasks.tasksAttach(1);

let travel = 0;
let lastApy = sim.simAperture.y;
let bothWant = 0;
let opposed = 0;
let sameDir = 0;
let oneWants = 0;
let none = 0;
let owned = 0;
let released = 0;
let reversals = 0;
let lastVy = 0;
let claims = 0;
let releases = 0;
let turns = 0;
let lastOwner = -1;
for (let i = 0; i < SECONDS / DT; i++) {
	sim.simStep(DT);
	travel += Math.abs(sim.simAperture.y - lastApy);
	lastApy = sim.simAperture.y;
	const w0 = bot.botWantsHole(0);
	const w1 = bot.botWantsHole(1);
	if (w0 && w1) {
		bothWant++;
		if (w0 === -w1) opposed++;
		else sameDir++;
	} else if (w0 || w1) oneWants++;
	else none++;
	if (sim.simAperture.velocity > 0 !== lastVy > 0) {
		if (lastVy !== 0) reversals++;
		lastVy = sim.simAperture.velocity;
	}
	if (bot.botState.owner >= 0) owned++;
	else released++;
	const now = bot.botState.owner;
	if (now === lastOwner) continue;
	if (lastOwner < 0) claims++;
	else if (now < 0) releases++;
	else turns++;
	lastOwner = now;
}
console.log('bothWant=' + bothWant + ' opposed=' + opposed + ' sameDir=' + sameDir
	+ ' oneWants=' + oneWants + ' none=' + none);
console.log('owned=' + owned + ' released=' + released);
console.log('reversals=' + reversals + ' per_min=' + (reversals / (SECONDS / 60)).toFixed(1)
	+ ' travel_px_per_min=' + (travel / (SECONDS / 60)).toFixed(0));
console.log('claims=' + claims + ' releases=' + releases + ' owner_to_owner=' + turns);
console.log('rest=' + bot.botState.rest[0] + ',' + bot.botState.rest[1]
	+ ' aimed=' + bot.botState.aimed[0] + ',' + bot.botState.aimed[1]
	+ ' energy=' + force.forceState.energy[0].toFixed(0) + ',' + force.forceState.energy[1].toFixed(0));
