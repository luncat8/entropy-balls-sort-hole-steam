# gui.2 worklog

## 2026-11-09 full-screen field and edge HUD
plan id gui.2
changed: game.css move/feature — extract inline CSS first, then replace footer/bottom-row layout with full-screen field, edge columns and responsive drawer
changed: index.html move/feature — status/help inside drawer, backdrop and summary mounts, external local stylesheet
changed: drawer.js feature — wide/compact defaults, independent stored preferences, Escape/backdrop dismissal and summary focus
changed: forcepanel.js fix — explicit player identity for side anchoring; remove misleading two-human Space hint
changed: canvas.js / main.js / settings.js wiring — covering scale, drawer boot, disclosure ownership removed from settings
changed: experiments tests — 15 drawer cases, CSS-pixel mapping for cover scale, browser edge/score/overlay/persistence/preview checks
validation: L0 touched JS and diff --check; L2 smoke suites 367 passed, 0 failed; difficulty sweep in_band_share=0.629, distributions_without_in_band=0/60
validation: Chromium file:// six viewports (1920x1080 through 320x568 and 844x390), four controller masks each; layout/drawer/preview passed, page_errors=0; desktop/mobile/drawer/landscape screenshots inspected
review: previous footer reserved field space against the desired overlay model; removed that reservation and retained status ids/caches instead of resetting status on drawer toggles
decisions: separate wide/compact disclosure preferences keep a desktop choice from opening the first mobile visit; localStorage failures use responsive defaults and never block controls
next: mouse/touch feel check in the live preview, then design ball-size and collision settings

## 2026-11-09 fit the whole field on short screens
plan id gui.2
changed: canvas.js fix — contain scale instead of cover; centre remaining space without clipping field boundaries
changed: experiments/force_smoke.js fix/test — fitted pointer mapping and short-landscape boundary regression
changed: experiments/layout_browser.js test — require all four field boundaries inside the canvas at every viewport
validation: L0 touched JS and diff --check; force_smoke 81 and preview_smoke 58 passed; Chromium six viewports × four controller masks passed, page_errors=0
review: cover scaling cropped the vertical track in wide landscape, allowing balls and the aperture to leave the visible screen
decisions: retain full-screen canvas and edge HUD; only the field transform changes, preserving physics and pointer coordinate mapping
next: check landscape play feel on a physical small device
