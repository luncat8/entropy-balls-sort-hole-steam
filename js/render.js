// owns: canvas rendering
// edit for: draw order, visual style
var Render = {
	ctx: null,
	init: function () { this.ctx = Sim.ctx; },
	draw: function () {
		const ctx = this.ctx;
		const W = Sim.W, H = Sim.H;
		const dark = Settings.darkTheme;
		const bg = dark ? '#0b0f14' : '#f1f5f9';
		const wall = dark ? '#cbd5e1' : '#334155';
		const frame = dark ? '#1f2937' : '#cbd5e1';
		ctx.clearRect(0, 0, W, H);
		ctx.fillStyle = bg;
		ctx.fillRect(0, 0, W, H);
		for (let i = 0; i < Sim.MAX_SPOTS; i++) {
			const s = Sim.spots[i];
			if (!s.active) continue;
			const alpha = Math.max(0, 1 - s.age / 2);
			ctx.globalAlpha = alpha * 0.6;
			ctx.fillStyle = s.color;
			ctx.beginPath();
			ctx.arc(Sim.CX, s.y, 3, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
		const useGoal = (typeof GoalView !== 'undefined') && GoalView.active;
		if (useGoal) {
			for (let i = 0; i < GoalView.ballCount; i++) {
				ctx.globalAlpha = GoalView.moved[i] ? 1 : 0.35;
				ctx.fillStyle = GoalView.color[i];
				ctx.beginPath();
				ctx.arc(GoalView.x[i], GoalView.y[i], GoalView.r[i], 0, Math.PI * 2);
				ctx.fill();
				if (GoalView.moved[i]) {
					ctx.globalAlpha = 1;
					ctx.strokeStyle = '#e2e8f0';
					ctx.lineWidth = 2;
					ctx.beginPath();
					ctx.arc(GoalView.x[i], GoalView.y[i], GoalView.r[i] + 2, 0, Math.PI * 2);
					ctx.stroke();
				}
			}
			ctx.globalAlpha = 1;
		} else {
			for (let i = 0; i < Sim.MAX_BALLS; i++) {
				const b = Sim.balls[i];
				if (!b.active) continue;
				ctx.fillStyle = b.color;
				ctx.beginPath();
				ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		if (!useGoal) for (let i = 0; i < Sim.MAX_BALLS; i++) {
			const b = Sim.balls[i];
			if (!b.active) continue;
			const toward = (b.x < Sim.CX && b.vx > 0) || (b.x > Sim.CX && b.vx < 0);
			if (!toward) continue;
			const t = (Sim.CX - b.x) / b.vx;
			const yHit = b.y + b.vy * t;
			const holeTop = Sim.hole.y - Sim.hole.r;
			const holeBottom = Sim.hole.y + Sim.hole.r;
			if (yHit > holeTop && yHit < holeBottom) continue;
			if (yHit < 0 || yHit > H) continue;
			ctx.strokeStyle = b.color;
			ctx.globalAlpha = 0.25;
			ctx.setLineDash([4, 4]);
			ctx.beginPath();
			ctx.moveTo(b.x, b.y);
			ctx.lineTo(Sim.CX, yHit);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.globalAlpha = 1;
			const my = Math.max(b.r, Math.min(H - b.r, yHit));
			ctx.fillStyle = b.color;
			ctx.beginPath();
			ctx.arc(Sim.CX, my, 3, 0, Math.PI * 2);
			ctx.fill();
		}
		const ht = Sim.hole.y - Sim.hole.r;
		const hb = Sim.hole.y + Sim.hole.r;
		ctx.fillStyle = wall;
		ctx.fillRect(Sim.CX - 2, 0, 4, ht);
		ctx.fillRect(Sim.CX - 2, hb, 4, H - hb);
		// hole highlight
		ctx.strokeStyle = 'rgba(120,200,255,0.35)';
		ctx.lineWidth = 2;
		ctx.strokeRect(Sim.CX - 6, ht, 12, hb - ht);
		// grip handle
		ctx.fillStyle = '#94a3b8';
		ctx.fillRect(Sim.CX - 6, Sim.hole.y - 8, 12, 16);
		ctx.strokeStyle = frame;
		ctx.lineWidth = 1;
		ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
	}
};
if (typeof module !== 'undefined' && module.exports) module.exports = Render;
