// owns: browser checks for the full-screen field, edge HUD and settings drawer
// edit for: viewport coverage, drawer persistence and overlay interactions

const assert = require('assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright-core');
const binary = require('@sparticuz/chromium').default;

async function run() {
	const browser = await chromium.launch({ executablePath: await binary.executablePath(), args: binary.args.filter(arg => arg !== '--single-process') });
	const errors = [];
	const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
	try {
		for (const [width, height] of [[1920, 1080], [1440, 900], [1024, 768], [390, 844], [320, 568], [844, 390]]) {
			const context = await browser.newContext({ viewport: { width, height } });
			const page = await context.newPage();
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(url);
			await page.evaluate(() => localStorage.clear());
			await page.reload();
			const wide = width >= 1400 && height >= 650;
			assert.equal(await page.locator('#settings-panel').evaluate(el => el.open), wide);
			for (const bots of [0, 1, 2, 3]) {
				await page.evaluate(bots => settingsApply({ ...settingsDefaults, humans: 2, bots }, false), bots);
				await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
				const layout = await page.evaluate(() => {
					const rect = selector => document.querySelector(selector).getBoundingClientRect();
					const canvas = rect('canvas');
					const left = rect('.force-pair[data-player="0"]');
					const right = rect('.force-pair[data-player="1"]');
					const score = rect('.score-panel');
					return {
						full: canvas.width === innerWidth && canvas.height === innerHeight,
						centre: left.right < innerWidth / 2 - 12 && right.left > innerWidth / 2 + 12,
						edges: left.left >= 0 && right.right <= innerWidth && innerWidth - right.right <= 12,
						score: score.bottom < right.top,
						field: simField.w === Math.round(canvas.width) && simField.h === Math.round(canvas.height)
							&& simField.wallX === simField.w / 2,
						inside: (() => {
							for (let i = 0; i < simBalls.count; i++) {
								const r = simBalls.r[i];
								if (simBalls.x[i] < r - 0.5 || simBalls.x[i] > simField.w - r + 0.5) return false;
								if (simBalls.y[i] < r - 0.5 || simBalls.y[i] > simField.h - r + 0.5) return false;
							}
							return true;
						})(),
						status: !!document.querySelector('#settings-panel .game-status'),
						overflow: document.documentElement.scrollWidth <= innerWidth
					};
				});
				for (const [key, value] of Object.entries(layout)) assert.ok(value, `${width}x${height} bots=${bots} ${key}`);
			}
			const scores = await page.evaluate(() => Array.from(tasksScore));
			if (wide) await page.locator('#drawer-toggle').click();
			await page.locator('#drawer-toggle').click();
			// the panel's toggle event, which shows the backdrop, flushes as a task after the click
			await page.waitForFunction((open) => document.getElementById('drawer-backdrop').hidden === open, wide);
			assert.equal(await page.locator('#drawer-backdrop').isVisible(), !wide, `${width}x${height} backdrop`);
			await page.keyboard.press('Escape');
			assert.deepEqual(await page.evaluate(() => Array.from(tasksScore)), scores);
			assert.equal(await page.locator('#settings-panel').evaluate(el => el.open), false, `${width}x${height} escape closes`);
			assert.equal(await page.locator('#drawer-toggle').evaluate(el => el === document.activeElement), true, `${width}x${height} focus restored`);
			await page.reload();
			assert.equal(await page.locator('#settings-panel').evaluate(el => el.open), false);
			await page.locator('#drawer-toggle').click();
			// the preference is written by the panel's toggle event, which flushes after the rAF pair
			await page.waitForFunction(key => localStorage.getItem(key) === '1', wide ? 'entropy-drawer-wide' : 'entropy-drawer-compact');
			await page.reload();
			assert.equal(await page.locator('#settings-panel').evaluate(el => el.open), true);
			if (!wide) {
				await page.locator('#drawer-backdrop').click({ position: { x: width - 5, y: height - 5 } });
				assert.equal(await page.locator('#settings-panel').evaluate(el => el.open), false);
			} else await page.keyboard.press('Escape');
			await page.evaluate(() => settingsSetHumans(2, false));
			await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
			const card = page.locator('.force-pair[data-player="0"] .quest');
			await card.focus();
			await page.keyboard.down('Space');
			await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
			assert.match(await page.locator('#game-status-state').textContent(), /paused/);
			await page.keyboard.up('Space');
			await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
			assert.match(await page.locator('#game-status-state').textContent(), /^Live/);
			console.log(`viewport=${width}x${height} modes=4 layout=pass drawer=pass preview=pass`);
			await context.close();
		}
		assert.deepEqual(errors, []);
		console.log('file_url=pass page_errors=0');
	} finally {
		await browser.close();
	}
}

run().catch(error => { console.error(error); process.exitCode = 1; });
