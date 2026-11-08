// owns: node vm loader that runs the page scripts in one shared context
// edit for: dom stubs, script discovery

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};

function makeStubs() {
	// the goal-view label is a single text field; a plain element is enough for it
	const listeners = {};
	const win = {
		devicePixelRatio: 1,
		addEventListener(type, fn) {
			(listeners[type] = listeners[type] || []).push(fn);
		}
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
				strokeStyle: t.strokeStyle
			});
		},
		set(t, k, v) { t[k] = v; return true; }
	});
	function element(properties) {
		const handlers = {};
		const node = {
			children: [],
			style: { setProperty(k, v) { this[k] = v; } },
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
				const e = Object.assign({ type, target: node, currentTarget: node, preventDefault() {} }, event);
				for (const fn of handlers[type] || []) fn.call(node, e);
			},
			fields: {},
			className: '',
			setPointerCapture() {},
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
		'draw-slow-fade-hit-spot': element({ checked: true }),
		'force-panel': element({}),
		'force-pad': element({ textContent: '' }),
		'force-mag': element({ value: '60' }),
		'force-push': element({ checked: true }),
		'force-pull': element({ checked: false }),
		'force-stores': element({}),
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
			getElementById: id => els[id] || null,
			createElement: tag => element({ tagName: tag.toUpperCase() }),
			createDocumentFragment: () => element({ tagName: '#fragment', isFragment: true })
		},
		window: win,
		requestAnimationFrame: noop,
		console
	};
	return { sandbox, stubs: { els, win, listeners, ctx2d } };
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
	return { apis, stubs, document: sandbox.document };
}

module.exports = { loadGame };
