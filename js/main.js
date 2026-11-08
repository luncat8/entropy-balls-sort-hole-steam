// owns: boot/wiring only
// edit for: load order is in index.html; boot sequence
const $ = id => document.getElementById(id);

var Loop = { running: true, lastTime: 0, fps: 60 };

function boot() {
	Sim.init();
	Render.init();
	GoalView.init();
	UI.init();
	Players.init();
	if (typeof Bot !== 'undefined' && Bot.init) Bot.init();
	Input.init();
	applySettings();
	TaskGen.initQueue();
	PreviewInitSafe();
	UI.refreshTaskPanel();
	Sim.ensureCount(Settings.ballCount);
	Loop.lastTime = performance.now();
	requestAnimationFrame(loop);
}

function PreviewInitSafe() {
	if (typeof previewInit === 'function') previewInit();
}

function loop(now) {
	if (!Loop.running) return;
	const frameDt = now - Loop.lastTime;
	if (frameDt > 0) Loop.fps = 1000 / frameDt;
	Loop.lastTime = now;
	const DT = Sim.DT;
	if (!goalHolding()) {
		Players.update(DT);
		Sim.stepBalls(DT);
		Sim.updateSpots(DT);
	}
	Render.draw();
	UI.updateStatus(DT);
	requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', boot);

if (typeof module !== 'undefined' && module.exports) module.exports = { Loop: Loop };
