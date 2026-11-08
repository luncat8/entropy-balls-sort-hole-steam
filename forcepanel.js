// owns: per-participant force panels and energy/usage presentation
// edit for: panel layout, accessible readouts and bot request display

const forcePanels = { root: null, rows: [] };

function forcePanelElement(tag, className, text) {
	const el = document.createElement(tag);
	if (className) el.className = className;
	if (text !== undefined) el.textContent = text;
	return el;
}

function forcePanelInit() {
	forcePanels.root = $('force-panels');
	forcePanelRebuild();
}

function forcePanelMatchesPlayers() {
	if (forcePanels.rows.length !== players.count) return false;
	for (let id = 0; id < players.count; id++) {
		const row = forcePanels.rows[id];
		if (row.type !== players.type[id] || row.controlled !== inputControls(id)) return false;
	}
	return true;
}

function forcePanelRebuild() {
	if (!forcePanels.root) return;
	inputPreparePanels();
	forcePanels.root.textContent = '';
	forcePanels.rows.length = 0;
	const frag = document.createDocumentFragment();
	for (let id = 0; id < players.count; id++) frag.append(forcePanelBuild(id));
	forcePanels.root.append(frag);
}

function forcePanelBuild(id) {
	const type = players.type[id];
	const bot = type === PLAYER_BOT;
	const panel = forcePanelElement('section', 'force-panel');
	panel.setAttribute('aria-label', 'Player ' + (id + 1) + ' force');
	const header = forcePanelElement('div', 'force-panel-header');
	const player = forcePanelElement('span', 'force-player', 'Player ' + (id + 1));
	const kind = forcePanelElement('span', 'force-kind', bot ? 'Bot' : 'Human');
	header.append(player, kind);
	const status = forcePanelElement('div', 'force-status', 'No force');

	const body = forcePanelElement('div', 'force-panel-body');
	const axis = forcePanelElement('div', 'force-axis');
	const axisTitle = forcePanelElement('div', 'force-column-title', 'Force');
	const scale = forcePanelElement('div', 'force-scale');
	const labels = forcePanelElement('div', 'force-scale-labels');
	labels.append(forcePanelElement('span', '', '↑ UP'), forcePanelElement('span', 'force-zero-label', '0'),
		forcePanelElement('span', '', '↓ DOWN'));
	const shell = forcePanelElement('div', 'force-slider-shell');
	const rail = forcePanelElement('div', 'force-slider-rail');
	const thumb = forcePanelElement('span', 'force-slider-thumb');
	rail.append(thumb);
	const slider = forcePanelElement('input', 'force-slider');
	slider.type = 'range';
	slider.min = '-100';
	slider.max = '100';
	slider.step = '5';
	slider.setAttribute('aria-label', 'Player ' + (id + 1) + ' force');
	slider.setAttribute('aria-orientation', 'vertical');
	shell.append(rail, slider);
	scale.append(labels, shell);
	const selected = forcePanelElement('div', 'force-selected');
	axis.append(axisTitle, scale, selected);

	const energy = forcePanelElement('div', 'force-energy');
	const energyTitle = forcePanelElement('div', 'force-column-title', 'Energy');
	const energyBody = forcePanelElement('div', 'force-energy-body');
	const meter = forcePanelElement('div', 'force-meter');
	meter.setAttribute('role', 'meter');
	meter.setAttribute('aria-label', 'Player ' + (id + 1) + ' energy');
	meter.setAttribute('aria-valuemin', '0');
	meter.title = 'Blue is stored energy. Red previews the gross cost of a two-second hold, capped at stored energy. Energy also recharges.';
	const fill = forcePanelElement('span', 'force-meter-fill');
	const usage = forcePanelElement('span', 'force-meter-use');
	meter.append(fill, usage);
	const numbers = forcePanelElement('div', 'force-energy-numbers');
	const energyNumber = forcePanelElement('span', 'force-energy-number');
	const energyCapacity = forcePanelElement('span', 'force-energy-capacity');
	const costLabel = forcePanelElement('span', 'force-cost-label', '2s hold');
	const cost = forcePanelElement('span', 'force-cost');
	numbers.append(energyNumber, energyCapacity, costLabel, cost);
	energyBody.append(meter, numbers);
	energy.append(energyTitle, energyBody);
	body.append(axis, energy);
	const help = forcePanelElement('div', 'force-help');
	help.id = 'force-help-' + id;
	slider.setAttribute('aria-describedby', help.id);
	panel.append(header, status, body, help);

	const row = {
		type, panel, slider, thumb, selected, status, meter, fill, usage, energyNumber, energyCapacity, cost,
		controlled: false, value: null, shownEnergy: -1, shownCapacity: -1, shownShare: -1,
		shownUsage: -1, shownCost: -1, shownStatus: ''
	};
	forcePanels.rows.push(row);
	row.controlled = inputBindPanel(id, panel, slider);
	slider.disabled = !row.controlled;
	panel.setAttribute('data-hint', row.controlled ? 'Hold to move' : 'Read only');
	help.textContent = row.controlled ? 'Hold slider or field · scroll / ↑↓ to adjust · hold Space'
		: (bot ? 'Bot control · read only' : 'Read only');
	forcePanelSetValue(id, row.controlled ? inputValue() : 0);
	return panel;
}

function forcePanelSetValue(id, value) {
	const row = forcePanels.rows[id];
	if (!row || row.value === value) return;
	row.value = value;
	row.slider.value = String(value);
	row.thumb.style.top = ((value + 100) / 2) + '%';
	const text = value === 0 ? 'Zero' : (value < 0 ? 'Up ' : 'Down ') + Math.abs(value) + '%';
	row.slider.setAttribute('aria-valuetext', text);
	row.selected.textContent = value === 0 ? 'Zero selected' : (value < 0 ? '↑ ' : '↓ ') + Math.abs(value) + '% selected';
}

function forcePanelStatus(view, paused) {
	if (!view.held) return 'No force';
	if (paused) return 'Preview paused';
	if (view.dir === 0 || view.mag === 0) return 'Zero force';
	const arrow = view.dir < 0 ? '↑ ' : '↓ ';
	return 'Applying ' + arrow + Math.round(Math.abs(view.applied) * 100) + '%';
}

function forcePanelPaintRow(id, paused) {
	const row = forcePanels.rows[id];
	const view = forceView(id);
	if (!row.controlled) forcePanelSetValue(id, view.dir * Math.round(view.mag * 100));
	const status = forcePanelStatus(view, paused);
	if (status !== row.shownStatus) {
		row.shownStatus = status;
		row.status.textContent = status;
		row.status.setAttribute('data-active', view.held && !paused && view.dir !== 0 ? 'true' : 'false');
	}
	const energy = Math.round(view.energy);
	const capacity = Math.round(view.capacity);
	const cost = Math.round(view.cost2s * 10) / 10;
	if (energy !== row.shownEnergy || capacity !== row.shownCapacity || cost !== row.shownCost) {
		row.shownEnergy = energy;
		row.shownCapacity = capacity;
		row.energyNumber.textContent = String(energy);
		row.energyCapacity.textContent = '/ ' + capacity;
		row.meter.setAttribute('aria-valuenow', String(energy));
		row.meter.setAttribute('aria-valuemax', String(capacity));
		row.meter.setAttribute('aria-valuetext', energy + ' of ' + capacity + ' energy; ' + cost
			+ ' for a two-second hold before recharge');
	}
	const share = Math.round(view.share * 100);
	const usage = view.capacity > 0 ? Math.min(share, Math.round(view.cost2s / view.capacity * 100)) : 0;
	if (share !== row.shownShare || usage !== row.shownUsage) {
		row.shownShare = share;
		row.shownUsage = usage;
		row.fill.style.height = share + '%';
		row.usage.style.height = usage + '%';
		row.usage.style.bottom = (share - usage) + '%';
	}
	if (cost !== row.shownCost) {
		row.shownCost = cost;
		row.cost.textContent = cost ? '−' + cost : '0';
	}
}

function forcePanelPaint() {
	if (!forcePanelMatchesPlayers()) forcePanelRebuild();
	const paused = goalHolding();
	for (let id = 0; id < forcePanels.rows.length; id++) forcePanelPaintRow(id, paused);
}

if (typeof module !== 'undefined') module.exports = {
	forcePanels, forcePanelInit, forcePanelRebuild, forcePanelSetValue, forcePanelPaint
};
