// owns: participant identity, type and lifecycle
// edit for: adding participants, controller type

const PLAYER_CAP = 2;
const PLAYER_HUMAN = 0;
const PLAYER_BOT = 1;

const players = {
	count: 0,
	type: new Uint8Array(PLAYER_CAP)
};

function playersAdd(type) {
	if (players.count >= PLAYER_CAP) return -1;
	const id = players.count;
	players.type[id] = type;
	players.count = id + 1;
	return id;
}

function playersInit() {
	players.count = 0;
	playersAdd(PLAYER_HUMAN);
}

if (typeof module !== 'undefined') module.exports = { players, playersInit, playersAdd, PLAYER_CAP, PLAYER_HUMAN, PLAYER_BOT };
