// owns: settings, status bar, help text, settings panel
// edit for: controls, url persistence, help messages
var Settings = {
	holeSize: 48,
	holeMaxSpeed: 300,
	holeMoveEnergyCost: 1,
	ballSize: 8,
	ballSpeed: 160,
	ballSizeRandom: false,
	ballCollisions: false,
	ballCount: 60,
	generation: 0,
	storage: 100,
	force0: 0,
	force1: 0,
	bot0: false,
	bot1: true,
	darkTheme: true
};

var DEFAULTS = JSON.parse(JSON.stringify(Settings));

var UI = {
	panelOpen: false,
	lastStatus: '',
	helpIndex: 0,
	helpTimer: 0,
	init: function () {
		this.loadFromURL();
		this.buildPanel();
		this.buildTopBar();
		this.buildBottomBar();
		this.buildTaskPanel();
		document.addEventListener('keydown', (e) => {
			if (e.key === 's' || e.key === 'S') this.togglePanel();
		});
	},
	togglePanel: function () {
		this.panelOpen = !this.panelOpen;
		const p = document.getElementById('settings-panel');
		if (p) p.classList.toggle('hidden', !this.panelOpen);
	},
	buildTopBar: function () {
		const el = document.getElementById('topbar');
		if (!el) return;
		el.innerHTML = '<span class="title">ENTROPY BALLS</span> <button id="settings-btn">settings (S)</button> <span id="task-text"></span> <span id="hold-text"></span> <span id="solved-text"></span> <span id="ballcount-text"></span> <span id="fps-text"></span>';
		const btn = document.getElementById('settings-btn');
		if (btn) btn.addEventListener('click', () => this.togglePanel());
	},
	buildBottomBar: function () {
		const el = document.getElementById('bottombar');
		if (!el) return;
		el.innerHTML = '<span id="help-text"></span> <span id="energy-text"></span>';
	},
	buildTaskPanel: function () {
		const panel = document.getElementById('task-panel');
		if (!panel) return;
		this.refreshTaskPanel();
	},
	refreshTaskPanel: function () {
		const panel = document.getElementById('task-panel');
		if (!panel) return;
		let html = '<b>open tasks</b>';
		for (const t of TaskGen.queue) {
			const cat = (typeof t.category === 'string') ? t.category : t.category.color;
			html += '<div style="margin:4px 0;">' + t.side + ' ' + t.op + t.pct + '% ' + cat +
				' <button data-task="' + t.id + '" data-player="0">sign P0</button>' +
				' <button data-task="' + t.id + '" data-player="1">sign P1</button></div>';
		}
		if (TaskGen.queue.length === 0) html += '<div>none open</div>';
		html += '<div style="margin-top:6px;"><b>claimed</b></div>';
		for (let i = 0; i < Players.list.length; i++) {
			const p = Players.list[i];
			const t = p.task;
			const txt = t ? (t.side + ' ' + t.op + t.pct + '% ' + ((typeof t.category === 'string') ? t.category : t.category.color)) : 'none';
			html += '<div>P' + i + ': ' + txt + (t ? ' <button data-abandon="' + i + '">abandon</button>' : '') + '</div>';
		}
		if (panel.innerHTML === html) return;
		panel.innerHTML = html;
		panel.querySelectorAll('button[data-task]').forEach(btn => {
			btn.addEventListener('click', () => {
				const tid = parseInt(btn.getAttribute('data-task'), 10);
				const pid = parseInt(btn.getAttribute('data-player'), 10);
				TaskGen.claim(pid, tid);
				this.refreshTaskPanel();
			});
		});
		panel.querySelectorAll('button[data-abandon]').forEach(btn => {
			btn.addEventListener('click', () => {
				const pid = parseInt(btn.getAttribute('data-abandon'), 10);
				TaskGen.abandon(pid);
				this.refreshTaskPanel();
			});
		});
	},
	buildPanel: function () {
		const panel = document.getElementById('settings-panel');
		if (!panel) return;
		const rows = [
			{ key: 'holeSize', label: 'hole size', type: 'range', min: 16, max: 200, step: 1 },
			{ key: 'holeMaxSpeed', label: 'max hole speed', type: 'range', min: 60, max: 600, step: 10 },
			{ key: 'holeMoveEnergyCost', label: 'move energy cost', type: 'range', min: 0, max: 10, step: 0.1 },
			{ key: 'ballSize', label: 'ball size', type: 'range', min: 4, max: 24, step: 1 },
			{ key: 'ballSpeed', label: 'ball speed', type: 'range', min: 40, max: 400, step: 10 },
			{ key: 'ballCount', label: 'ball count', type: 'range', min: 10, max: 200, step: 1 },
			{ key: 'generation', label: 'generation', type: 'range', min: 0, max: 5, step: 0.1 },
			{ key: 'storage', label: 'energy storage', type: 'range', min: 10, max: 500, step: 10 },
			{ key: 'force0', label: 'force P0', type: 'range', min: -400, max: 400, step: 10 },
			{ key: 'force1', label: 'force P1', type: 'range', min: -400, max: 400, step: 10 }
		];
		let html = '<h3>settings</h3>';
		for (const r of rows) {
			html += '<label>' + r.label + ' <input type="range" data-key="' + r.key + '" min="' + r.min + '" max="' + r.max + '" step="' + r.step + '" value="' + Settings[r.key] + '"> <span class="val" data-val="' + r.key + '">' + Settings[r.key] + '</span></label>';
		}
		html += '<label>random ball size <input type="checkbox" data-key="ballSizeRandom"' + (Settings.ballSizeRandom ? ' checked' : '') + '></label>';
		html += '<label>ball collisions <input type="checkbox" data-key="ballCollisions"' + (Settings.ballCollisions ? ' checked' : '') + '></label>';
		html += '<label>dark theme <input type="checkbox" data-key="darkTheme"' + (Settings.darkTheme ? ' checked' : '') + '></label>';
		html += '<label>bot P0 <input type="checkbox" data-key="bot0"' + (Settings.bot0 ? ' checked' : '') + '></label>';
		html += '<label>bot P1 <input type="checkbox" data-key="bot1"' + (Settings.bot1 ? ' checked' : '') + '></label>';
		html += '<button id="copy-link">copy link</button>';
		panel.innerHTML = html;
		panel.classList.add('hidden');
		panel.querySelectorAll('input').forEach(inp => {
			const key = inp.getAttribute('data-key');
			inp.addEventListener('input', () => {
				if (inp.type === 'checkbox') Settings[key] = inp.checked;
				else Settings[key] = parseFloat(inp.value);
				const v = panel.querySelector('[data-val="' + key + '"]');
				if (v) v.textContent = Settings[key];
				applySettings();
			});
		});
		const copyBtn = document.getElementById('copy-link');
		if (copyBtn) copyBtn.addEventListener('click', () => {
			navigator.clipboard.writeText(location.href).catch(() => { });
		});
	},
	loadFromURL: function () {
		const params = new URLSearchParams(location.search);
		for (const key in Settings) {
			if (params.has(key)) {
				const v = params.get(key);
			if (typeof Settings[key] === 'boolean') Settings[key] = (v === '1' || v === 'true');
			else {
				const n = parseFloat(v);
				if (!isNaN(n)) Settings[key] = n;
			}
			}
		}
		if (params.has('bot0')) Settings.bot0 = params.get('bot0') === '1';
		if (params.has('bot1')) Settings.bot1 = params.get('bot1') === '1';
		Players.list[0].isBot = Settings.bot0;
		Players.list[1].isBot = Settings.bot1;
		if (typeof clampSetting === 'function') clampSetting();
	},
	saveToURL: function () {
		const params = new URLSearchParams();
		const keys = Object.keys(Settings).sort();
		for (const key of keys) {
			if (Settings[key] !== DEFAULTS[key]) {
				params.set(key, typeof Settings[key] === 'boolean' ? (Settings[key] ? '1' : '0') : Settings[key]);
			}
		}
		const qs = params.toString();
		history.replaceState(null, '', qs ? ('?' + qs) : location.pathname);
	},
	updateStatus: function (DT) {
		const p0 = Players.list[0];
		const p1 = Players.list[1];
		const taskText = document.getElementById('task-text');
		if (taskText) {
			const t0 = p0.task ? ('P0 ' + taskTextForm(p0.task)) : '';
			const t1 = p1.task ? ('P1 ' + taskTextForm(p1.task)) : '';
			const t = (t0 + (t0 && t1 ? ' | ' : '') + t1).trim();
			if (taskText.textContent !== t) taskText.textContent = t;
		}
		const holdText = document.getElementById('hold-text');
		if (holdText) {
			const h0 = p0.task ? (p0.holdTime / p0.task.holdSeconds) : 0;
			const h1 = p1.task ? (p1.holdTime / p1.task.holdSeconds) : 0;
			const hs = 'hold P0:' + Math.round(h0 * 100) + '% P1:' + Math.round(h1 * 100) + '%';
			if (holdText.textContent !== hs) holdText.textContent = hs;
		}
		const solved = document.getElementById('solved-text');
		const solvedStr = 'solved P0:' + p0.solvedCount + ' P1:' + p1.solvedCount;
		if (solved && solved.textContent !== solvedStr) solved.textContent = solvedStr;
		const bc = document.getElementById('ballcount-text');
		const bcStr = 'balls:' + Sim.ballCount;
		if (bc && bc.textContent !== bcStr) bc.textContent = bcStr;
		const fps = document.getElementById('fps-text');
		const fpsStr = 'fps:' + Math.round(1 / DT);
		if (fps && fps.textContent !== fpsStr) fps.textContent = fpsStr;
		const energy = document.getElementById('energy-text');
		const energyStr = 'E0:' + p0.energy.toFixed(0) + '/' + p0.energyMax + ' E1:' + p1.energy.toFixed(0) + '/' + p1.energyMax;
		if (energy && energy.textContent !== energyStr) energy.textContent = energyStr;
		// help
		this.helpTimer += DT;
		let help = '';
		if (UI.panelOpen) help = 'Settings are saved in the URL.';
		else if (p0.energy <= 0 || p1.energy <= 0) help = 'Energy empty — wait to recharge.';
		else if (p0.task) help = 'Keep ' + p0.task.side + ' ' + p0.task.op + p0.task.pct + '% ' + ((typeof p0.task.category === 'string') ? p0.task.category : p0.task.category.color) + ' balls.';
		else if (Settings.bot0 || Settings.bot1) help = 'Hold mouse/touch to push or pull the hole.';
		else help = 'Drag the hole to let balls pass.';
		const tips = ['Settings are saved in the URL.', 'Keep the target side above the threshold.'];
		if (!help && this.helpTimer > 6) { this.helpIndex = (this.helpIndex + 1) % tips.length; this.helpTimer = 0; }
		if (!help) help = tips[this.helpIndex];
		const ht = document.getElementById('help-text');
		if (ht && ht.textContent !== help) ht.textContent = help;
		this.refreshTaskPanel();
	}
};

function taskTextForm(t) {
	if (!t) return '';
	const cat = (typeof t.category === 'string') ? t.category : t.category.color;
	return t.side + ' hold ' + t.op + t.pct + '% ' + cat + ' balls';
}

function clampSetting() {
	Settings.holeSize = clamp(Settings.holeSize, 16, 200);
	Settings.holeMaxSpeed = clamp(Settings.holeMaxSpeed, 60, 600);
	Settings.holeMoveEnergyCost = clamp(Settings.holeMoveEnergyCost, 0, 10);
	Settings.ballSize = clamp(Settings.ballSize, 4, 24);
	Settings.ballSpeed = clamp(Settings.ballSpeed, 40, 400);
	Settings.ballCount = clamp(Settings.ballCount, 10, 200);
	Settings.generation = clamp(Settings.generation, 0, 5);
	Settings.storage = clamp(Settings.storage, 10, 500);
	Settings.force0 = clamp(Settings.force0, -400, 400);
	Settings.force1 = clamp(Settings.force1, -400, 400);
}
function applySettings() {
	clampSetting();
	document.body.style.background = Settings.darkTheme ? '#0b0f14' : '#f1f5f9';
	document.body.style.color = Settings.darkTheme ? '#e5e7eb' : '#0f172a';
	Players.list[0].isBot = Settings.bot0;
	Players.list[1].isBot = Settings.bot1;
	Players.list[0].force = Settings.force0;
	Players.list[1].force = Settings.force1;
	Players.list[0].energyMax = Settings.storage;
	Players.list[1].energyMax = Settings.storage;
	Players.list[0].energy = Math.min(Players.list[0].energy, Players.list[0].energyMax);
	Players.list[1].energy = Math.min(Players.list[1].energy, Players.list[1].energyMax);
	Sim.ensureCount(Settings.ballCount);
	UI.saveToURL();
}

if (typeof module !== 'undefined' && module.exports) module.exports = { Settings: Settings, UI: UI, applySettings: applySettings };
