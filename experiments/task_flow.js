// owns: seeded live task flow — one line per assignment and per completion, solo bot
// edit for: seed, run length, printed fields

const path = require('path');
const { loadGame } = require('./vmload');

const { apis, ctx } = loadGame(path.join(__dirname, '..'));
const sim = apis['simulation.js'];
const roster = apis['players.js'];
const force = apis['force.js'];
const tasks = apis['tasks.js'];
const bot = apis['bot.js'];

// generation draws from the shared Math, so seeding it is what makes a run repeatable
let x = Number(process.argv[2] || 7);
ctx.Math.random = () => {
	x = (x * 1664525 + 1013904223) >>> 0;
	return x / 4294967296;
};

const SECONDS = Number(process.argv[3] || 120);
const DT = sim.FIXED_DT;

sim.simSetSpawnRate(1.6666666666666667);
sim.simInit();
force.forceSetCapacity(force.FORCE_CAPACITY);
force.forceSetCost(force.FORCE_COST);
roster.playersInit(1, 1);
force.forceInit();
bot.botInit();
tasks.tasksInit();
tasks.tasksSetRand(ctx.Math.random);
tasks.tasksAttach(0);

let cur = null;
for (let i = 0; i < SECONDS / DT; i++) {
	sim.simStep(DT);
	const v = tasks.tasksView[0];
	const sig = v.category + v.cmp + v.threshold + v.measure + v.side + v.cost + v.mode;
	if (cur && sig === cur.sig) continue;
	if (cur) console.log('  END ' + (tasks.tasksScore[0] > cur.score ? 'DONE' : 'LOST') + ' after '
		+ (i * DT - cur.at).toFixed(1) + 's');
	cur = { sig, at: i * DT, score: tasks.tasksScore[0] };
	console.log('t=' + (i * DT).toFixed(1) + ' NEW ' + v.side + ' ' + v.cmp + v.threshold + '% '
		+ (v.measure === 'total' ? 'of ' : '') + v.category + ' ' + v.mode + ' match=' + v.match
		+ '/' + v.denom + ' cost=' + v.cost + ' ' + v.difficulty);
}
