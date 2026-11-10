# 3.1 — Ball-gun capture mode

## Outcome

A separate ball-gun mode pits two different controls against each other: one player steers the aperture, while the other aims and fires a ball gun with the pointer. The existing aperture game and the colored-wall territory mode remain independent modes.

## Dependency

Build plan 3.0's mode selector, URL state and lifecycle first. This mode registers its own rules and controls through that shared boundary; it does not duplicate mode selection or territory behavior.

The gun uses a soft gravity-ray interaction rather than snapping a ball to the cursor. Pull strength falls with distance from the gun and with perpendicular distance from the aim ray. The player can pull a ball into position, aim, then push it toward the aperture. A push is refused when the selected ball's predicted path would pass through the aperture. The selected ball has a predicted path shown before release; other balls show only relevant paths through the aperture.

## Design

### Mode and roles

- Register `ball-gun` as a distinct selectable mode; preserve `standard` as the default and `territory` as a separate choice. Mode selection restores from the settings URL.
- The aperture player uses the existing force/energy channel. Hole speed is one quarter of its normal setting, while force cost and energy source remain unchanged.
- Ball motion is twice the normal speed in this mode. Derive the multiplier from the existing field-relative speed so resizing does not change its meaning.
- The gun occupies a stable position near the top edge, three quarters of the field width from the left. Pointer movement sets its aim point; it does not move the gun itself.
- Mode switching resets transient captures and input holds, and never changes settings or role assignment in the standard mode.

### Gravity ray and ball selection

- A held pull applies attraction to the ball under the aim ray, with a smooth falloff in both along-ray distance and perpendicular aim error. No ball is attached or teleported; the simulation remains responsible for motion and ball contacts.
- Pull strength has a finite cap and tends continuously to zero outside a bounded field-relative reach. The pull formula and cap are shared by display and physics.
- The active target is the best eligible ball near the ray, with deterministic tie-breaking. The target indicator names the ball being acted on, and input release, pointer cancellation, focus loss and mode changes stop force immediately.
- A push applies an impulse along the aimed direction with magnitude increasing with the cursor's distance from the gun and capped at a field-relative maximum. The initial cap is tuned in the 10–20% of field-size range.
- Before applying push, forecast the selected ball with its post-push velocity and the current aperture trajectory. Refuse a push predicted to pass through the aperture; show the predicted path and refusal state so the player can adjust the aim.

### Forecast cues

- The selected/captured ball's forecast is visible regardless of whether it will hit or pass, and uses the same whole-body divider fit as simulation.
- Other balls draw a forecast only when they are predicted to pass through the aperture. Their trace is limited to three to six meaningful segments or a field-relative flight-time budget, whichever ends first.
- Reuse the existing preallocated trajectory buffer and dashed-line rendering. Keep the frame loop allocation-free and avoid a second, divergent divider-fit rule.
- Settings/help explain the pull ray, push gesture, refusal behavior and forecast filter. Mouse and touch gestures must each have an unambiguous press/release pair.

## Open tuning values

The falloff curve, its along-ray and cross-ray scales, push impulse cap, and precise pull/push gestures are gameplay tuning choices. Start with smooth monotonic curves and bounded field-relative values; choose constants from a small repeatable probe rather than baking pixel distances into input code. The interaction should remain controllable at both narrow and wide viewports.

## Files and ownership

- `settings.js` — mode selection and URL representation; only add settings required for meaningful player control.
- `main.js` — mode lifecycle wiring.
- New mode-owned gun/input source — pointer ray, target selection, pull and push requests.
- `simulation.js` — mode speed multiplier and the force/impulse application hooks; standard simulation is unchanged.
- `trajectory.js` — post-push whole-body pass prediction and bounded trace, sharing the divider rule.
- `canvas.js`, `index.html`, `game.css` — target/path cues, mode controls and help.
- `experiments/` — deterministic ray-falloff, push refusal, trajectory and input-release smoke tests.

## Manual pass list

- In ball-gun mode, the gun stays at the specified top-edge position; the aperture player can move the hole at one quarter speed with the same energy behavior.
- Pulling near the aim ray attracts the intended ball; strength weakens smoothly both as it gets farther away and as aim error increases.
- Moving the pointer farther from the gun increases push strength until the cap; the cap and pull reach scale with the field, not CSS pixels.
- A push whose post-push path will pass through the aperture is refused and its forecast is visible; adjusting the aim to a hit permits the push.
- The selected ball shows its forecast; unrelated balls show only predicted passes, with no more than the configured segment/time budget.
- Releasing, cancelling, losing focus, changing mode or using touch stops the gun cleanly.
- Ball speed doubles only in this mode; standard and territory modes retain their own speeds and control rules.
- Mode URL restoration and compact/wide layout keep the role controls usable.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: deterministic ray-force and predicted-push tests, including touch/release and push-refusal boundaries.
- L2: full smoke suite and browser layout checks when mode selection or script order changes.
