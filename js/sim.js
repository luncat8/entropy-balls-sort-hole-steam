// owns: physics state, ball step, collision, spots
// edit for: movement rules, collision, spawn
var Sim = {
	canvas: null,
	ctx: null,
	W: 0,
	H: 0,
	CX: 0,
	DT: 1 / 60,
	MAX_BALLS: 200,
	balls: [],
	ballCount: 0,
	hole: { x: 0, y: 0, vy: 0, targetY: 0, r: 48 },
	spots: [],
	prevHoleY: 0,
	spotIndex: 0,
	MAX_SPOTS: 256,
	spawnTimer: 0,
	COLORS: ['#4ea8de', '#56cfe1', '#48bfe3', '#ff6b6b', '#ff9f1c', '#ffd60a'],
	init: function () {
		this.canvas = document.getElementById('c');
		this.ctx = this.canvas.getContext('2d');
		this.spots = new Array(this.MAX_SPOTS);
		for (let i = 0; i < this.MAX_SPOTS; i++) this.spots[i] = { y: 0, color: '', age: 999, active: false };
		this.balls = new Array(this.MAX_BALLS);
		for (let i = 0; i < this.MAX_BALLS; i++) this.balls[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, r: 8, color: '', colorIndex: 0 };
		this.resize();
		this.prevHoleY = this.hole.y;
		window.addEventListener('resize', this.resize.bind(this));
	},
	resize: function () {
		const dpr = window.devicePixelRatio || 1;
		this.W = window.innerWidth;
		this.H = window.innerHeight;
		this.canvas.width = this.W * dpr;
		this.canvas.height = this.H * dpr;
		this.canvas.style.width = this.W + 'px';
		this.canvas.style.height = this.H + 'px';
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.CX = this.W / 2;
		if (!this.hole.y) this.hole.y = this.H / 2;
		this.hole.targetY = this.hole.y;
		this.hole.y = clamp(this.hole.y, this.hole.r, this.H - this.hole.r);
	},
	countSide: function (side) {
		let n = 0;
		for (let i = 0; i < this.MAX_BALLS; i++) {
			const b = this.balls[i];
			if (!b.active) continue;
			if (side === 'left' && b.x < this.CX) n++;
			if (side === 'right' && b.x >= this.CX) n++;
		}
		return n;
	},
	spawnBall: function () {
		let slot = -1;
		for (let i = 0; i < this.MAX_BALLS; i++) if (!this.balls[i].active) { slot = i; break; }
		if (slot < 0) return false;
		const b = this.balls[slot];
		b.active = true;
		b.r = Settings.ballSizeRandom ? (Settings.ballSize * (0.6 + Math.random() * 0.8)) : Settings.ballSize;
		b.colorIndex = Math.floor(Math.random() * 6);
		b.color = this.COLORS[b.colorIndex];
		const leftCount = this.countSide('left');
		const side = leftCount <= (this.ballCount - leftCount) ? 0 : 1;
		if (side === 0) b.x = b.r + Math.random() * (this.CX - b.r * 2 - 8);
		else b.x = this.CX + 8 + Math.random() * (this.W - this.CX - b.r * 2 - 8);
		b.y = b.r + Math.random() * (this.H - b.r * 2);
		const a = Math.random() * Math.PI * 2;
		b.vx = Math.cos(a) * Settings.ballSpeed;
		b.vy = Math.sin(a) * Settings.ballSpeed;
		this.ballCount++;
		return true;
	},
	deactivateExcess: function (target) {
		while (this.ballCount > target) {
			for (let i = this.MAX_BALLS - 1; i >= 0; i--) {
				if (this.balls[i].active) { this.balls[i].active = false; this.ballCount--; break; }
			}
		}
	},
	ensureCount: function (target) {
		while (this.ballCount < target) if (!this.spawnBall()) break;
		if (this.ballCount > target) this.deactivateExcess(target);
	},
	stepBalls: function (DT) {
		this.hole.r = clamp(Settings.holeSize, 16, this.H / 2 - 16);
		if (Settings.generation > 0) {
			this.spawnTimer += DT;
			const interval = 1 / Settings.generation;
			while (this.spawnTimer >= interval && this.ballCount < Settings.ballCount) {
				this.spawnTimer -= interval;
				this.spawnBall();
			}
		}
		const holeTop = this.hole.y - this.hole.r;
		const holeBottom = this.hole.y + this.hole.r;
		for (let i = 0; i < this.MAX_BALLS; i++) {
			const b = this.balls[i];
			if (!b.active) continue;
			const prevX = b.x;
			let vx = b.vx;
			let vy = b.vy;
			const maxV = b.r / DT;
			if (Math.abs(vx) > maxV) vx = (vx < 0 ? -1 : 1) * maxV;
			if (Math.abs(vy) > maxV) vy = (vy < 0 ? -1 : 1) * maxV;
			b.x += vx * DT;
			b.y += vy * DT;
			if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
			if (b.x > this.W - b.r) { b.x = this.W - b.r; b.vx = -Math.abs(b.vx); }
			if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
			if (b.y > this.H - b.r) { b.y = this.H - b.r; b.vy = -Math.abs(b.vy); }
			if (prevX < this.CX && b.x >= this.CX) {
				if (!(b.y > holeTop && b.y < holeBottom)) {
					b.x = 2 * this.CX - b.x;
					b.vx = -b.vx;
					this.addSpot(b.y, b.color);
				}
			} else if (prevX > this.CX && b.x <= this.CX) {
				if (!(b.y > holeTop && b.y < holeBottom)) {
					b.x = 2 * this.CX - b.x;
					b.vx = -b.vx;
					this.addSpot(b.y, b.color);
				}
			}
		}
		if (Settings.ballCollisions) this.collideBalls();
	},
	collideBalls: function () {
		for (let i = 0; i < this.MAX_BALLS; i++) {
			const a = this.balls[i];
			if (!a.active) continue;
			for (let j = i + 1; j < this.MAX_BALLS; j++) {
				const b = this.balls[j];
				if (!b.active) continue;
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const rr = a.r + b.r;
				const d2 = dx * dx + dy * dy;
				if (d2 <= 0 || d2 >= rr * rr) continue;
				const d = Math.sqrt(d2);
				const nx = dx / d;
				const ny = dy / d;
				const overlap = (rr - d) / 2;
				a.x -= nx * overlap;
				a.y -= ny * overlap;
				b.x += nx * overlap;
				b.y += ny * overlap;
				const dvx = a.vx - b.vx;
				const dvy = a.vy - b.vy;
				const dot = dvx * nx + dvy * ny;
				if (dot < 0) {
					a.vx -= dot * nx;
					a.vy -= dot * ny;
					b.vx += dot * nx;
					b.vy += dot * ny;
				}
			}
		}
	},
	addSpot: function (y, color) {
		const s = this.spots[this.spotIndex];
		s.y = y;
		s.color = color;
		s.age = 0;
		s.active = true;
		this.spotIndex = (this.spotIndex + 1) % this.MAX_SPOTS;
	},
	updateSpots: function (DT) {
		if (Math.abs(this.hole.y - this.prevHoleY) > this.hole.r) {
			for (let i = 0; i < this.MAX_SPOTS; i++) this.spots[i].active = false;
		}
		this.prevHoleY = this.hole.y;
		for (let i = 0; i < this.MAX_SPOTS; i++) {
			const s = this.spots[i];
			if (s.active) {
				s.age += DT;
				if (s.age > 2) s.active = false;
			}
		}
	}
};
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
