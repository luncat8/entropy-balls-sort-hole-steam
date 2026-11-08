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
	canvasDraw(dtSec);
	requestAnimationFrame(mainFrame);
}

function mainBoot() {
	simInit();
	playersInit();
	tasksInit();
	for (let i = 0; i < players.count; i++) tasksAttach(i);
	canvasInit();
	settingsInit();
	goalInit();
	previewInit();
	forceInit();
	inputInit();
	forcePanelInit();
	simSetControlHook(inputStep);
	requestAnimationFrame(mainFrame);
}

// boot runs in the browser only so every file also loads under bare node
if (typeof document !== 'undefined') mainBoot();

if (typeof module !== 'undefined') module.exports = { mainBoot, mainFrame, runtime };
