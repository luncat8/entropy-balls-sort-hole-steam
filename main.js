// owns: boot/wiring only
// edit for: load order, boot, wiring

const $ = id => document.getElementById(id);
const runtime = { timeMs: 0, dtMs: 0 };

function mainFrame(tMs) {
	const dtSec = runtime.timeMs === 0 ? 0 : (tMs - runtime.timeMs) / 1000;
	runtime.timeMs = tMs;
	runtime.dtMs = dtSec * 1000;
	// a held quest shows a goal, so the field holds still: a moving goal view would read as the live field
	if (!goalHolding()) simAdvance(dtSec);
	forcePanelPaint();
	questPaint();
	scoreboardPaint();
	canvasDraw(dtSec);
	requestAnimationFrame(mainFrame);
}

// the bot is one more writer of a hole request, so it runs on the same fixed-step hook as the humans
function mainControlStep(dt) {
	inputStep();
	botStep(dt);
}

// A round resets play, not the chosen controllers or simulation settings.
function mainRestartRound() {
	questReleaseAll();
	goalClose();
	inputRelease();
	simInit();
	forceInit();
	inputRebind();
	botInit();
	tasksInit();
	for (let id = 0; id < players.count; id++) tasksAttach(id);
	questRepaint();
	forcePanelPaint();
	scoreboardPaint();
}

function mainBoot() {
	simInit();
	playersInit(1);
	tasksInit();
	for (let i = 0; i < players.count; i++) tasksAttach(i);
	canvasInit();
	goalInit();
	previewInit();
	forceInit();
	inputInit();
	settingsInit();
	forcePanelInit();
	botInit();
	scoreboardInit(mainRestartRound);
	simSetControlHook(mainControlStep);
	requestAnimationFrame(mainFrame);
}

// boot runs in the browser only so every file also loads under bare node
if (typeof document !== 'undefined') mainBoot();

if (typeof module !== 'undefined') module.exports = { mainBoot, mainFrame, mainControlStep, mainRestartRound, runtime };
