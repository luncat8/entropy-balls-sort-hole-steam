// owns: the player score table, per-slot bot checkboxes and match-mode readout
// edit for: score columns, controller controls, player table copy

const SCORE_MODE_TEXT = [
	'Solo · you control Player 1',
	'Solo · you control Player 2',
	'You control Player 1 · Player 2 is a bot',
	'Player 1 is a bot · you control Player 2',
	'Player 1: mouse · Player 2: arrows',
	'Bot match · spectating',
	'Player 1 is a bot · check Player 2 to join'
];
const scoreboardUi = { rows: [], mode: null, restart: null };
const scoreboardCache = { mode: -1 };
let scoreboardRestartHook = null;

function scoreboardInit(restartHook) {
	scoreboardRestartHook = restartHook;
	scoreboardUi.mode = $('score-mode');
	scoreboardUi.restart = $('score-restart');
	scoreboardUi.restart.addEventListener('click', scoreboardRestart);
	const body = $('score-rows');
	const frag = document.createDocumentFragment();
	for (let id = 0; id < PLAYER_CAP; id++) frag.append(scoreboardBuildRow(id));
	body.append(frag);
	scoreboardPaint();
}

function scoreboardBuildRow(id) {
	const row = document.createElement('tr');
	row.className = 'score-row';
	const name = document.createElement('th');
	name.scope = 'row';
	name.textContent = 'Player ' + (id + 1);
	const botCell = document.createElement('td');
	const checkbox = document.createElement('input');
	checkbox.type = 'checkbox';
	checkbox.className = 'score-bot';
	checkbox.setAttribute('aria-label', 'Player ' + (id + 1) + ' is a bot');
	checkbox.addEventListener('change', e => settingsSetBot(id, e.currentTarget.checked, true));
	botCell.append(checkbox);
	const scoreCell = document.createElement('td');
	scoreCell.className = 'score-value';
	const score = document.createElement('span');
	scoreCell.append(score);
	row.append(name, botCell, scoreCell);
	scoreboardUi.rows.push({ el: row, checkbox, score, active: null, bot: null, value: null });
	return row;
}

function scoreboardRestart() {
	if (scoreboardRestartHook) scoreboardRestartHook();
}

function scoreboardMode() {
	let humans = 0;
	let humanId = 0;
	for (let id = 0; id < players.count; id++) {
		if (players.type[id] !== PLAYER_HUMAN) continue;
		humanId = id;
		humans++;
	}
	if (humans === 2) return 4;
	if (humans === 0) return players.count === 2 ? 5 : 6;
	if (players.count === 1) return humanId;
	return humanId === 0 ? 2 : 3;
}

function scoreboardPaint() {
	if (!scoreboardUi.rows.length) return;
	for (let id = 0; id < PLAYER_CAP; id++) {
		const row = scoreboardUi.rows[id];
		const active = id < players.count;
		const bot = active && players.type[id] === PLAYER_BOT;
		const value = active ? tasksScore[id] : -1;
		if (row.active !== active || row.bot !== bot) {
			row.active = active;
			row.bot = bot;
			row.checkbox.checked = bot;
			row.el.setAttribute('data-active', active ? 'true' : 'false');
			row.el.setAttribute('data-controller', bot ? 'bot' : (active ? 'human' : 'open'));
		}
		if (row.value === value) continue;
		row.value = value;
		row.score.textContent = active ? String(value) : '—';
	}
	const mode = scoreboardMode();
	if (mode === scoreboardCache.mode) return;
	scoreboardCache.mode = mode;
	scoreboardUi.mode.textContent = SCORE_MODE_TEXT[mode];
}

if (typeof module !== 'undefined') module.exports = {
	scoreboardUi, scoreboardInit, scoreboardPaint, scoreboardMode, SCORE_MODE_TEXT
};
