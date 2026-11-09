# gui.2 — Full-screen field and edge HUD

## Outcome

The field uses the entire viewport. The divider remains central; HUD may obscure the outer chambers. Settings and help occupy a drawer instead of a permanent footer. Player 1's quest and force panel stay on the left, Player 2's on the right; the score table stays top-right.

## Design

- `game.css` owns game/HUD styles, extracted without behavior changes from the inline stylesheet before layout edits. `index.html` owns semantic mounts and script order.
- Canvas covers the viewport with no footer reservation. Fit the entire field inside the viewport without distortion or cropping; centre unused space when aspect ratios differ. Both horizontal and vertical field boundaries remain on-screen, including short landscape devices. Controls may obscure outer chambers while leaving the divider central. Observe canvas size changes independently of drawer content.
- Each participant keeps its quest and force panel in one column. Position the columns at opposite bottom edges with a central gap, shrink their widths on narrow screens, and allow each column to scroll on short screens. Inactive players have no column. Keep the top-right score table above the right player's column.
- Settings is a native details drawer with a keyboard-operable summary. On screens at least 1400 px wide and 650 px high it defaults open as a left column; the left player moves beside the open drawer. Elsewhere it defaults closed and opens above the HUD with a dismissing backdrop. Escape closes it and restores summary focus. It is a non-modal disclosure, not a focus-trapping dialog.
- `drawer.js` owns drawer DOM, responsive mode, dismissal and saved disclosure preferences. Store open/closed preference separately for wide and compact layouts in localStorage. Missing, invalid or unavailable storage uses responsive defaults; blocked storage never prevents play. Viewport changes restore the appropriate layout preference. No gameplay state is stored.
- Move live/preview status and both players' contextual help inside the drawer, retaining their DOM ids and `status.js` ownership. A closed drawer hides the status without changing or resetting it. The settings URL remains independently available through its existing owner.
- Preview details appear above the bottom-center goal label, bounded to the central gap where space permits; they do not displace player controls.

## Validation

- L0: check touched JavaScript and whitespace.
- L1: responsive defaults, remembered preference per layout, invalid/blocked storage, Escape/backdrop dismissal, controller changes and preview status inside the drawer.
- L2: all smoke suites because markup and boot change; browser layout checks at desktop, narrow portrait and short landscape sizes; verify full-screen canvas, side anchoring, central gap, score clearance, drawer overlay and keyboard dismissal.
- Manual: drag force controls and settings on mouse/touch, hold/release quest preview, resize with two players, reload with the drawer closed/open, and confirm no loss of settings or game state from toggling the drawer.

## Next step

Ball-size and collision settings require their own simulation design; the task queue remains deferred in 1.0.

## Browser harness

The page has no runtime dependencies. The optional `experiments/layout_browser.js` check uses
`npm install --no-save --package-lock=false playwright-core @sparticuz/chromium` for test tooling.
Run with `node experiments/layout_browser.js` on a host with Chromium's shared libraries. In the
Arena sandbox, inflate the package's `bin/al2023.tar.br` with its exported `inflate` helper, then run
with `AWS_EXECUTION_ENV=AWS_Lambda_nodejs22.x LD_LIBRARY_PATH=/tmp/al2023/lib`.
