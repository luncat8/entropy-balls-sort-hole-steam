// owns: browser checks for URL-selectable modes, middle-button gestures and mode switching
// edit for: mode coverage, viewport sizes, gesture assertions

const assert = require('assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
// the packaged Chromium unpacks its own NSS libs when it believes it is on Lambda
process.env.AWS_LAMBDA_JS_RUNTIME = process.env.AWS_LAMBDA_JS_RUNTIME || 'nodejs22.x';
const { chromium } = require('playwright-core');
const binary = require('@sparticuz/chromium').default;
const root = path.join(__dirname, '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;

async function frame(page) {
	await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function inspect(page) {
	return page.evaluate(() => ({
		mode: modeState.active,
		body: document.body.dataset.mode,
		territory: !document.getElementById('territory-hud').hidden,
		gun: !document.getElementById('gun-hud').hidden,
		rooms: settingsState.rooms,
		players: players.count,
		ballSpeed: simBallConfig.speed,
		holeSpeed: simAperture.speed,
		help: document.getElementById('mode-help').textContent.length,
		status: document.getElementById('game-status-control-0').textContent,
		bg: document.getElementById('canv').getContext('2d').getImageData(0, 0, 1, 1).data[3]
	}));
}

async function run() {
	const browser = await chromium.launch({
		executablePath: await binary.executablePath(),
		args: binary.args.filter(arg => arg !== '--single-process')
	});
	const errors = [];
	try {
		for (const name of ['standard', 'territory', 'ball-gun']) {
			const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
			const page = await context.newPage();
			page.on('pageerror', error => errors.push(name + ': ' + error.message));
			await page.goto(name === 'standard' ? url : url + '?mode=' + name);
			await frame(page);
			const v = await inspect(page);
			assert.equal(v.mode, name);
			assert.equal(v.body, name);
			assert.equal(v.territory, name === 'territory');
			assert.equal(v.gun, name === 'ball-gun');
			assert.equal(v.rooms, name === 'territory');
			assert.equal(v.players, name === 'standard' ? 1 : 2);
			assert.equal(v.bg, 255);
			assert.ok(v.help > 0 || name === 'standard');
			if (name === 'ball-gun') {
				assert.ok(v.ballSpeed > 300 && v.holeSpeed < 200);
				await page.mouse.move(700, 400);
				await page.mouse.down({ button: 'middle' });
				assert.equal(await page.evaluate(() => gunState.pull), 1);
				await page.mouse.up({ button: 'middle' });
				assert.equal(await page.evaluate(() => gunState.pull), 0);
				await page.mouse.down({ button: 'right' });
				assert.equal(await page.evaluate(() => gunState.pull), 0);
				await page.mouse.up({ button: 'right' });
				const touch = await page.evaluate(() => {
					const cv = document.getElementById('canv');
					const down = () => cv.dispatchEvent(new PointerEvent('pointerdown', {
						pointerId: 9, button: 0, pointerType: 'touch', clientX: 600, clientY: 400, bubbles: true
					}));
					const up = () => cv.dispatchEvent(new PointerEvent('pointerup', {
						pointerId: 9, button: 0, pointerType: 'touch', clientX: 600, clientY: 400, bubbles: true
					}));
					down();
					modeInputStep(0.2);
					const held = gunState.pull;
					up();
					down();
					modeInputStep(0.05);
					up();
					return { held, released: gunState.pull, down: modeInputState.down };
				});
				assert.equal(touch.held, 1);
				assert.equal(touch.released, 0);
				assert.equal(touch.down, 0);
			}
			console.log('mode=' + name + ' hud=' + (v.territory || v.gun) + ' players=' + v.players
				+ ' bg=' + v.bg + ' page_errors=' + errors.length);
			await context.close();
		}
		const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
		const page = await context.newPage();
		page.on('pageerror', error => errors.push('switch: ' + error.message));
		await page.goto(url);
		await page.evaluate(() => { document.getElementById('settings-panel').open = true; });
		for (const name of ['territory', 'ball-gun', 'standard']) {
			await page.selectOption('#settings-mode', name);
			await frame(page);
			const v = await inspect(page);
			assert.equal(v.mode, name);
			assert.equal(v.body, name);
			console.log('switch=' + name + ' url=' + (await page.evaluate(() => location.search) || 'empty')
				+ ' rooms=' + v.rooms + ' players=' + v.players);
		}
		assert.equal(await page.evaluate(() => settingsState.mode), 'standard');
		assert.equal(await page.evaluate(() => players.count), 1);
		await context.close();
		console.log('mode_browser page_errors=' + errors.length);
		assert.equal(errors.length, 0, errors.join(' | '));
	} finally {
		await browser.close();
	}
}

run().catch(error => { console.error(error); process.exitCode = 1; });
