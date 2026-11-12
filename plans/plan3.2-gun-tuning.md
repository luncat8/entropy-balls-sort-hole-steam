# plan 3.2 — Gun mode tuning: ×1.2 pull/push, fire-only push, fired-ball aura

Status: planned (not started). Written against the tree at `794934a`.

## Scope

Cross-cutting changes to both gun modes (ball-gun in `gun.js`, territory in `territory.js`):

1. **Pull force ×1.2** — increase the pull acceleration cap by 20% in both modes.
2. **Push force ×1.2** — increase the push strength by 20% in both modes.
3. **Fire-only push** — remove territory's direct distant-ball push (territoryPush's else-branch
   that pushes the aimed target ball when stored=0). Push only launches stored balls, never
   pushes distant balls directly.
4. **Fired-ball aura** — a field/aura on balls fired by a gun that causes them to disappear
   after hole intersection (so tasks cannot be solved by firing into the hole). The aura is
   active for ~20 seconds or 4 edge bounces after the gun fired the ball, then disabled.

These changes apply to ALL gun modes ("improve all guns modes"), not just ball-gun.

## Changes

### 1. Pull force ×1.2 (gun.js + territory.js)

Pull formula: `cap · forceShare / (1 + (t/along)²) / (1 + (perp/beam)²) · fade²`
where `along = reach · 0.45`, `fade = 1 - t/reach`.

Scale the acceleration cap (the numerator `cap`) by 1.2:

| File | Constant | Current | New |
|------|----------|---------|-----|
| gun.js | GUN_PULL_ACC_SHARE | 2400 | 2880 |
| territory.js | TERRITORY_PULL_ACC_SHARE | 1800 | 2160 |

Reach and beam unchanged (the falloff shape stays the same; only the peak force increases).

### 2. Push force ×1.2 (gun.js + territory.js)

Push strength: `min(simPx(PUSH_SHARE), aimLen · PUSH_SLOPE) · forceShare`.

Scale the push share by 1.2:

| File | Constant | Current | New |
|------|----------|---------|-----|
| gun.js | GUN_PUSH_SHARE | 600 | 720 |
| territory.js | TERRITORY_PUSH_SHARE | 520 | 624 |

Slope unchanged (the aim-length scaling stays the same; only the field-relative cap increases).

### 3. Fire-only push (territory.js)

In `territoryPush` (~line 369), the current logic is:

```js
function territoryPush(gid) {
  if (stored > 0) { territoryLaunchBall(gid); return; }
  // else: push the aimed target ball directly (DISTANT PUSH — DELETE)
  ...
}
```

Delete the else-branch. Push only launches stored balls. When stored=0, push is refused
(no-op, no energy cost — same as gun.js's gunPush refusal at energy=0).

### 4. Fired-ball aura (simulation.js + gun.js + territory.js)

New per-ball state in `simulation.js`:

```js
// armed = 1 if the ball was fired by a gun and the aura is active
const simBallArmed = new Uint8Array(BALL_CAP);
// aura timer (seconds since firing)
const simBallAuraT = new Float32Array(BALL_CAP);
// edge bounce count since firing
const simBallAuraBounces = new Uint8Array(BALL_CAP);
```

Init in `simInit()` (fill 0). Copy slots in `simRemoveBall` swap-remove (pattern already
present for hue slots). Default 0 in `simAddBall`.

**Arming**: `gun.js`'s `gunLaunchBall` and `territory.js`'s `territoryLaunchBall` call a new
`simArmBall(i, auraSec)` after spawning the launched ball. `auraSec` = the aura duration
(default 20s).

**Aura update** (in `simStep`, after the move loop, before afterBalls):

```js
for (let i = 0; i < simBalls.count; i++) {
  if (!simBallArmed[i]) continue;
  // check hole/aperture intersection
  if (simFiredCrossesHole(i)) { simRemoveBall(i); i--; continue; }
  // check time expiry
  simBallAuraT[i] += dt;
  if (simBallAuraT[i] >= simBallAuraMax) { simBallArmed[i] = 0; continue; }
  // check bounce count
  if (simBallAuraBounces[i] >= 4) { simBallArmed[i] = 0; }
}
```

**Hole crossing check** (`simFiredCrossesHole(i)`):

```js
function simFiredCrossesHole(i) {
  const r = simBalls.r[i];
  const dx = simBalls.x[i] - simField.wallX;
  if (dx > r || dx < -r) return false;
  const half = simAperture.size / 2;
  return simBalls.y[i] > simAperture.y - half - APERTURE_FIT_SLACK
    && simBalls.y[i] < simAperture.y + half + APERTURE_FIT_SLACK;
}
```

This checks if the ball is within the aperture (hole) opening in the central wall. A fired ball
crossing the hole is removed (consumed) while armed.

**Bounce counting** (in `simWallBounce`, simulation.js):

```js
function simWallBounce(i) {
  const r = simBalls.r[i];
  // ... existing bounce logic ...
  // count edge bounces for armed balls
  if (simBallArmed[i]) {
    if (simBalls.x[i] < r && simBalls.vx[i] < 0) { simBalls.vx[i] = -simBalls.vx[i]; simBallAuraBounces[i]++; }
    // ... similar for other edges ...
  }
}
```

Only count when the bounce actually reverses velocity (a resting ball with vy=0 doesn't count).

**Mode hook override** (optional, for future modes with different hole geometry):

```js
// simModeHook.auraHole(i) → boolean, returns true if the ball crossed the hole
// default: simFiredCrossesHole(i)
```

The new plate-color mode (plan 4.0) can override this if its hole geometry differs.

**Disarm conditions**:
- Aura timer ≥ 20s → disarm (ball becomes normal, can fall in hole normally).
- Edge bounces ≥ 4 → disarm.
- Crossing the hole while armed → removed (consumed).

**Must not affect**:
- Pull/push eligibility (armed balls can still be pulled/pushed by guns).
- Capture (armed balls can still be captured by guns).
- Standard mode (no guns → no armed balls → no effect).

## Tuning constants

| Constant | Value | Location |
|----------|-------|----------|
| Aura duration | 20s | simulation.js (simBallAuraMax) |
| Max edge bounces | 4 | simulation.js |
| Pull cap ×1.2 | gun 2880, territory 2160 | gun.js, territory.js |
| Push share ×1.2 | gun 720, territory 624 | gun.js, territory.js |

## Smoke test updates (experiments/mode_smoke.js)

1. `gun: push cap is field-relative at 4x the first 150 ‰/s tuning` — update expected value
   from `sim.simPx(600)` to `sim.simPx(720)`.
2. `gun: the whole cursor range launches 4x the old strength` — update `before` function from
   `Math.min(sim.simPx(150), len * 0.5)` to `Math.min(sim.simPx(180), len * 0.6)` (×1.2) and
   multiplier from 4 to 4.8.
3. `gun: the pull accel peaks at 5x reach along the barrel` — update expected from
   `sim.simPx(2400)` to `sim.simPx(2880)`.
4. Territory pull accel tests — reach unchanged (420), so `territoryPullAccel(sim.simPx(600), 5)
   === 0` still holds. No peak test for territory pull in mode_smoke — add one if needed.
5. New: aura tests — arm a ball, verify it's removed on hole crossing; verify disarm after
   20s or 4 bounces; verify armed balls can still be pulled/captured.
6. New: territory fire-only push — verify territoryPush with stored=0 is a no-op.

## Validation

- L0: `node --check` on gun.js, territory.js, simulation.js.
- L1: `experiments/mode_smoke.js` (updated + new aura/fire-only tests).
- L2: full suite for simulation.js (shared boot file).

## Notes

- The aura is a per-ball flag in simulation.js. It's set by gun modes when they launch a ball.
  Standard mode never sets it → zero overhead.
- The hole crossing check uses simAperture (the central wall hole). In territory/ball-gun, the
  aperture is the same hole. In the new plate-color mode (plan 4.0), the hole is fixed at
  centre — same check applies.
- The aura removal happens in simStep after the move loop, so the ball is removed before
  afterBalls/tasksStep. This prevents the removed ball from contributing to quest evaluation.
- Edge bounce counting in simWallBounce: only count when velocity reverses (not for resting
  balls). Room wall bounces (roomsWallBounce) do NOT count — only field edge bounces.
