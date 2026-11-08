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

// Slots keep their identity while either controller changes; the mask automates each slot independently.
function playersInit(humans, bots) {
	const humansOn = humans === 2 ? 2 : 1;
	const mask = bots || 0;
	players.count = 0;
	for (let id = 0; id < humansOn; id++) playersAdd(mask & (1 << id) ? PLAYER_BOT : PLAYER_HUMAN);
	inputRebind();
}

if (typeof module !== 'undefined') module.exports = { players, playersInit, playersAdd, PLAYER_CAP, PLAYER_HUMAN, PLAYER_BOT };
