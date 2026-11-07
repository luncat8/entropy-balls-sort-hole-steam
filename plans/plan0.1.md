# 0.1 — Field simulation and canvas

## Outcome

A responsive, playable two-chamber simulation: circles move in a frictionless field, reflect from boundaries, cross the central divider only through a movable opening, and leave colored impact marks where they hit the divider. This is the foundation for objectives and force controls; it does not yet include task completion or energy.

## Design

- `index.html` owns the document shell and classic script load order. Replace the ambiguous canvas id `c` with a descriptive id that is not used as a top-level JavaScript binding. Keep it file:// friendly.
- `main.js` owns the root element, `$`/DOM lookup helper, shared runtime object, initialization, and boot tail only; it contains no game implementation.
- `simulation.js` owns field dimensions, ball storage, aperture position/size/speed, ball generation, and physics stepping. Use preallocated typed arrays or reusable records for the hot simulation path. Advance with elapsed-time-independent fixed steps; cap catch-up work so a suspended tab cannot trigger an unbounded update burst.
- `canvas.js` owns canvas sizing, drawing, and reusable trajectory/impact buffers. Draw outer bounds, central wall segments around the aperture, balls, and recent divider impacts in each ball's color. For a ball moving toward the divider, draw a thin color-matched forecast segment only when its straight-line intersection with the current solid wall is a hit; suppress it when the projected crossing falls inside the current aperture. The forecast ends at the predicted contact point. On actual contact, record an impact mark at the contact point in that ball's color. These are short-horizon visual cues, not collision-aware prediction. Expire marks by age and reuse their storage.
- `input.js` owns pointer/keyboard input for direct aperture placement in this foundation slice. Clamp the aperture to its track and limit motion to its configured maximum speed.
- The field scales to the available canvas while retaining a stable logical coordinate system; resizing changes the view transform, not ball velocities or task-independent world state.
- Use six fixed colors (three hot, three cold), with immutable color and category metadata per ball. Initial defaults are constants owned by `simulation.js`: a modest ball count, consistent ball radius, centered opening, and bounded speed. The later settings plan replaces constants with a shared configuration object.
- Ball generation is time-based and bounded by a separate ball-count cap, not energy storage. New balls spawn with randomized position/heading and a positive bounded speed, avoiding immediate overlap with the divider and outer bounds.
- Wall collisions reflect the normal velocity component. With ball collisions enabled, equal-mass circles use a stable elastic impulse and positional correction. With it disabled, balls pass through one another unchanged.
- A ball crosses only if its whole circle fits through the opening at the wall crossing; otherwise reflect it at the solid wall face. Use swept contact or bounded substeps so high speeds and small radii cannot tunnel. A divider impact is recorded only on actual contact. Forecasts are straight-line cues: suppress them if an outer-wall bounce occurs first, and use the ball radius and wall face for the intersection and opening test; moving holes and ball collisions can still invalidate a forecast.

## Files and ownership

- `index.html` — document shell and load order.
- `main.js` — shared root/helper/runtime and boot wiring only.
- `simulation.js` — world state and physics.
- `canvas.js` — canvas rendering and impact marks.
- `input.js` — direct aperture input.
- `AGENTS.md` — add the source ownership map as files are introduced.

No source file should exceed roughly 500 lines. Do not introduce utility/junk-drawer modules or definition-time reads across files.

## Validation

- L0: `node --check` on each touched JavaScript file after the edit batch.
- L1: targeted simulation smoke covering wall reflection, divider reflection, aperture crossing, collision-on/off, resize invariance, generation bounds, and impact color/position.
- Manual: resize the canvas, move the aperture to both ends, observe forecasts, crossing, and matching-color impact marks, and verify that balls neither stick to the wall nor escape the field.

## Dependencies and next step

None. Follow with 0.2, which consumes the live ball distribution and adds objective rules without changing the physics contract.
