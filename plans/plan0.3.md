# 0.3 — Hole force and energy

## Outcome

The movable aperture responds to held push/pull input while a shared energy store limits force. Energy has a configurable capacity and a small constant recharge rate; force stops as soon as input is released or energy is exhausted.

## Design

- `force.js` owns force-control state, input activation, magnitude, energy storage, regeneration, and energy consumption. It does not own aperture physics; it sends a bounded signed force request through the simulation interface.
- The aperture moves along the central wall's vertical track. A push moves it away from the selected target point; a pull moves it toward that point. The user chooses mode and target explicitly. Pointer/touch hold activates the selected force; `pointerup`, `pointercancel`, window blur, and loss of pointer capture release it.
- A mouse-wheel adjustment and a visible magnitude slider set force strength. Prevent page scrolling only when the pointer is over the game control region. Keyboard interaction remains available for mode and magnitude controls.
- Force changes aperture velocity subject to the configured maximum speed and track endpoints. Apply the force once per simulation step, not per rendered frame. Direct placement from 0.1 is replaced by the force interaction for normal play; retain keyboard accessibility for bounded incremental movement.
- Energy is clamped to `[0, capacity]`. Consume energy in proportion to actual aperture displacement using the configured cost per unit movement; do not drain energy for a blocked request at a track endpoint. When depleted, applied force is zero. Regenerate at a small constant rate even while idle, also clamped to capacity. Do not let release or a frame-rate change create energy.
- UI receives read-only force/energy values through a view model. No feature reaches into `force.js` internals.

## Files and ownership

- New `force.js` — active force, energy, and control input state.
- `simulation.js` — accept force and enforce aperture speed/track limits.
- `main.js` — connect force, simulation, and the input/UI surface.
- Update the ownership map in `AGENTS.md` when files are added or responsibilities change.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: targeted tests for push/pull direction, speed cap, track endpoints, energy drain/recharge/clamping, zero-energy shutdown, and release on pointer cancellation/blur.
- Manual: hold push and pull on mouse and touch, adjust strength with wheel and slider, release at each edge case, and verify energy bars and motion remain consistent at different frame rates.

## Dependencies and next step

Requires the movable aperture from 0.1. Integrate settings in gui.1 so force cost, maximum speed, and storage are user-adjustable.
