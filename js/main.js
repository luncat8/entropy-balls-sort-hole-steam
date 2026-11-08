// owns: boot/wiring only
// edit for: load order is in index.html; boot sequence
const $ = id => document.getElementById(id);

var App = { running: true, lastTime: 0, fpsAcc: 0, fpsFrames: 0, fps: 60 };

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
	App.lastTime = performance.now();
	requestAnimationFrame(loop);
}

function loop(now) {
	if (!App.running) return;
	const DT = Sim.DT;
	Players.update(DT);
	Sim.stepBalls(DT);
	Sim.updateSpots(DT);
	Render.draw();
	UI.updateStatus(DT);
	requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', boot);

if (typeof module !== 'undefined' && module.exports) module.exports = { App: App };
