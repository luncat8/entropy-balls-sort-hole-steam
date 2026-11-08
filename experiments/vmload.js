// owns: node vm loader that runs the page scripts in one shared context
// edit for: dom stubs, script discovery

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const noop = () => {};

function makeStubs() {
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
		return Object.assign({
			listeners: handlers,
			addEventListener(type, fn) {
				(handlers[type] = handlers[type] || []).push(fn);
			},
			dispatch(type) {
				for (const fn of handlers[type] || []) fn({ target: this, currentTarget: this });
			}
		}, properties);
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
		'task-strip': element({ textContent: '' })
	};
	const sandbox = {
		document: { getElementById: id => els[id] || null },
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
	return { apis, stubs };
}

module.exports = { loadGame };
