// owns: node vm loader that runs the page scripts in one shared context
// edit for: dom stubs, script discovery

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};

function makeStubs() {
	// the goal-view label is a single text field; a plain element is enough for it
	const listeners = {};
	const documentListeners = {};
	const win = {
		devicePixelRatio: 1,
		location: new URL('http://game.test/index.html'),
		matchMedia() { return { matches: false, addEventListener: noop }; },
		localStorage: { getItem() { return null; }, setItem: noop },
		addEventListener(type, fn) {
			(listeners[type] = listeners[type] || []).push(fn);
		}
	};
	win.history = {
		state: null,
		replaceState(state, title, href) { win.location = new URL(href); }
	};
	const calls = [];
	const ctx2d = new Proxy({ calls }, {
		get(t, k) {
			if (k in t) return t[k];
			return (...args) => calls.push({
				method: k,
				args,
				globalAlpha: t.globalAlpha,
				fillStyle: t.fillStyle,
				strokeStyle: t.strokeStyle,
				lineDashOffset: t.lineDashOffset
			});
		},
		set(t, k, v) { t[k] = v; return true; }
	});
	function element(properties) {
		const handlers = {};
		const captures = new Set();
		const node = {
			children: [],
			attributes: {},
			style: { setProperty(k, v) { this[k] = v; } },
			setAttribute(name, value) { this.attributes[name] = String(value); },
			getAttribute(name) { return this.attributes[name] || null; },
			focus() {},
			select() {},
			getBoundingClientRect() { return { top: 0, left: 0, width: 40, height: 146 }; },
			append(...nodes) {
				for (const n of nodes) {
					// the dom empties a fragment into the parent instead of nesting it
					if (n.isFragment) {
						for (const child of n.children) {
							node.children.push(child);
							child.parentNode = node;
						}
						n.children.length = 0;
						continue;
					}
					node.children.push(n);
					n.parentNode = node;
				}
			},
			querySelector(selector) {
				if (selector[0] === '.') {
					const cls = selector.slice(1);
					return node.children.find(c => String(c.className).split(' ').includes(cls)) || null;
				}
				const field = /^\[data-field="([^"]+)"\]$/.exec(selector);
				if (!field) return null;
				for (const child of node.children) if (child['data-field'] === field[1]) return child;
				return node.fields[field[1]] || (node.fields[field[1]] = element({}));
			},
			querySelectorAll(selector) {
				if (selector === 'input') return node.inputs || [];
				return [];
			},
			addEventListener(type, fn) {
				(handlers[type] = handlers[type] || []).push(fn);
			},
			dispatch(type, event) {
				const e = Object.assign({
					type, target: node, currentTarget: node, defaultPrevented: false,
					preventDefault() { this.defaultPrevented = true; }
				}, event);
				for (const fn of handlers[type] || []) fn.call(node, e);
				return e;
			},
			fields: {},
			className: '',
			setPointerCapture(id) { captures.add(id); },
			hasPointerCapture(id) { return captures.has(id); },
			releasePointerCapture(id) { captures.delete(id); },
			hidden: false,
			get textContent() { return node._text || ''; },
			set textContent(v) {
				node._text = v;
				if (v === '') node.children.length = 0;
			}
		};
		Object.defineProperty(node, 'firstElementChild', {
			get() { return node.children[0] || null; }
		});
		Object.defineProperty(node, 'childElementCount', {
			get() { return node.children.length; }
		});
		Object.defineProperty(node, 'parentNode', {
			get() { return node._parent || null; },
			set(v) { node._parent = v; }
		});
		return Object.assign(node, properties);
	}
	// mirrors the panel markup in index.html: swatch, title, detail, dots
	function questPanel() {
		const panel = element({ hidden: true });
		panel.append(
			element({ className: 'quest-panel-swatch' }),
			element({ className: 'quest-panel-title', 'data-field': 'title' }),
			element({ className: 'quest-panel-detail', 'data-field': 'detail' }),
			element({ className: 'quest-panel-dots', 'data-field': 'dots' })
		);
		return panel;
	}
	const els = {
		app: element({ style: {} }),
		canv: element({
			style: {}, width: 0, height: 0, clientWidth: 1200, clientHeight: 800,
			getContext: () => ctx2d,
			getBoundingClientRect() {
				return { top: 0, left: 0, width: els.canv.clientWidth, height: els.canv.clientHeight };
			}
		}),
		'draw-predicted-position': element({ checked: false }),
		'draw-trajectory-lines': element({ checked: false }),
		'draw-pass-lines': element({ checked: false }),
		'draw-prototype-dash': element({ checked: true }),
		'draw-slow-fade-hit-spot': element({ checked: true }),
		'force-panels': element({}),
		'settings-panel': element({ open: false }),
		'drawer-toggle': element({}),
		'drawer-backdrop': element({ hidden: true }),
		'settings-mode': element({ value: 'standard' }),
		'settings-rooms': element({ checked: false }),
		'settings-generation': element({ value: '100' }),
		'settings-generation-value': element({}),
		'settings-copy-link': element({}),
		'settings-friction': element({ checked: false }),
		'settings-humans': element({ checked: false }),
		'settings-balls': element({ value: '24' }),
		'settings-ball-speed': element({ value: '175' }),
		'settings-ball-size': element({ value: '14' }),
		'settings-ball-varied': element({ checked: true }),
		'settings-collisions': element({ checked: true }),
		'settings-balls-value': element({ textContent: '24' }),
		'settings-ball-speed-value': element({ textContent: '175 px/s' }),
		'settings-ball-size-value': element({ textContent: '14 px' }),
		'settings-hole-size': element({ value: '113' }),
		'settings-hole-speed': element({ value: '700' }),
		'settings-energy-cost': element({ value: '25' }),
		'settings-energy-store': element({ value: '100' }),
		'settings-hole-size-value': element({ textContent: '113 px' }),
		'settings-hole-speed-value': element({ textContent: '700 px/s' }),
		'settings-energy-cost-value': element({ textContent: '25/s' }),
		'settings-energy-store-value': element({ textContent: '100' }),
		'game-status-state': element({}),
		'mode-help': element({ hidden: true }),
		'territory-hud': element({ hidden: true }),
		'gun-hud': element({ hidden: true }),
		'territory-share-0': element({}),
		'territory-balls-0': element({}),
		'territory-share-1': element({}),
		'territory-balls-1': element({}),
		'territory-force-0': element({}),
		'territory-energy-0': element({}),
		'territory-force-1': element({}),
		'territory-energy-1': element({}),
		'territory-stored-0': element({}),
		'territory-stored-1': element({}),
		'gun-target': element({}),
		'gun-stored': element({}),
		'gun-push': element({}),
		'gun-state': element({}),
		'gun-force': element({}),
		'gun-energy': element({}),
		'gun-energy-bar': element({ style: {} }),
		'game-status-player-0': element({}),
		'game-status-player-1': element({ hidden: true }),
		'game-status-control-0': element({}),
		'game-status-control-1': element({}),
		'score-rows': element({}),
		'score-mode': element({ textContent: '' }),
		'score-restart': element({}),
		'settings-url-wrap': element({ hidden: true }),
		'settings-url': element({ value: '' }),
		'task-list': element({}),
		'quest-panel': questPanel(),
		'quest-goal': element({ hidden: true, textContent: '' }),
		'preview-mode': element({ inputs: [] })
	};
	// each radio sits in its own label, which carries that option's sample
	for (const mode of ['mean', 'range', 'smooth']) {
		const radio = element({ value: mode, checked: mode === 'smooth' });
		const label = element({});
		label.append(radio);
		label.parentNode = els['preview-mode'];
		els['preview-mode'].inputs.push(radio);
	}
	const sandbox = {
		document: {
			hidden: false,
			body: element({ dataset: {} }),
			getElementById: id => els[id] || null,
			createElement: tag => element({ tagName: tag.toUpperCase() }),
			createDocumentFragment: () => element({ tagName: '#fragment', isFragment: true }),
			addEventListener(type, fn) { (documentListeners[type] = documentListeners[type] || []).push(fn); }
		},
		window: win,
		URL,
		URLSearchParams,
		Math,
		ResizeObserver: class { observe() {} },
		requestAnimationFrame: noop,
		console
	};
	return { sandbox, stubs: { els, win, listeners, documentListeners, ctx2d } };
}

// scripts run in one context like the browser; the module stub collects each file's export guard
function loadGame(rootDir) {
	const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
	const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
	const { sandbox, stubs } = makeStubs();
	const ctx = vm.createContext(sandbox);
	const apis = {};
	for (const src of srcs) {
		sandbox.module = { exports: {} };
		vm.runInContext(fs.readFileSync(path.join(rootDir, src), 'utf8'), ctx, { filename: src });
		apis[src] = sandbox.module.exports;
	}
	return { apis, stubs, ctx, document: sandbox.document };
}

module.exports = { loadGame };
