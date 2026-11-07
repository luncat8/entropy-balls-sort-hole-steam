// owns: task generation and solve detection
// edit for: task rules, categories
var TaskGen = {
	COLORS: Sim.COLORS,
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
			t = { side: side, op: op, pct: pct, category: category, holdSeconds: 2 };
		} while (prev && this.same(t, prev));
		return t;
	},
	same: function (a, b) {
		const ca = typeof a.category === 'string' ? a.category : a.category.color;
		const cb = typeof b.category === 'string' ? b.category : b.category.color;
		return a.side === b.side && a.op === b.op && a.pct === b.pct && ca === cb;
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
		const met = player.task.op === '>' ? fraction > player.task.pct / 100 : fraction < player.task.pct / 100;
		if (met) player.holdTime += DT; else player.holdTime = 0;
		if (player.holdTime >= player.task.holdSeconds) {
			player.solvedCount++;
			player.task = this.generate(player.task);
			player.holdTime = 0;
		}
	}
};

if (typeof module !== 'undefined' && module.exports) module.exports = TaskGen;
