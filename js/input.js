// owns: pointer, touch, wheel input
// edit for: drag, activation, force wheel
var Input = {
	dragging: false,
	init: function () {
		const c = Sim.canvas;
		c.addEventListener('pointerdown', (e) => {
			if (e.button !== 0) return;
			Sim.hole.targetY = e.clientY;
			if (Players.list[0].force !== 0) {
				Players.list[0].active = true;
			} else {
				Input.dragging = true;
			}
		});
		window.addEventListener('pointermove', (e) => {
			if (Input.dragging || Players.list[0].active) Sim.hole.targetY = e.clientY;
		});
		window.addEventListener('pointerup', () => {
			Input.dragging = false;
			Players.list[0].active = false;
		});
		c.addEventListener('contextmenu', (e) => e.preventDefault());
		c.addEventListener('mousedown', (e) => {
			if (e.button === 2) Players.list[1].active = true;
		});
		window.addEventListener('mouseup', (e) => {
			if (e.button === 2) Players.list[1].active = false;
		});
		c.addEventListener('wheel', (e) => {
			Players.list[0].force = clamp(Players.list[0].force - e.deltaY * 0.5, -Players.FMAX, Players.FMAX);
			Settings.force0 = Players.list[0].force;
			const sl = document.querySelector('input[data-key="force0"]');
			if (sl) sl.value = Settings.force0;
			const v = document.querySelector('[data-val="force0"]');
			if (v) v.textContent = Settings.force0;
			e.preventDefault();
		}, { passive: false });
		// touch
		c.addEventListener('touchstart', (e) => {
			for (let i = 0; i < e.touches.length; i++) {
				const t = e.touches[i];
				if (t.clientX < Sim.W / 2) {
					if (Players.list[0].force !== 0) Players.list[0].active = true;
					else Input.dragging = true;
				} else {
					if (Players.list[1].force !== 0) Players.list[1].active = true;
					else Input.dragging = true;
				}
			}
			if (e.touches[0]) Sim.hole.targetY = e.touches[0].clientY;
			e.preventDefault();
		}, { passive: false });
		c.addEventListener('touchmove', (e) => {
			if (e.touches[0]) Sim.hole.targetY = e.touches[0].clientY;
			e.preventDefault();
		}, { passive: false });
		c.addEventListener('touchend', () => {
			Players.list[0].active = false;
			Players.list[1].active = false;
		});
	}
};
if (typeof module !== 'undefined' && module.exports) module.exports = Input;
