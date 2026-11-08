// owns: players, energy, force application, bots
// edit for: energy rules, bot behavior
var Players = {
	list: [
		{ id: 0, isBot: false, force: 0, active: false, energy: 100, energyMax: 100, recharge: 5, solvedCount: 0, task: null, holdTime: 0 },
		{ id: 1, isBot: true, force: 0, active: false, energy: 100, energyMax: 100, recharge: 5, solvedCount: 0, task: null, holdTime: 0 }
	],
	holeMass: 1,
	FMAX: 400,
	init: function () {
		this.list[0].energyMax = Settings.storage;
		this.list[1].energyMax = Settings.storage;
		this.list[0].energy = Settings.storage;
		this.list[1].energy = Settings.storage;
		this.list[0].isBot = Settings.bot0;
		this.list[1].isBot = Settings.bot1;
		this.list[0].force = Settings.force0;
		this.list[1].force = Settings.force1;
	},
	botStep: function (p) {
		const desiredY = (p.task && p.task.side === 'left') ? Sim.H * 0.35 : Sim.H * 0.65;
		p.force = clamp((desiredY - Sim.hole.y) * 3, -this.FMAX, this.FMAX);
		p.active = p.energy > 0.05 * p.energyMax;
	},
	update: function (DT) {
		for (let i = 0; i < this.list.length; i++) {
			const p = this.list[i];
			p.energy = Math.min(p.energyMax, p.energy + p.recharge * DT);
		}
		if (typeof Bot !== 'undefined') {
			for (let i = 0; i < this.list.length; i++) if (this.list[i].isBot) Bot.think(i, DT);
			const priority = (typeof Bot.contest === 'function') ? Bot.contest() : -1;
			for (let i = 0; i < this.list.length; i++) if (this.list[i].isBot) Bot.act(i, priority);
		} else {
			for (let i = 0; i < this.list.length; i++) {
				const p = this.list[i];
				if (p.isBot) this.botStep(p);
			}
		}
		// drag has priority
		if (Input.dragging) {
			Sim.hole.vy = 0;
			const step = clamp(Sim.hole.targetY - Sim.hole.y, -Settings.holeMaxSpeed * DT, Settings.holeMaxSpeed * DT);
			Sim.hole.y += step;
			Sim.hole.y = clamp(Sim.hole.y, Sim.hole.r, Sim.H - Sim.hole.r);
			Sim.hole.targetY = clamp(Sim.hole.targetY, Sim.hole.r, Sim.H - Sim.hole.r);
		} else {
			// effective forces with energy cost
			let netForce = 0;
			let anyActive = false;
			for (let i = 0; i < this.list.length; i++) {
				const p = this.list[i];
				if (!p.active) continue;
				anyActive = true;
				const cost = Math.abs(p.force) * Settings.holeMoveEnergyCost * DT;
				let f = p.force;
				if (cost > 0 && p.energy < cost) {
					f = Math.sign(f) * p.energy / (Settings.holeMoveEnergyCost * DT);
					p.energy = 0;
				} else {
					p.energy -= cost;
				}
				netForce += f;
			}
			if (anyActive) {
				Sim.hole.vy += (netForce / this.holeMass) * DT;
				const max = Settings.holeMaxSpeed;
				if (Sim.hole.vy > max) Sim.hole.vy = max;
				if (Sim.hole.vy < -max) Sim.hole.vy = -max;
				Sim.hole.y += Sim.hole.vy * DT;
				Sim.hole.targetY = Sim.hole.y;
			} else {
				Sim.hole.vy = 0;
				const step = clamp(Sim.hole.targetY - Sim.hole.y, -Settings.holeMaxSpeed * DT, Settings.holeMaxSpeed * DT);
				Sim.hole.y += step;
			}
			Sim.hole.y = clamp(Sim.hole.y, Sim.hole.r, Sim.H - Sim.hole.r);
			Sim.hole.targetY = clamp(Sim.hole.targetY, Sim.hole.r, Sim.H - Sim.hole.r);
		}
		// tasks
		for (let i = 0; i < this.list.length; i++) {
			const avoid = [];
			for (let j = 0; j < this.list.length; j++) if (j !== i && this.list[j].task) avoid.push(this.list[j].task);
			TaskGen.updatePlayer(this.list[i], DT, avoid);
		}
	}
};
if (typeof module !== 'undefined' && module.exports) module.exports = Players;
