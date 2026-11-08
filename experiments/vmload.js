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
	const ctx2d = new Proxy({}, {
		get(t, k) { return k in t ? t[k] : noop; },
		set(t, k, v) { t[k] = v; return true; }
	});
	const els = {
		app: { style: {}, addEventListener: noop },
		canv: {
			style: {}, width: 0, height: 0, clientWidth: 1200, clientHeight: 800,
			addEventListener: noop,
			getContext: () => ctx2d,
			getBoundingClientRect() {
				return { top: 0, left: 0, width: els.canv.clientWidth, height: els.canv.clientHeight };
			}
		}
	};
	const sandbox = {
		document: { getElementById: id => els[id] || null },
		window: win,
		requestAnimationFrame: noop,
		console
	};
	return { sandbox, stubs: { els, win, listeners } };
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
