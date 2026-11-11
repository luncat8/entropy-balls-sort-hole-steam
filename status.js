// owns: live/preview status and contextual control guidance
// edit for: status copy, controller help, preview help, mode controls

const STATUS_PLAY_TEXT = [
	'Live field · hold a quest to preview its goal.',
	'Goal preview · field paused. Release the quest to resume.'
];
const STATUS_CONTROL_TEXT = [
	'Bot controls this player. Turn off Bot in the player table to take over.',
	'Wheel or slider: set force. Hold the field to aim, or hold the slider to push. ↑↓: adjust; hold Space: apply.',
	'Wheel or slider: set force. Hold the field to aim, or hold the slider to push.',
	'↑↓: adjust force. Hold →: apply. Release to stop.'
];
const STATUS_MODE_CONTROL = {
	territory: [
		'P1 red · pointer moves the gun and aims. Middle hold pulls, left click pushes. Touch: hold/tap.',
		'P2 blue · ↑↓ moves the gun, hold → pulls, Space pushes.'
	],
	'ball-gun': [
		'P1 gun · pointer aims. Middle hold pulls a ball into the gun (up to 3 stored), left click launches the oldest. Touch: hold/tap.',
		'P2 hole · ↑↓ sets force, hold → moves the hole at quarter speed.'
	]
};
const statusUi = { state: null, controls: [], players: [] };
const statusCache = { paused: null, controls: new Int8Array(2), modeText: ['', ''] };
let statusMode = 'standard';

function statusSetMode(mode) {
	statusMode = mode;
	statusCache.controls.fill(-2);
	statusCache.modeText[0] = '';
	statusCache.modeText[1] = '';
}

function statusInit() {
	statusUi.state = $('game-status-state');
	for (let id = 0; id < 2; id++) {
		statusUi.players[id] = $('game-status-player-' + id);
		statusUi.controls[id] = $('game-status-control-' + id);
	}
	statusCache.paused = null;
	statusCache.controls.fill(-2);
}

function statusControlMode(channel, otherChannel) {
	if (channel === 'keys') return 3;
	if (channel === 'mouse') return otherChannel === 'keys' ? 2 : 1;
	return 0;
}

function statusPaint(paused, channel0, channel1, count) {
	if (statusCache.paused !== paused) {
		statusCache.paused = paused;
		statusUi.state.textContent = STATUS_PLAY_TEXT[paused ? 1 : 0];
	}
	for (let id = 0; id < 2; id++) {
		if (statusMode !== 'standard') {
			const text = STATUS_MODE_CONTROL[statusMode][id];
			if (statusCache.modeText[id] === text) continue;
			statusCache.modeText[id] = text;
			statusUi.players[id].hidden = false;
			statusUi.controls[id].textContent = text;
			continue;
		}
		if (statusCache.modeText[id] !== '') {
			statusCache.modeText[id] = '';
			statusCache.controls[id] = -2;
		}
		const mode = id >= count ? -1 : statusControlMode(id === 0 ? channel0 : channel1, id === 0 ? channel1 : channel0);
		if (statusCache.controls[id] === mode) continue;
		statusCache.controls[id] = mode;
		statusUi.players[id].hidden = mode < 0;
		statusUi.controls[id].textContent = mode < 0 ? '' : STATUS_CONTROL_TEXT[mode];
	}
}

if (typeof module !== 'undefined') module.exports = { statusInit, statusPaint, statusSetMode };
