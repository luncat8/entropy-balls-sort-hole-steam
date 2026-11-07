# 0.3 — Hole force and energy

## Outcome

A human participant controls the hole with held push/pull input and an individual energy store. The control interface accepts any participant id so a second human or bot can later use the same rules.

## Design

- `force.js` owns per-participant signed requests, activation, magnitude, energy and regeneration. `players.js` owns participant identity and controller selection. Input maps the human's controls to a participant request; future bots use that same request interface.
- Push and pull mean positive and negative vertical movement, respectively. A visible mode control selects direction; wheel or slider sets magnitude. Pointer/touch hold or keyboard hold activates it. Pointer release, cancellation, lost capture, blur, and controller switch clear the request immediately. Prevent wheel scrolling only over the control region.
- Each fixed step, recharge each store by a small constant rate, clamped to its capacity. An active request costs energy in proportion to its magnitude and elapsed time, even if the hole is blocked or another request cancels it. Scale a request down if the remaining energy cannot cover that step; zero cost permits free movement. Deduct each participant's own cost before combining signed requests.
- Sum the funded requests and clamp to the configured hole speed; the result is the hole's velocity for that step. Releasing input therefore stops its contribution immediately, with no residual momentum. Clamp movement at track endpoints. Equal opposing requests cancel movement but each consumes its own energy. Apply identical rules for one or multiple participants.
- The direct drag from 0.1 is a temporary foundation control and is disabled in normal energy-limited play. UI receives read-only per-participant force and energy view models.

## Files and ownership

- New `force.js` — per-participant requests and energy.
- `input.js` — human controls; `players.js` — participant/controller identity.
- `simulation.js` — apply combined velocity and enforce track bounds.
- `main.js` — connect features only; update the ownership map.

## Validation

- L0: `node --check` on touched JavaScript.
- L1: direction, speed cap, endpoints, partial-energy scaling, zero-cost case, independent stores, opposing requests, recharge/clamping, and release on pointer cancellation, blur and controller switch.
- Manual: hold and release controls on mouse, touch and keyboard, vary strength, exhaust and recharge energy, and verify consistent motion at different frame rates.

## Dependencies and next step

Requires the aperture from 0.1 and participant identity from 0.2. Integrate configurable energy and status in gui.1.
