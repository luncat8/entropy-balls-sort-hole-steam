'use strict';
const { loadPage } = require('./dom_stub.js');

function run() {
	const page = loadPage({});
	page.fireWindow('DOMContentLoaded', {});
	const ctx = page.context;
	const checks = [];
	function check(name, cond) { checks.push({ name, ok: !!cond }); }
	check('boots', ctx.Sim.ballCount > 0);
	check('queue size', ctx.TaskGen.queue.length === 4);
	check('no NaN balls', (() => {
		for (let i = 0; i < ctx.Sim.MAX_BALLS; i++) {
			const b = ctx.Sim.balls[i];
			if (!b.active) continue;
			if (isNaN(b.x) || isNaN(b.y) || isNaN(b.vx) || isNaN(b.vy)) return false;
		}
		return true;
	})());
	page.runFrames(60, 16.7);
	check('balls still valid', ctx.Sim.ballCount > 0);
	check('hole in bounds', ctx.Sim.hole.y >= ctx.Sim.hole.r && ctx.Sim.hole.y <= ctx.Sim.H - ctx.Sim.hole.r);
	// claim + abandon
	const tid = ctx.TaskGen.queue[0].id;
	check('claim works', ctx.TaskGen.claim(0, tid) === true);
	check('abandon works', ctx.TaskGen.abandon(0) === true);
	// settings clamp via URL
	const page2 = loadPage({ search: '?holeSize=999&ballCount=5&darkTheme=0' });
	page2.fireWindow('DOMContentLoaded', {});
	check('holeSize clamped', page2.context.Settings.holeSize === 200);
	check('ballCount clamped', page2.context.Settings.ballCount === 10);
	check('darkTheme parsed', page2.context.Settings.darkTheme === false);
	let failed = checks.filter(c => !c.ok);
	for (const c of checks) console.log((c.ok ? 'PASS' : 'FAIL') + ' ' + c.name);
	console.log('result: ' + (checks.length - failed.length) + '/' + checks.length);
	if (failed.length) process.exit(1);
}

run();
