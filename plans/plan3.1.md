# 3.1 — Ball-gun capture mode

## Outcome

A separate ball-gun mode pits two different controls against each other: player 1 aims and fires a ball gun with the pointer, while player 2 steers the aperture through the existing force/energy channel. The existing aperture game and the colored-wall territory mode remain independent modes.

The gun uses a soft gravity-ray interaction rather than snapping a ball to the cursor. Pull strength falls with distance from the gun and with perpendicular distance from the aim ray. The player can pull a ball into position, aim, then push it toward the aperture. A push is refused when the selected ball's predicted post-push path would pass through the aperture. The selected ball has a predicted path shown before release; other balls show only relevant paths through the aperture, with longer but capped traces.

## Dependency

Build plan 3.0's mode selector, URL state and lifecycle first. This mode registers its own rules and controls through that shared boundary; it does not duplicate mode selection or territory behavior. The standard forecast renderer is reused, not forked: with no mode hook installed it draws exactly the standard cues.

## Design

### Mode and roles

- Register `ball-gun` as a distinct selectable mode; preserve `standard` as the default and `territory` as a separate choice. Mode selection restores from the settings URL.
- The mode uses two human slots: player 1 owns the pointer gun, player 2 owns the hole. Returning to standard restores the participants from the settings.
- The hole player uses the existing force/energy channel. Hole speed is one quarter of its normal setting, while force cost, funding and energy source remain unchanged.
- Ball motion is a quarter of the normal speed in this mode (and in territory mode), from one mode speed table in `mode.js`. Derive both multipliers from the existing field-relative settings so resizing does not change their meaning and no setting value is overwritten.
- The gun occupies a stable position near the top edge, three quarters of the field width from the left. Pointer movement sets its aim point; it does not move the gun itself.
- Mode switching resets transient captures and input holds, and never changes settings or role assignment in the standard mode.

### Gestures

- Holding the **middle** mouse button (button 1) pulls the aimed ball along the gravity ray; a left-button press pushes it. The right button is not used — it opens the context menu and cannot be a reliable aim gesture. Prevent middle-button `mousedown`/`auxclick` so the browser cannot autoscroll.
- Touch uses one unambiguous press/release pair: hold to pull, tap to push. Pointer cancellation, focus loss, visibility change, release and a mode switch stop force immediately.
- The pointer always sets the aim point. The cursor's distance from the gun sets push strength; its direction sets the impulse direction.
- Help text in the settings drawer states the pull ray, push gesture, refusal behavior and forecast filter.

### Gravity ray and ball selection

- A held pull applies attraction to the ball under the aim ray, with a smooth monotone falloff in both along-ray distance and perpendicular aim error. The shape follows the draft's `~ 1/(5 + distance)` decay but is written in field-relative shares, not pixels. No ball is attached or teleported; the simulation remains responsible for motion and ball contacts.
- When a pulled ball reaches the muzzle it is consumed without bouncing and stored in the gun, up to three balls (radius, color and palette kept in preallocated store slots). A full store pulls no further balls. A push no longer impulses a field ball: it launches the oldest stored ball from the muzzle along the aim at the push strength, and with an empty store it does nothing. `simulation.js` owns ball removal/insertion (`simRemoveBall`/`simAddBall`, swap-remove over the same typed arrays); the gun only decides.
- Pull acceleration has a finite cap and tends continuously to zero at a bounded field-relative reach. The same formula and cap are shared by physics and the displayed ray.
- The active target is the best eligible ball near the ray: in front of the gun, inside the reach and beam, scored by aim error and along-ray distance with deterministic tie-breaking by index. The target indicator names the ball being acted on.
- A launch applies a velocity along the aimed direction with magnitude increasing with the cursor's distance from the gun and capped at a field-relative maximum in the 10–20 % of field-scale range. A velocity cap keeps a repeatedly launched ball controllable.
- Before launching, forecast the oldest stored ball from the muzzle with its launch velocity and the current aperture trajectory (the hole's live velocity applied over the flight time to the divider). Refuse a launch predicted to pass through the aperture; show the predicted path and refusal state so the player can adjust the aim. Changing aim clears the refusal state.

### Forecast cues

- The stored ball's launch forecast is visible regardless of whether it will hit or pass, and uses the same whole-body divider fit as simulation. It is drawn before release as a second cue, and the stored balls are drawn beside the muzzle with a `Stored n / 3` HUD row.
- Other balls draw a forecast only when they are predicted to pass through the aperture. Their trace is limited to six path points or a field-relative flight budget, whichever ends first, so the canvas does not fill with lines.
- Reuse the existing preallocated trajectory buffer, the shared divider rule and dashed-line rendering. The per-ball point budget is a parameter of one trace function; there is no second, divergent divider-fit rule. The frame loop stays allocation-free.

### Open tuning values

The falloff curve, its along-ray and cross-ray scales, push impulse cap and touch hold threshold are gameplay tuning choices. Start with smooth monotonic curves and bounded field-relative values; choose constants from a small repeatable probe rather than baking pixel distances into input code. The interaction should remain controllable at both narrow and wide viewports.

## Files and ownership

- `settings.js` — mode selection and URL representation; only add settings required for meaningful player control.
- `main.js` — mode lifecycle wiring.
- `gun.js` — gun state, gravity-ray physics, target selection, pull/push requests, push refusal and the gun view/HUD.
- `modeinput.js` — pointer ray, gesture state, pull/push requests and release handling.
- `simulation.js` — mode ball-speed multiplier, aperture-speed multiplier and force/impulse hooks; standard simulation unchanged.
- `trajectory.js` — post-push whole-body pass prediction, hole shift and bounded trace, sharing the divider rule.
- `canvas.js`, `index.html`, `game.css`, `status.js`, `scoreboard.js` — target/path cues, mode controls, mode readout and help.
- `experiments/` — deterministic ray-falloff, push refusal, trajectory and input-release smoke tests.

## Manual pass list

- In ball-gun mode, the gun stays at the specified top-edge position; the aperture player can move the hole at one quarter speed with the same energy behavior.
- Middle-button hold pulls near the aim ray; strength weakens smoothly both as the ball gets farther away and as aim error increases. Left-button press pushes.
- Moving the pointer farther from the gun increases push strength until the cap; the cap and pull reach scale with the field, not CSS pixels.
- A push whose post-push path will pass through the aperture is refused and its forecast is visible; adjusting the aim to a hit permits the push.
- The selected ball shows its forecast and predicted push path; unrelated balls show only predicted passes, with no more than six segments.
- Releasing, cancelling, losing focus, changing mode or using touch stops the gun cleanly; touch hold pulls and tap pushes.
- Standard mode forecasts, plate marks and dash options are unchanged.
- Ball speed is a quarter of the standard speed in both new modes; standard mode retains its own speed and control rules.
- Mode URL restoration and compact/wide layout keep the role controls usable.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: deterministic ray-force and predicted-push tests, including touch/release and push-refusal boundaries.
- L2: full smoke suite and browser layout checks when mode selection or script order changes.
