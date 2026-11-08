// owns: boot/wiring only
// edit for: load order is in index.html; boot sequence
const $ = id => document.getElementById(id);

var Loop = { running: true, lastTime: 0, fps: 60 };

function boot() {
	Sim.init();
	Render.init();
	UI.init();
	Players.init();
	Input.init();
	applySettings();
	TaskGen.initQueue();
	UI.refreshTaskPanel();
	Sim.ensureCount(Settings.ballCount);
	Loop.lastTime = performance.now();
	requestAnimationFrame(loop);
}

function loop(now) {
	if (!Loop.running) return;
	const frameDt = now - Loop.lastTime;
	if (frameDt > 0) Loop.fps = 1000 / frameDt;
	Loop.lastTime = now;
	const DT = Sim.DT;
	Players.update(DT);
	Sim.stepBalls(DT);
	Sim.updateSpots(DT);
	Render.draw();
	UI.updateStatus(DT);
	requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', boot);

if (typeof module !== 'undefined' && module.exports) module.exports = { Loop: Loop };
