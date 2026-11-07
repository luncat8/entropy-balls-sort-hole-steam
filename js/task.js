// owns: task generation and solve detection
// edit for: task rules, categories
var TaskGen = {
	COLORS: Sim.COLORS,
	queue: [],
	queueSize: 4,
	nextId: 1,
	generate: function (prev) {
		let t;
		do {
			const side = Math.random() < 0.5 ? 'left' : 'right';
			const op = Math.random() < 0.5 ? '>' : '<';
			const pct = 50 + Math.floor(Math.random() * 7) * 5;
			let category;
			const r = Math.random();
			if (r < 0.4) category = 'cold';
			else if (r < 0.8) category = 'hot';
			else category = { color: Sim.COLORS[Math.floor(Math.random() * 6)] };
			t = { id: this.nextId++, side: side, op: op, pct: pct, category: category, holdSeconds: 2, claimedBy: null };
		} while (prev && this.same(t, prev));
		return t;
	},
	same: function (a, b) {
		const ca = typeof a.category === 'string' ? a.category : a.category.color;
		const cb = typeof b.category === 'string' ? b.category : b.category.color;
		return a.side === b.side && a.op === b.op && a.pct === b.pct && ca === cb;
	},
	makeTask: function (prev) {
		return this.generate(prev);
	},
	refillQueue: function () {
		while (this.queue.length < this.queueSize) {
			const prev = this.queue.length ? this.queue[this.queue.length - 1] : null;
			this.queue.push(this.generate(prev));
		}
	},
	initQueue: function () {
		this.queue = [];
		this.refillQueue();
	},
	claim: function (playerIndex, taskId) {
		let idx = -1;
		for (let i = 0; i < this.queue.length; i++) if (this.queue[i].id === taskId) { idx = i; break; }
		if (idx < 0) return false;
		const task = this.queue.splice(idx, 1)[0];
		task.claimedBy = playerIndex;
		const players = (typeof Players !== 'undefined') ? Players.list : null;
		if (players && players[playerIndex]) {
			players[playerIndex].task = task;
			players[playerIndex].holdTime = 0;
		}
		this.refillQueue();
		return true;
	},
	abandon: function (playerIndex) {
		const players = (typeof Players !== 'undefined') ? Players.list : null;
		if (!players || !players[playerIndex]) return false;
		const task = players[playerIndex].task;
		if (task && task.claimedBy === playerIndex) {
			task.claimedBy = null;
			this.queue.push(task);
		}
		players[playerIndex].task = null;
		players[playerIndex].holdTime = 0;
		return true;
	},
	inCategory: function (ball, category) {
		if (category === 'cold') return ball.colorIndex < 3;
		if (category === 'hot') return ball.colorIndex >= 3;
		return ball.color === category.color;
	},
	updatePlayer: function (player, DT) {
		if (!player.task) player.task = this.generate(null);
		if (!player.holdTime) player.holdTime = 0;
		let onSide = 0;
		let inCat = 0;
		for (let i = 0; i < Sim.MAX_BALLS; i++) {
			const b = Sim.balls[i];
			if (!b.active) continue;
			const left = b.x < Sim.CX;
			if (player.task.side === 'left' && !left) continue;
			if (player.task.side === 'right' && left) continue;
			onSide++;
			if (this.inCategory(b, player.task.category)) inCat++;
		}
		const fraction = onSide > 0 ? inCat / onSide : 0;
		let met = player.task.op === '>' ? fraction > player.task.pct / 100 : fraction < player.task.pct / 100;
		if (onSide === 0) met = false;
		if (met) player.holdTime += DT; else player.holdTime = 0;
		if (player.holdTime >= player.task.holdSeconds) {
			player.solvedCount++;
			if (player.task && player.task.claimedBy !== null && player.task.claimedBy !== undefined) {
				// remove claimed task from any queue (already removed) 
			}
			player.task = this.generate(player.task);
			player.holdTime = 0;
			this.refillQueue();
		}
	}
};

if (typeof module !== 'undefined' && module.exports) module.exports = TaskGen;
