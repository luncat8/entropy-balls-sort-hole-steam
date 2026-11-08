// owns: goal view drawn while a task is held
// edit for: goal layout, held state
var GoalView = {
	active: false,
	heldTask: null,
	ballCount: 0,
	x: null,
	y: null,
	r: null,
	color: null,
	moved: null,
	movedCount: 0,
	goalSide: 0,
	goalMatch: 0,
	labelEl: null,
	init: function () {
		this.x = new Float64Array(Sim.MAX_BALLS);
		this.y = new Float64Array(Sim.MAX_BALLS);
		this.r = new Float64Array(Sim.MAX_BALLS);
		this.color = new Array(Sim.MAX_BALLS);
		this.moved = new Uint8Array(Sim.MAX_BALLS);
		this.labelEl = document.getElementById('quest-goal');
	},
	open: function (task) {
		if (!task) return false;
		this.heldTask = task;
		this.active = this.build(task);
		if (this.labelEl) this.labelEl.hidden = !this.active;
		return this.active;
	},
	close: function () {
		this.active = false;
		this.heldTask = null;
		this.ballCount = 0;
		this.movedCount = 0;
		if (this.labelEl) {
			this.labelEl.hidden = true;
			this.labelEl.textContent = '';
		}
	},
	holding: function () { return this.active; },
	build: function (task) {
		const isLeft = task.side === 'left';
		const onSide = Sim.countSide(task.side);
		if (onSide === 0) {
			if (this.labelEl) this.labelEl.textContent = 'an empty side cannot meet an objective';
			return false;
		}
		const cat = task.category;
		const op = task.op === '>' ? '>' : '<';
		const pct = task.pct;
		const out = { side: 0, match: 0 };
		const cost = TaskGen.cheapest(cat, op, pct, isLeft, out);
		if (cost < 0) {
			if (this.labelEl) this.labelEl.textContent = 'this field cannot satisfy the objective';
			return false;
		}
		this.goalSide = out.side;
		this.goalMatch = out.match;
		const wantCat = out.match;
		const wantOther = out.side - out.match;
		const inNamed = new Uint8Array(Sim.MAX_BALLS);
		const keep = new Uint8Array(Sim.MAX_BALLS);
		for (let i = 0; i < Sim.MAX_BALLS; i++) {
			const b = Sim.balls[i];
			if (!b.active) continue;
			inNamed[i] = (b.x < Sim.CX) === isLeft ? 1 : 0;
			keep[i] = 0;
		}
		let wc = wantCat, wo = wantOther;
		for (let pass = 0; pass < 2; pass++) {
			for (let i = 0; i < Sim.MAX_BALLS; i++) {
				const b = Sim.balls[i];
				if (!b.active) continue;
				if (pass === 0 && !inNamed[i]) continue;
				if (pass === 1 && inNamed[i]) continue;
				const isCat = TaskGen.catHas(cat, b.colorIndex) === 1;
				if (isCat ? wc === 0 : wo === 0) continue;
				if (isCat) wc--; else wo--;
				keep[i] = 1;
			}
		}
		this.ballCount = Sim.ballCount;
		let idx = 0;
		this.movedCount = 0;
		for (let i = 0; i < Sim.MAX_BALLS; i++) {
			const b = Sim.balls[i];
			if (!b.active) continue;
			this.x[idx] = b.x;
			this.y[idx] = b.y;
			this.r[idx] = b.r;
			this.color[idx] = b.color;
			this.moved[idx] = 0;
			if (keep[i] !== inNamed[i]) {
				const movedLeft = keep[i] === 1 ? isLeft : !isLeft;
				let mx = 2 * Sim.CX - b.x;
				const r = b.r;
				if (movedLeft) {
					const lo = r;
					const hi = Sim.CX - 4 - r;
					if (mx < lo) mx = lo;
					if (mx > hi) mx = hi;
				} else {
					const lo = Sim.CX + 4 + r;
					const hi = Sim.W - r;
					if (mx < lo) mx = lo;
					if (mx > hi) mx = hi;
				}
				this.x[idx] = mx;
				this.moved[idx] = 1;
				this.movedCount++;
			}
			idx++;
		}
		// separate moved balls
		for (let pass = 0; pass < 6; pass++) {
			for (let i = 0; i < this.ballCount; i++) {
				if (!this.moved[i]) continue;
				for (let j = 0; j < this.ballCount; j++) {
					if (i === j) continue;
					let dx = this.x[i] - this.x[j];
					let dy = this.y[i] - this.y[j];
					const sum = this.r[i] + this.r[j];
					let d2 = dx * dx + dy * dy;
					if (d2 >= sum * sum) continue;
					if (d2 < 1e-6) { dx = 1; dy = 0; d2 = 1; }
					const d = Math.sqrt(d2);
					const gap = sum - d;
					this.x[i] += (dx / d) * gap;
					this.y[i] += (dy / d) * gap;
				}
				const r = this.r[i];
				let x = this.x[i];
				const isMovedLeft = x < Sim.CX;
				if (isMovedLeft) {
					const lo = r; const hi = Sim.CX - 4 - r;
					if (x < lo) x = lo; if (x > hi) x = hi;
				} else {
					const lo = Sim.CX + 4 + r; const hi = Sim.W - r;
					if (x < lo) x = lo; if (x > hi) x = hi;
				}
				this.x[i] = x;
				const y = this.y[i];
				if (y < r + 1) this.y[i] = r + 1;
				else if (y > Sim.H - r - 1) this.y[i] = Sim.H - r - 1;
			}
		}
		if (this.labelEl) {
			let text = task.side + ' ' + task.op + task.pct + '% ' + ((typeof task.category === 'string') ? task.category : task.category.color);
			text += ' · goal ' + out.match + '/' + out.side;
			text += this.movedCount ? ' · ' + this.movedCount + ' balls cross' : ' · already met';
			this.labelEl.textContent = text;
		}
		return true;
	}
};
function goalHolding() { return GoalView.active; }
function goalOpen(task) { return GoalView.open(task); }
function goalClose() { GoalView.close(); }
if (typeof module !== 'undefined' && module.exports) module.exports = GoalView;
