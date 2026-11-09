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
	const label = document.createElement('span');
	label.textContent = 'Player ' + (id + 1);
	const badge = document.createElement('span');
	badge.className = 'char-badge';
	badge.hidden = true;
	name.append(label, badge);
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
	scoreboardUi.rows.push({ el: row, checkbox, badge, score, active: null, bot: null, char: null, value: null });
	return row;
}

// A bot's slot shows the character that bot drew, next to the name the player table already uses, so
// two bots in one match read as two different plans rather than two identical ones. The table is the
// narrower of the two places a player is named, so it carries the icon and its tint alone.
function scoreboardChar(row, char) {
	row.char = char;
	row.badge.hidden = !char;
	if (!char) return;
	row.badge.textContent = char.icon;
	row.badge.setAttribute('data-char', char.id);
	row.badge.title = char.name + ' · ' + char.hint;
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
		const char = bot ? botCharOf(id) : null;
		if (row.char !== char) scoreboardChar(row, char);
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
