// owns: task generation and solve detection
// edit for: task rules, categories
var TaskGen = {
	COLORS: Sim.COLORS,
	queue: [],
	queueSize: 4,
	nextId: 1,
	LABELS: ['easy', 'normal', 'hard', 'expert'],
	BANDS: [5, 10, 17],
	COST_MIN: 3,
	COST_CAP: 27,
	COST_FRAC: 0.75,
	PCTS: [50, 55, 60, 65, 70, 75, 80],
	countsFor: function (cat) {
		let nAll = 0, nCat = 0, leftTotal = 0, rightTotal = 0, leftCat = 0, rightCat = 0;
		for (let i = 0; i < Sim.MAX_BALLS; i++) {
			const b = Sim.balls[i];
			if (!b.active) continue;
			nAll++;
			const left = b.x < Sim.CX;
			if (left) leftTotal++; else rightTotal++;
			if (this.inCategory(b, cat)) {
				nCat++;
				if (left) leftCat++; else rightCat++;
			}
		}
		return { nAll: nAll, nCat: nCat, leftTotal: leftTotal, rightTotal: rightTotal, leftCat: leftCat, rightCat: rightCat };
	},
	cheapest: function (cat, cmp, pct, isLeft, out) {
		const c = this.countsFor(cat);
		const nAll = c.nAll;
		const nCat = c.nCat;
		const sn = isLeft ? c.leftTotal : c.rightTotal;
		const sc = isLeft ? c.leftCat : c.rightCat;
		const u = sn - sc;
		let best = -1;
		let bestClose = 0;
		let bestSide = 0;
		let bestMatch = 0;
		for (let s = 1; s <= nAll; s++) {
			const mHi = nCat < s ? nCat : s;
			const mLoPop = nCat - (nAll - s);
			const loPop = mLoPop > 0 ? mLoPop : 0;
			let ineqLo, ineqHi;
			if (cmp === '>') {
				ineqLo = Math.floor(pct * s / 100) + 1;
				ineqHi = s;
			} else {
				ineqLo = 0;
				ineqHi = Math.floor((pct * s - 1) / 100);
			}
			const lo = ineqLo > loPop ? ineqLo : loPop;
			const hi = ineqHi < mHi ? ineqHi : mHi;
			if (lo > hi) continue;
			const flat = sc < s - u ? sc : s - u;
			const at = flat < lo ? lo : (flat > hi ? hi : flat);
			const cc = Math.abs(at - sc) + Math.abs(s - at - u);
			const close = Math.abs(s - sn);
			if (best >= 0 && (cc > best || (cc === best && close >= bestClose))) continue;
			best = cc;
			bestClose = close;
			bestSide = s;
			bestMatch = at;
		}
		if (out && best >= 0) { out.side = bestSide; out.match = bestMatch; }
		return best;
	},
	cost: function (cat, cmp, pct, isLeft) {
		return this.cheapest(cat, cmp, pct, isLeft, null);
	},
	costMax: function () {
		const nAll = this.countsFor('cold').nAll;
		const c = (nAll * this.COST_FRAC) | 0;
		return c < this.COST_CAP ? c : this.COST_CAP;
	},
	band: function (cost) {
		if (cost < 0) return -1;
		for (let i = 0; i < this.BANDS.length; i++) {
			if (cost <= this.BANDS[i]) return i;
		}
		return this.BANDS.length;
	},
	inBand: function (cost) {
		return cost >= this.COST_MIN && cost <= this.costMax();
	},
	difficulty: function (cost) {
		if (cost < this.COST_MIN) return 'impossible';
		const b = this.band(cost);
		return b < 0 ? 'impossible' : this.LABELS[b];
	},
	categories: function () {
		const cats = ['cold', 'hot'];
		for (let i = 0; i < Sim.COLORS.length; i++) cats.push({ color: Sim.COLORS[i] });
		return cats;
	},
	generate: function (prev, avoid) {
		avoid = avoid || [];
		// build in-band candidates
		const cats = this.categories();
		const sides = ['left', 'right'];
		const ops = ['>', '<'];
		const modes = ['immediate', 'hold'];
		const cands = [];
		for (let si = 0; si < sides.length; si++) {
			for (let ci = 0; ci < cats.length; ci++) {
				for (let oi = 0; oi < ops.length; oi++) {
					for (let pi = 0; pi < this.PCTS.length; pi++) {
						for (let mi = 0; mi < modes.length; mi++) {
							const side = sides[si];
							const category = cats[ci];
							const op = ops[oi];
							const pct = this.PCTS[pi];
							const mode = modes[mi];
							const t = { side: side, op: op, pct: pct, category: category, mode: mode };
							if (prev && this.same(t, prev)) continue;
							if (avoid.some(a => this.same(t, a))) continue;
							const cc = this.cost(category, op, pct, side === 'left');
							if (!this.inBand(cc)) continue;
							cands.push({ side: side, op: op, pct: pct, category: category, mode: mode, cost: cc });
						}
					}
				}
			}
		}
		// label-first draw
		const labelCounts = [0, 0, 0, 0];
		for (let i = 0; i < cands.length; i++) labelCounts[this.band(cands[i].cost)]++;
		let label = -1;
		let k = 0;
		for (let i = 0; i < labelCounts.length; i++) {
			if (!labelCounts[i]) continue;
			k++;
			if ((Math.random() * k | 0) === 0) label = i;
		}
		let pick = -1;
		if (label >= 0) {
			let j = 0;
			for (let i = 0; i < cands.length; i++) {
				if (this.band(cands[i].cost) !== label) continue;
				j++;
				if ((Math.random() * j | 0) === 0) pick = i;
			}
		}
		let t;
		if (pick >= 0) {
			const cd = cands[pick];
			t = { id: this.nextId++, side: cd.side, op: cd.op, pct: cd.pct, category: cd.category, mode: cd.mode, holdSeconds: 2, claimedBy: null, cost: cd.cost, difficulty: this.difficulty(cd.cost) };
		} else {
			// fallback: old random generation
			let guard = 0;
			do {
				guard++;
				const side = Math.random() < 0.5 ? 'left' : 'right';
				const op = Math.random() < 0.5 ? '>' : '<';
				const pct = this.PCTS[Math.floor(Math.random() * this.PCTS.length)];
				let category;
				const r = Math.random();
				if (r < 0.4) category = 'cold';
				else if (r < 0.8) category = 'hot';
				else category = { color: Sim.COLORS[Math.floor(Math.random() * 6)] };
				const mode = Math.random() < 0.5 ? 'immediate' : 'hold';
				const cc = this.cost(category, op, pct, side === 'left');
				t = { id: this.nextId++, side: side, op: op, pct: pct, category: category, mode: mode, holdSeconds: 2, claimedBy: null, cost: cc, difficulty: this.difficulty(cc) };
			} while ((prev && this.same(t, prev)) || avoid.some(a => this.same(t, a)) || guard > 50);
		}
		return t;
	},
	same: function (a, b) {
		const ca = typeof a.category === 'string' ? a.category : a.category.color;
		const cb = typeof b.category === 'string' ? b.category : b.category.color;
		return a.side === b.side && a.op === b.op && a.pct === b.pct && ca === cb && (a.mode || 'hold') === (b.mode || 'hold');
	},
	makeTask: function (prev) {
		return this.generate(prev);
	},
	refillQueue: function () {
		const avoid = [];
		if (typeof Players !== 'undefined' && Players.list) {
			for (let i = 0; i < Players.list.length; i++) if (Players.list[i].task) avoid.push(Players.list[i].task);
		}
		while (this.queue.length < this.queueSize) {
			const prev = this.queue.length ? this.queue[this.queue.length - 1] : null;
			const t = this.generate(prev, avoid);
			this.queue.push(t);
			avoid.push(t);
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
		const players = (typeof Players !== 'undefined') ? Players.list : null;
		if (players && players[playerIndex] && players[playerIndex].task && players[playerIndex].task.claimedBy === playerIndex) {
			this.abandon(playerIndex);
		}
		const task = this.queue.splice(idx, 1)[0];
		task.claimedBy = playerIndex;
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
			if (this.queue.length < this.queueSize) this.queue.push(task);
		}
		players[playerIndex].task = null;
		players[playerIndex].holdTime = 0;
		return true;
	},
	inCategory: function (ball, category) {
		if (category === 'cold') return ball.colorIndex < 3;
		if (category === 'hot') return ball.colorIndex >= 3;
		let idx = Sim.COLORS.indexOf(category.color);
		return ball.colorIndex === idx;
	},
	catHas: function (category, colorIndex) {
		if (category === 'cold') return colorIndex < 3 ? 1 : 0;
		if (category === 'hot') return colorIndex >= 3 ? 1 : 0;
		return Sim.COLORS[colorIndex] === category.color ? 1 : 0;
	},
	catHues: function (category, out) {
		let n = 0;
		for (let i = 0; i < Sim.COLORS.length; i++) {
			if (this.catHas(category, i)) { if (out) out[n] = i; n++; }
		}
		return n;
	},
	need: function (task) {
		if (!task) return 0;
		const onSide = Sim.countSide(task.side);
		if (onSide === 0) return 0;
		if (task.op === '>') return Math.floor(task.pct * onSide / 100) + 1;
		return Math.floor((task.pct * onSide - 1) / 100);
	},
	updatePlayer: function (player, DT, avoid) {
		avoid = avoid || [];
		if (!player.task) player.task = this.generate(null, avoid);
		if (!player.holdTime) player.holdTime = 0;
		if (!player.task.cost && player.task.cost !== 0) {
			player.task.cost = this.cost(player.task.category, player.task.op, player.task.pct, player.task.side === 'left');
			player.task.difficulty = this.difficulty(player.task.cost);
		}
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
		// strict integer compare
		const leftNum = inCat * 100;
		const rightNum = player.task.pct * onSide;
		met = player.task.op === '>' ? leftNum > rightNum : leftNum < rightNum;
		if (onSide === 0) met = false;
		if (met) {
			if ((player.task.mode || 'hold') === 'immediate') {
				player.solvedCount++;
				player.task = this.generate(player.task, avoid);
				player.holdTime = 0;
				this.refillQueue();
			} else {
				player.holdTime += DT;
				if (player.holdTime >= player.task.holdSeconds) {
					player.solvedCount++;
					player.task = this.generate(player.task, avoid);
					player.holdTime = 0;
					this.refillQueue();
				}
			}
		} else {
			player.holdTime = 0;
		}
	}
};

if (typeof module !== 'undefined' && module.exports) module.exports = TaskGen;
