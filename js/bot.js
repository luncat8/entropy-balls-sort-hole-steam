// owns: bot opponent policy (lane aim, prediction, rests, contested hole)
// edit for: heuristics, thresholds, contest timing
var Bot = {
	BOT_THINK_SEC: 0.2,
	BOT_AIM_HORIZON: 4,
	BOT_DECAY_SEC: 2,
	BOT_CROSS_SEC: 1.2,
	BOT_SWITCH_SEC: 0.3,
	BOT_MAG: 0.5,
	BOT_REST_SHARE: 0.15,
	BOT_RESUME_SHARE: 0.55,
	BOT_CONTEST_SEC: 10,
	BOT_DWELL_SEC: 1.5,
	BOT_CROSS_PASSES: 3,
	tune: null,
	state: null,
	scratch: null,
	plan: null,
	planOut: null,
	init: function () {
		this.tune = {
			horizon: this.BOT_AIM_HORIZON,
			decay: this.BOT_DECAY_SEC,
			cross: this.BOT_CROSS_SEC,
			switchLane: this.BOT_SWITCH_SEC,
			mag: this.BOT_MAG,
			think: this.BOT_THINK_SEC,
			rest: this.BOT_REST_SHARE,
			resume: this.BOT_RESUME_SHARE
		};
		this.state = {
			clock: 0,
			think: new Float32Array(2),
			rest: new Uint8Array(2),
			aimed: new Uint8Array(2),
			targetY: new Float32Array(2),
			owner: -1,
			ownedAt: 0,
			parkedAt: -1
		};
		const cap = Sim.MAX_BALLS * this.BOT_CROSS_PASSES;
		this.scratch = {
			t: new Float32Array(cap),
			y: new Float32Array(cap),
			cat: new Uint8Array(cap),
			dir: new Int8Array(cap),
			n: 0,
			isLeft: false
		};
		this.plan = { active: false, defend: false, needCat: 0, spareOther: 0, cost: 0 };
		this.planOut = { side: 0, match: 0 };
		this.state.think.fill(0);
		this.state.rest.fill(0);
		this.state.aimed.fill(0);
		this.state.targetY.fill(0);
		this.botState = this.state;
		this.botTune = this.tune;
		this.botScratch = this.scratch;
		this.botPlan = this.plan;
		this.botPlanOut = this.planOut;
	},
	setTuning: function (values) {
		for (const key in values) {
			if (!(key in this.tune) || !Number.isFinite(values[key])) continue;
			this.tune[key] = values[key];
		}
	},
	deadZone: function () {
		return Settings.holeMaxSpeed * Sim.DT / 2 + 0.01;
	},
	wantsHole: function (id) {
		if (!Players.list[id] || !Players.list[id].isBot) return 0;
		if (!this.state.aimed[id] || this.state.rest[id]) return 0;
		const delta = this.state.targetY[id] - Sim.hole.y;
		if (Math.abs(delta) <= this.deadZone()) return 0;
		return delta < 0 ? -1 : 1;
	},
	opposed: function (first) {
		const direction = this.wantsHole(first);
		if (!direction) return -1;
		for (let id = first + 1; id < Players.list.length; id++) {
			if (this.wantsHole(id) === -direction) return id;
		}
		return -1;
	},
	parked: function (id) {
		if (!this.wantsHole(id)) return true;
		if (this.state.parkedAt < 0) this.state.parkedAt = this.state.clock;
		return this.state.clock - this.state.parkedAt >= this.BOT_DWELL_SEC;
	},
	contest: function () {
		let first = -1;
		for (let id = 0; id < Players.list.length && first < 0; id++) {
			if (this.wantsHole(id)) first = id;
		}
		if (first < 0) return this.release();
		const rival = this.opposed(first);
		if (rival < 0) return this.release();
		const owner = this.state.owner;
		if ((owner === first || owner === rival) && this.state.clock - this.state.ownedAt < this.BOT_CONTEST_SEC) {
			if (!this.parked(owner)) return owner;
		}
		this.state.owner = owner === first ? rival : first;
		this.state.ownedAt = this.state.clock;
		this.state.parkedAt = -1;
		return this.state.owner;
	},
	release: function () {
		this.state.owner = -1;
		this.state.parkedAt = -1;
		return -1;
	},
	think: function (id, dt) {
		if (!Players.list[id] || !Players.list[id].isBot) return;
		this.state.think[id] -= dt;
		if (this.state.think[id] > 0) return;
		this.state.think[id] = this.tune.think;
		this.aim(id);
	},
	crossTime: function (b) {
		const speed = Math.abs(b.vx);
		if (speed < 1) return -1;
		const d = Sim.CX - b.x;
		if (b.vx < 0 ? d < 0 : d > 0) return Math.abs(d) / speed;
		const wall = b.vx < 0 ? b.r : Sim.W - b.r;
		return (Math.abs(b.x - wall) + Math.abs(wall - Sim.CX)) / speed;
	},
	foldY: function (y, vy, t, r) {
		const span = Sim.H - 2 * r;
		if (span < 1) return y;
		let u = y - r + vy * t;
		u %= 2 * span;
		if (u < 0) u += 2 * span;
		if (u > span) u = 2 * span - u;
		return r + u;
	},
	planOpen: function (id) {
		this.plan.active = false;
		const p = Players.list[id];
		if (!p || !p.task) return false;
		const task = p.task;
		let onSide = 0, inCat = 0;
		for (let i = 0; i < Sim.MAX_BALLS; i++) {
			const b = Sim.balls[i];
			if (!b.active) continue;
			const left = b.x < Sim.CX;
			if (task.side === 'left' && !left) continue;
			if (task.side === 'right' && left) continue;
			onSide++;
			if (TaskGen.inCategory(b, task.category)) inCat++;
		}
		const satisfied = onSide > 0 && (task.op === '>' ? (inCat * 100 > task.pct * onSide) : (inCat * 100 < task.pct * onSide));
		this.plan.defend = satisfied && (task.mode || 'hold') === 'hold';
		const isLeft = task.side === 'left';
		const cheapest = TaskGen.cheapest(task.category, task.op, task.pct, isLeft, this.planOut);
		if (cheapest < 0) return false;
		let named = 0, namedMatch = 0;
		for (let i = 0; i < Sim.MAX_BALLS; i++) {
			const b = Sim.balls[i];
			if (!b.active) continue;
			const left = b.x < Sim.CX;
			if (isLeft && !left) continue;
			if (!isLeft && left) continue;
			named++;
			if (TaskGen.catHas(task.category, b.colorIndex)) namedMatch++;
		}
		const catNow = namedMatch;
		this.plan.needCat = this.planOut.match - catNow;
		this.plan.spareOther = (named - catNow) - (this.planOut.side - this.planOut.match);
		this.plan.cost = this.plan.needCat + this.plan.spareOther;
		if (this.plan.cost < 0) this.plan.cost = 0;
		this.plan.active = true;
		return true;
	},
	predict: function (cat, isLeft) {
		const yMin = Sim.hole.r;
		const yMax = Sim.H - yMin;
		let n = 0;
		const sc = this.scratch;
		for (let i = 0; i < Sim.MAX_BALLS; i++) {
			const b = Sim.balls[i];
			if (!b.active) continue;
			const t0 = this.crossTime(b);
			if (t0 < 0) continue;
			const r = b.r;
			const speed = Math.abs(b.vx);
			const left = (Sim.CX - r) * 2 / speed;
			const right = (Sim.W - Sim.CX - r) * 2 / speed;
			const cat0 = TaskGen.catHas(cat, b.colorIndex) ? 1 : 0;
			let dir = b.x < Sim.CX ? 1 : -1;
			let t = t0;
			let since = 0;
			for (let k = 0; k < this.BOT_CROSS_PASSES && t <= this.tune.horizon; k++) {
				const y = this.foldY(b.y, b.vy, since, r);
				const yy = y < yMin ? yMin : (y > yMax ? yMax : y);
				sc.t[n] = t;
				sc.y[n] = yy;
				sc.cat[n] = cat0;
				sc.dir[n] = dir;
				n++;
				since = t;
				t += dir > 0 ? right : left;
				dir = -dir;
			}
		}
		sc.n = n;
		sc.isLeft = isLeft === true;
		return n;
	},
	crossUseful: function (j) {
		const sc = this.scratch;
		const entering = (sc.dir[j] < 0) === sc.isLeft;
		if (sc.cat[j]) return entering && this.plan.needCat > 0;
		return !entering && this.plan.spareOther > 0;
	},
	laneScore: function (n, yc) {
		const half = Sim.hole.r;
		let net = 0;
		const sc = this.scratch;
		for (let j = 0; j < n; j++) {
			const t = sc.t[j];
			if (t > this.tune.horizon) continue;
			if (Math.abs(sc.y[j] - yc) > half) continue;
			const useful = this.crossUseful(j);
			const sign = this.plan.defend ? (useful ? -1 : 0) : (useful ? 1 : -1);
			net += sign / (1 + t / this.tune.decay);
		}
		return net * this.tune.cross - Math.abs(yc - Sim.hole.y) / Settings.holeMaxSpeed;
	},
	laneSafe: function (n, yc) {
		const half = Sim.hole.r;
		const sc = this.scratch;
		for (let j = 0; j < n; j++) {
			const t = sc.t[j];
			if (t > this.tune.horizon) continue;
			if (Math.abs(sc.y[j] - yc) > half) continue;
			const useful = this.crossUseful(j);
			if (this.plan.defend) {
				if (useful) return false;
				continue;
			}
			if (!useful) return false;
		}
		return true;
	},
	aim: function (id) {
		const p = Players.list[id];
		if (!p || !p.task) return false;
		const prevY = this.state.aimed[id] ? this.state.targetY[id] : -1;
		this.state.aimed[id] = 0;
		if (!this.planOpen(id)) return false;
		const task = p.task;
		const n = this.predict(task.category, task.side === 'left');
		if (!n) return false;
		let best = 0;
		let bestY = 0;
		const sc = this.scratch;
		for (let k = 0; k < n; k++) {
			const yc = sc.y[k];
			const score = this.laneScore(n, yc);
			if (score <= best) continue;
			best = score;
			bestY = yc;
		}
		if (prevY >= 0 && this.laneSafe(n, prevY) && Math.abs(prevY - Sim.hole.y) <= this.deadZone()) {
			this.state.targetY[id] = prevY;
			this.state.aimed[id] = 1;
			return true;
		}
		if (prevY >= 0) {
			const held = this.laneScore(n, prevY) + this.tune.switchLane;
			if (held >= best && held > 0) {
				bestY = prevY;
				best = held;
			}
		}
		if (best <= 0) return false;
		this.state.targetY[id] = bestY;
		this.state.aimed[id] = 1;
		return true;
	},
	act: function (id, priority) {
		const p = Players.list[id];
		if (!p || !p.isBot) return;
		const share = p.energyMax > 0 ? p.energy / p.energyMax : 0;
		if (this.state.rest[id]) {
			if (share >= this.tune.resume) this.state.rest[id] = 0;
		} else if (share <= this.tune.rest) {
			this.state.rest[id] = 1;
		}
		if (this.state.rest[id] || !this.state.aimed[id] || (priority >= 0 && priority !== id)) {
			p.active = false;
			return;
		}
		const delta = this.state.targetY[id] - Sim.hole.y;
		const dead = this.deadZone();
		if (delta > -dead && delta < dead) {
			p.active = false;
			return;
		}
		p.force = (delta < 0 ? -1 : 1) * (this.tune.mag * Players.FMAX);
		p.active = true;
	},
		step: function (dt) {
			this.state.clock += dt;
			for (let id = 0; id < Players.list.length; id++) {
				if (Players.list[id].isBot) this.think(id, dt);
			}
			const priority = this.contest();
			for (let id = 0; id < Players.list.length; id++) {
				if (Players.list[id].isBot) this.act(id, priority);
			}
		},
		// main-style aliases
		botInit: function () { this.init(); },
		botStep: function (dt) { this.step(dt); },
		botAim: function (id) { return this.aim(id); },
		botAct: function (id, priority) { this.act(id, priority); },
		botContest: function () { return this.contest(); },
		botThink: function (id, dt) { this.think(id, dt); },
		botPredict: function (cat, isLeft) { return this.predict(cat, isLeft); },
		botCrossTime: function (b) { return this.crossTime(b); },
		botFoldY: function (y, vy, t, r) { return this.foldY(y, vy, t, r); },
		botLaneScore: function (n, yc) { return this.laneScore(n, yc); },
		botCrossUseful: function (j) { return this.crossUseful(j); },
		botWantsHole: function (id) { return this.wantsHole(id); },
		botState: null,
		botTune: null,
		botScratch: null,
		botPlan: null,
		botPlanOut: null
	};

// compatibility aliases
var bot = Bot;
function botInit() { Bot.init(); }
function botStep(dt) { Bot.step(dt); }
function botAim(id) { return Bot.aim(id); }
function botAct(id, priority) { Bot.act(id, priority); }
function botContest() { return Bot.contest(); }
function botPlanOpen(id) { return Bot.planOpen(id); }
function botPredict(cat, isLeft) { return Bot.predict(cat, isLeft); }
function botCrossTime(b) { return Bot.crossTime(b); }
function botFoldY(y, vy, t, r) { return Bot.foldY(y, vy, t, r); }
function botLaneScore(n, yc) { return Bot.laneScore(n, yc); }
function botCrossUseful(j) { return Bot.crossUseful(j); }
function botWantsHole(id) { return Bot.wantsHole(id); }

if (typeof module !== 'undefined' && module.exports) module.exports = Bot;
Bot.state = Bot.state;
Bot.tune = Bot.tune;
Bot.scratch = Bot.scratch;
Bot.plan = Bot.plan;
Bot.planOut = Bot.planOut;
Bot.botState = Bot.state;
Bot.botTune = Bot.tune;
Bot.botScratch = Bot.scratch;
Bot.botPlan = Bot.plan;
Bot.botPlanOut = Bot.planOut;
Bot.BOT_THINK_SEC = Bot.BOT_THINK_SEC;
Bot.BOT_AIM_HORIZON = Bot.BOT_AIM_HORIZON;
Bot.BOT_CROSS_SEC = Bot.BOT_CROSS_SEC;
Bot.BOT_MAG = Bot.BOT_MAG;
Bot.BOT_REST_SHARE = Bot.BOT_REST_SHARE;
Bot.BOT_RESUME_SHARE = Bot.BOT_RESUME_SHARE;
Bot.BOT_CONTEST_SEC = Bot.BOT_CONTEST_SEC;
Bot.BOT_DWELL_SEC = Bot.BOT_DWELL_SEC;
