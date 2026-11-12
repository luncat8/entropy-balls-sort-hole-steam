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
	statusPaint(goalHolding(), inputChannel(0), inputChannel(1), players.count);
	modeFrame();
	canvasDraw(dtSec);
	requestAnimationFrame(mainFrame);
}

// one fixed-step boundary: territory and plate-color run their own room tinting, standard/ball-gun use roomsTint
function mainControlStep(dt) {
	if (typeof roomsState !== 'undefined' && roomsState.enabled && !modeIs('territory') && !modeIs('plate-color')) {
		roomsTint(dt);
	}
	modeControlStep(dt);
}

// A round resets play, not the chosen controllers or simulation settings.
function mainRestartRound() {
	questReleaseAll();
	goalClose();
	inputRelease();
	simInit();
	modeRoundReset();
	forceInit();
	inputRebind();
	if (typeof modeApplyInput !== 'undefined') modeApplyInput();
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
	botInit();
	tasksInit();
	for (let i = 0; i < players.count; i++) tasksAttach(i);
	canvasInit();
	goalInit();
	previewInit();
	forceInit();
	inputInit();
	modeInit();
	if (typeof roomsInit !== 'undefined') roomsInit();
	settingsInit();
	drawerInit();
	forcePanelInit();
	scoreboardInit(mainRestartRound);
	statusInit();
	statusPaint(goalHolding(), inputChannel(0), inputChannel(1), players.count);
	simSetControlHook(mainControlStep);
	requestAnimationFrame(mainFrame);
}

// boot runs in the browser only so every file also loads under bare node
if (typeof document !== 'undefined') mainBoot();

if (typeof module !== 'undefined') module.exports = { mainBoot, mainFrame, mainControlStep, mainRestartRound, runtime };
