# plan 4.0 — Plate-color mode: two-player ball-guns, a shared plate and colorizer rooms

Status: planned (not started). Written against the tree at `794934a`.

## Scope

A new URL-selectable mode ("plate-color") that combines the ball-gun capture mechanic with
territory's two-player side layout and rooms.ts tint system:

- 2 players, guns on opposite sides (P1 left / red, P2 right / blue).
- A fixed central hole (aperture locked at centre, not force-driven).
- 2 colorizer rooms at the top: P1's red room (left), P2's blue room (right), each with a door
  (gap) in the top wall.
- One shared plate with 2 holes that slides horizontally along the top wall. The plate is
  energy-driven (force system, like the aperture) and acts as a tug-of-war: P1 pushes left to
  open the red door, P2 pushes right to open the blue door. Hole spacing ≠ door spacing, so the
  plate can open one door or the other, never both at once.
- Balls entering a room through an open door are tinted toward the room's owner colour
  (roomsTint, ROOMS_TINT_RATE). Once fully tinted, the ball exits the room and is captured by
  the gun of the matching colour (pull-to-muzzle, like ball-gun's gunCapture).
- Quests reuse the tasks.js system (side/total, hot/cold/palette) — field-distribution objectives
  still apply. Capture count is a scoreboard metric, not a quest category (v1).
- Layout is a settings variant: the default puts rooms at the top; a second variant puts them at
  the bottom. More variants can be added later.

Prerequisite: plan 3.2 (gun tuning — ×1.2 pull/push, fire-only push, fired-ball aura). The
aura applies to balls fired by the new mode's guns too.

## Field layout (default variant)

```
 ┌─────────────────────────────────────────┐
 │  [RED ROOM]    [BLUE ROOM]              │  ← rooms above top wall (y < 0)
 │   door1        door2                   │
 ├─────────────────────────────────────────┤  ← top wall (y = 0)
 │  plate ═════════════════════════════   │  ← sliding bar with 2 holes
 │  (hole1)              (hole2)           │
 │                                         │
 │  P1 gun ○                    ○ P2 gun   │  ← guns on left/right walls
 │                                         │
 │         ╔═══════════════════╗          │
 │         ║   fixed hole       ║          │  ← central wall, fixed aperture
 │         ╚═══════════════════╝          │
 │                                         │
 └─────────────────────────────────────────┘
```

Coordinates (field-relative, shares of `simField.w` / `simField.h`):

- Rooms: P1 red room occupies top-left quadrant above the wall (x ∈ [0, 0.5w], y < 0); P2 blue
  room top-right (x ∈ [0.5w, w], y < 0). Each room is ~0.22w wide, ~0.18h tall.
- Doors: gaps in the top wall at x centres d1 = 0.25w (red) and d2 = 0.75w (blue), width =
  simAperture.size (same as the central hole, so the forecast fit maths reuses APERTURE_FIT_SLACK).
- Plate: horizontal bar at y = 0 (top wall level), thickness = simField.wallT. Two holes at
  centres h1 = 0.30w and h2 = 0.80w (hole spacing 0.50w vs door spacing 0.50w — wait, that
  makes them equal. Use h1 = 0.30w, h2 = 0.75w → hole spacing 0.45w vs door spacing 0.50w.
  The plate can align hole 1 with door 1 (at plateX = d1 - h1 = -0.05w, i.e. shifted left) or
  hole 2 with door 2 (at plateX = d2 - h2 = 0.00w, centred). At centred, hole 1 is at 0.30w
  (door 1 at 0.25w — off by 0.05w, closed) and hole 2 is at 0.75w (door 2 at 0.75w — aligned,
  open). At shifted-left, hole 1 is at 0.25w (aligned, open) and hole 2 is at 0.70w (door 2 at
  0.75w — off by 0.05w, closed). The 0.05w offset = 5% of field width must exceed the hole/door
  radius (simAperture.size/2) so a hole never partially overlaps a door. Tune: doors at 0.22w
  and 0.78w, holes at 0.28w and 0.72w → offsets ±0.06w. Verify with smoke test.)
- Plate travel: plateX ∈ [-0.10w, +0.10w] around centre. Initial position: centred (hole 2
  aligned with door 2 — P2 starts with the blue door open, P1 must push to take it).
- Central wall: standard divider at wallX = 0.5w with aperture fixed at y = 0.5h. The aperture
  does NOT move (force system drives the plate instead). Balls cross through the fixed hole
  normally.
- Guns: P1 gun at left wall (x = 0, y = 0.5h), P2 gun at right wall (x = w, y = 0.5h).
  Aim directions point inward (P1 aims right, P2 aims left). Muzzle at wall + r + gap.

## Plate mechanics

State (new module `plate.js` or inside `mode-plate.js`):

```js
const plateState = {
  x: 0,           // centre x of the plate bar (field px)
  vx: 0,          // velocity (px/s)
  drive: 0,       // net force drive (-1..+1), from forceDrive()
  speed: 0,       // max speed (px/s), field-relative share
  minX: 0, maxX: 0,  // travel bounds
  hole1: 0, hole2: 0,  // hole centre x (plateX + share offset)
  door1: 0, door2: 0,  // door centre x (fixed)
};
```

Movement: `plateState.x += plateState.vx * dt`; `vx` is set by force:
`plateState.vx = forceDrive(dt) * plateState.speed`. Clamped to [minX, maxX]; at bounds, vx = 0.

Force control (reuses force.js):
- P1 (pointer): force direction = -1 (left), magnitude from pointer distance from plate or
  force slider. Held while pointer is down on canvas (like standard mode's hole force).
- P2 (keys): arrow left/right sets direction (-1/+1), magnitude from... hmm, P2 uses arrow keys
  in territory. For the plate, P2's force direction is always +1 (right). Magnitude could be
  fixed or controlled by a key-hold duration. Simplest: P2 holds Space (or arrow) to apply
  full force right; release to stop. Or: P2 uses the same force slider as P1 (shared slider?).
  Actually, looking at territory: P2 uses arrow keys to set force direction and Space to apply.
  For the plate, P2's direction is always right. So: P2 holds Right-arrow (or Space) to push
  right at the current magnitude. The magnitude is set by... hmm.

Let me simplify: both players use the force system with their own magnitude. P1's magnitude is set
by the pointer-distance-from-plate (like standard mode's pointer-hole force). P2's magnitude is
set by a fixed share (e.g., 0.5) or by a key-repeat rate. Actually, the simplest and most
consistent with territory: P1 uses pointer (mouse) for force direction+magnitude relative to the
plate; P2 uses arrow keys (Left/Right to set direction, Up/Down to set magnitude, Space to
apply). But for the tug-of-war, P1 always pushes left and P2 always pushes right. So:
- P1: pointer position relative to plate sets magnitude (distance → mag, like standard mode),
  direction is always -1 (left) when pointer is left of plate, +1 when right. But for tug-of-war,
  P1 should always push left. So: P1's direction is always -1 (left), magnitude from pointer
  distance from plate (or from a force slider).
  Actually, the standard mode's force: pointer sets direction (relative to hole) and the force
  slider sets magnitude. For the plate, I'll use: P1's pointer sets direction relative to plate
  (left of plate → push left, right of plate → push right), magnitude from force slider. This
  allows P1 to push in either direction, which is more flexible than always-left. P2 uses keys
  similarly. The tug-of-war emerges from both players pushing in their preferred direction.

Wait, but the user said "players push plate using force to improve his profit and compete." P1
wants to push left (to open red door), P2 wants to push right (to open blue door). If P1 can
push right too, that's fine — it's just not optimal for P1. The players will push in their
preferred direction. The force system gives them the freedom to push either way.

So: reuse the standard force control scheme (pointer for P1, keys for P2) but mapped to the
plate instead of the aperture. The force direction is relative to the plate's current position.

Plate-ball collision:
- The plate is a horizontal bar at y = 0 (top wall), thickness = wallT. It has 2 holes.
- Balls that hit the solid parts of the plate bounce off (like hitting the top wall).
- Balls that are within a hole's x-range pass through (no bounce) and can enter the room through
  the door (if the hole aligns with the door).
- If the hole is over the door: ball passes through hole → door → room (gets tinted).
- If the hole is NOT over the door: ball passes through the hole but hits the top wall at the
  door's solid part → bounces back. (The hole and door must both be open for the ball to enter.)

Actually, wait. The plate is at y=0 (the top wall). The doors are gaps in the top wall. The
plate's holes are at the plate's y (y=0). If a hole is over a door, the ball passes through both
(hole + door) into the room. If a hole is over a solid part of the top wall (not a door), the
ball passes through the hole but hits the wall → bounces. If the solid plate is over a door,
the ball bounces off the plate.

So the condition for a ball to enter a room: the ball's x is within the hole's range AND the
hole's x is within the door's range (i.e., hole and door overlap). If the hole and door don't
overlap, the ball either bounces off the plate (solid over door) or passes through the hole and
bounces off the wall (hole over solid wall).

This is implementable: in the ball's movement step, check if the ball is near the top wall (y < r
+ wallT). If so, check the plate's holes and the doors. If the ball is within a hole AND the hole
overlaps a door → ball passes through (enters room). If the ball is within a hole but the hole
doesn't overlap a door → ball bounces off the wall (not the plate). If the ball is NOT within a
hole → ball bounces off the plate (if the plate is there) or the wall.

Hmm, this is getting complex. Let me simplify the plate-ball interaction:

The plate is a bar with 2 holes. It sits at the top wall. The bar's solid parts act as the top
wall (balls bounce off). The holes are openings. If a hole overlaps a door, the ball can pass
through into the room. If a hole is over solid wall (no door), the ball passes through the hole
and... there's nothing there (the wall is solid). So the ball would pass through the hole and
then hit the wall? No — the hole IS in the plate. If the hole is over the wall (not a door),
the ball goes through the hole and then hits the top wall (which is solid at that x). So the
ball bounces.

Actually, the plate IS the top wall (it's a movable section). The rest of the top wall is solid.
The plate covers a horizontal strip of the top wall. The plate has 2 holes. The doors are gaps
in the top wall (fixed positions). When the plate's hole is over a door, the ball can pass
through. When the plate's solid part is over a door, the ball bounces off the plate.

So the check is:
1. Is the ball near the top wall (y < r + wallT)?
2. Is the ball's x within the plate's x-range (plateX - plateHalfW to plateX + plateHalfW)?
   a. If yes: is the ball's x within a hole? If yes → pass through (check door overlap). If no →
      bounce off plate.
   b. If no: bounce off top wall (standard wall bounce).
3. If passing through a hole: is the hole's x-range overlapping a door's x-range? If yes → enter
   room. If no → bounce off top wall (the wall is solid at that x, the hole is just an opening
   in the plate but the wall behind it is solid).

Wait, I'm confusing myself. Let me think about the geometry more carefully.

The top wall is at y = 0. It's solid except at the door positions (gaps). The plate is a bar that
sits AT y = 0 (on top of the wall, or replacing a section of it). The plate has 2 holes. The
plate slides horizontally.

When the plate is at position plateX, it covers the top wall from plateX - plateHalfW to
plateX + plateHalfW. Within this range, the plate's holes are openings; the rest is solid (the
plate material). Outside this range, the top wall is solid (no plate).

A ball approaching the top wall:
- If the ball's x is outside the plate's range: bounce off the top wall (standard).
- If the ball's x is within the plate's range but NOT within a hole: bounce off the plate.
- If the ball's x is within a hole: the ball passes through the plate. Now, is there a door
  at that x? If yes → ball enters the room. If no → the ball hits the top wall behind the plate
  (solid) → bounce.

But wait — if the ball passes through the plate's hole and there's no door, it hits the top wall.
But the top wall is at y = 0 and the plate is also at y = 0. The ball would pass through the
plate's hole and then immediately hit the top wall (which is right behind the plate). So the ball
bounces.

Actually, the plate is AT the top wall (same y). The plate is a section of the top wall that can
slide. The doors are gaps in the top wall (at fixed x positions). The plate's holes are openings
in the plate.

When the plate's hole is over a door: the ball passes through the hole AND the door → enters room.
When the plate's hole is over solid wall: the ball passes through the hole but hits the solid wall
→ bounces.
When the plate's solid part is over a door: the ball bounces off the plate (can't reach the door).
When the plate's solid part is over solid wall: the ball bounces off the plate (same as wall).

So the plate effectively controls access to the doors. The plate is like a lock/gate.

For implementation: the plate is a collidable object at the top wall. It has 2 holes. The
collision check:
1. Ball near top wall (y - r < wallT and vy < 0).
2. Check if ball's x is within a hole: if |ball.x - holeX| < holeHalfW.
   a. If in a hole: check if the hole overlaps a door (|holeX - doorX| < doorHalfW + holeHalfW...
      actually, the hole and door must overlap: |holeX - doorX| < (holeHalfW + doorHalfW)).
      If overlap → ball enters room (passes through, gets tinted). If no overlap → bounce off
      wall (the wall is solid at that x).
   b. If not in a hole: bounce off plate (or wall, same thing).

Wait, but the ball might be in the plate's range but not in a hole. In that case, it bounces off
the plate. But the plate is at the same y as the wall. So the bounce is the same as hitting the
wall.

Actually, the plate is a physical bar. It has thickness (wallT). It sits at the top wall. The
ball bounces off the plate's solid parts. The holes are openings. If the ball goes through a
hole, it's inside the plate's thickness. Then it either enters a room (if the hole is over a
door) or hits the wall behind (if the hole is over solid wall).

For the simulation, I'll treat the plate as part of the top wall boundary:
- The top wall is solid except at doors.
- The plate covers a section of the top wall. The plate's holes are openings in the plate.
- When the ball hits the top wall region covered by the plate:
  - If the ball is in a hole: check door overlap. If overlap → enter room. Else → bounce (wall).
  - Else: bounce (plate).
- When the ball hits the top wall region NOT covered by the plate: bounce (wall).

This is implementable in the ball's move step (simMoveBall): check the top wall bounce, and if
the plate is present at that x, apply the plate logic.

Actually, the plate check should be in the mode's beforeBalls or afterBalls hook, or in a custom
collision function. The plate is a mode-specific object. The mode hook `simModeHook.divider` is
for the central wall. For the top wall, there's no hook. I'll add the plate check in the mode's
afterBalls hook or in a custom move step.

Hmm, looking at simMoveBall: it calls simWallBounce (edges) and simDividerTouch (central wall).
The top wall bounce is in simWallBounce (y < r → bounce). For the plate, I need to intercept
the top wall bounce when the plate is present.

Option: add a mode hook for the top wall, similar to simModeHook.divider. Or: handle the plate
in the mode's beforeBalls/afterBalls hook by checking ball positions and velocities.

Actually, the simplest: the plate is at y = 0 (top wall). The ball bounces off the top wall in
simWallBounce. I can add a check in simWallBounce: if the ball is bouncing off the top wall AND
the ball's x is within the plate's range, call a mode hook `simModeHook.topWall(i)` that returns
true if the ball should pass through (into a room) instead of bouncing.

But simWallBounce is in simulation.js and shouldn't depend on mode-specific plate logic. I'll add
a hook: `simModeHook.topWall(ballIndex, x, y, r, vx, vy)` → returns true if the ball passes
through (no bounce), false if it bounces. The mode's topWall hook checks the plate's holes and
doors.

Wait, but the ball might be moving downward (away from the top wall) and still be within the
plate's range. The plate only affects balls moving upward (into the wall). simWallBounce handles
this: it only bounces if vy < 0 (moving up). So the plate check is only relevant when vy < 0.

Actually, let me reconsider. The plate is at the top wall. A ball moving upward (vy < 0) hits the
top wall. If the plate is at that x, the plate's solid part bounces the ball, or the hole lets it
through. If the hole is over a door, the ball enters the room (and starts being tinted). If the
hole is over solid wall, the ball bounces off the wall (behind the plate).

For the ball inside a room: the room has walls (like territory rooms). The ball bounces off the
room walls and gets tinted (roomsTint). When fully tinted, the ball exits the room (through the
door) and flies toward the gun.

Hmm, but if the ball entered through the door, it's inside the room. The room is above the top
wall (y < 0). The ball is now in the room area. The room has walls (3 sides + door). The ball
bounces inside the room and gets tinted. When fully tinted, the ball exits through the door back
into the field, and then is attracted to the gun.

Wait, but the door is in the top wall. If the ball is inside the room (y < 0), it can only exit
through the door (the only opening). The door is at a fixed x position. The ball flies toward
the door and exits. Then it's back in the field, now tinted.

This is getting complex. Let me simplify the room mechanic:

Option A: The room is a "tint zone" — when a ball is inside the room (above the top wall), it
gets tinted. The room has no walls (or transparent walls). The ball flies in, gets tinted, and
flies out (through the door or any direction). When fully tinted, the ball is captured (removed
and counted) immediately.

Option B: The room has walls (like territory). The ball bounces inside and gets tinted. When
fully tinted, it exits through the door and is pulled toward the gun.

Option A is simpler. Option B is more realistic. For v1, I'll go with a hybrid:
- The room is a tint zone above the top wall. It has walls on the sides and top (like a box),
  with the door as the only opening at the bottom.
- A ball entering through the door gets tinted. It bounces inside the room (walls on 3 sides).
- When fully tinted (tint progress = 1.0), the ball is "owned" by the player. It exits through
  the door and flies toward the player's gun. The gun pulls it in (like ball-gun's pull). When
  captured, the ball is removed and counted.

Actually, for the plan, I'll describe the mechanic at a high level and note the implementation
details. The key points are:
1. Plate controls access to room doors.
2. Balls entering a room get tinted.
3. Fully tinted balls are captured by the matching gun.
4. Quests are field-distribution objectives.

Let me also think about the "fixed hole on center." In the standard mode, the aperture (hole) is
movable. In the new mode, it's fixed at the center. The aperture is still a gap in the central
wall that balls can cross through. The force system drives the plate, not the aperture.

Wait, actually — looking at simAperture: it's the hole in the central wall. Its y position is
controlled by forceDrive. In the new mode, the aperture is fixed (y = 0.5h). The force system
drives the plate instead. So I need to:
- Lock simAperture.y = 0.5h (don't move it).
- Use forceDrive for the plate's movement.

But forceDrive is called in simStep (for the aperture). If I use forceDrive for the plate, I
need to call it in the mode's control step or beforeBalls hook. Actually, forceDrive is called in
simStep: `simAperture.drive = forceDrive(dt)`. In the new mode, I'd override this: the aperture
drive is 0 (fixed), and the plate drive = forceDrive(dt).

I can do this in the mode's control hook (simControlHook): the mode's control step calls
forceDrive and sets plateState.vx. But forceDrive also funds the energy (forceFund). So the
mode's control step would call forceDrive(dt) and use the result for the plate.

Actually, looking at mainControlStep:
```js
function mainControlStep(dt) {
  if (typeof roomsState !== 'undefined' && roomsState.enabled) roomsTint(dt);
  modeControlStep(dt);
}
```

The mode's control step (modeControlStep) is called every fixed step. In the new mode, the
mode's control step would:
1. Call forceDrive(dt) to get the net drive and fund the energy.
2. Set plateState.vx = drive * plateSpeed.
3. Update plateState.x += plateState.vx * dt (clamped to bounds).

But wait — simStep also calls forceDrive (for the aperture). In the new mode, I need to prevent
the aperture from moving. I can set simAperture.drive = 0 in the mode's control step, or
override simMoveAperture. Actually, the simplest: in the new mode's control step, after calling
forceDrive, set simAperture.drive = 0 (so the aperture doesn't move) and use the drive for the
plate.

Hmm, but forceDrive funds the energy (forceFund). If I call forceDrive in the mode's control
step, the energy is funded. Then simStep calls forceDrive again (for the aperture), funding
again. That would double-fund. I need to prevent simStep from calling forceDrive in the new
mode.

Looking at simStep:
```js
function simStep(dt) {
  if (simControlHook) simControlHook(dt);
  simAperture.drive = forceDrive(dt);  // ← this funds energy and sets aperture drive
  simMoveAperture(dt);
  ...
}
```

The simControlHook is called BEFORE forceDrive. In the new mode, the control hook could set a
flag to skip the aperture force. But that's hacky.

Alternative: in the new mode, the control hook calls forceDrive and stores the result. Then
simStep's forceDrive call is redundant (energy already funded). But forceDrive would fund again
(double cost).

Cleanest: add a mode hook `simModeHook.apertureForce` that returns true if the aperture force
should be skipped (the mode handles force itself). In the new mode, this returns true, and the
mode's control hook calls forceDrive for the plate.

Or: simpler — in the new mode, the control hook sets `simAperture.drive = 0` and `simAperture.velocity = 0` after simStep's forceDrive. But the energy is still double-funded.

Actually, looking at forceFund: it deducts cost from energy. If forceDrive is called twice per
step, the energy is deducted twice. That's a bug.

The cleanest solution: in the new mode, the control hook (called before forceDrive in simStep)
sets a flag. simStep checks the flag and skips forceDrive if set. The mode's control hook then
calls forceDrive itself for the plate.

But simStep is in simulation.js and shouldn't know about mode-specific flags. I'll add a hook:
`simModeHook.skipApertureForce` (boolean). In the new mode, this is true. simStep checks it:
```js
if (!(simModeHook && simModeHook.skipApertureForce)) {
  simAperture.drive = forceDrive(dt);
}
```

And the mode's control hook calls forceDrive for the plate.

Wait, but the control hook is called BEFORE forceDrive in simStep. If the control hook calls
forceDrive, and then simStep skips forceDrive, the energy is funded once. Good.

But the control hook is `simControlHook` (set by main.js via simSetControlHook). The mode's
control step is `modeControlStep` (called by mainControlStep, which is the simControlHook). So
the mode's control step runs as the simControlHook. In the new mode, modeControlStep would:
1. Call forceDrive(dt) → funds energy, returns net drive.
2. Set plateState.vx = drive * plateSpeed.
3. Update plateState.x.
4. Set simAperture.drive = 0 (aperture doesn't move).

And simStep would skip its forceDrive call (because skipApertureForce is true).

Actually, wait. Looking at main.js:
```js
function mainControlStep(dt) {
  if (typeof roomsState !== 'undefined' && roomsState.enabled) roomsTint(dt);
  modeControlStep(dt);
}
```

And mainBoot: `simSetControlHook(mainControlStep)`.

So the simControlHook = mainControlStep, which calls modeControlStep. In the new mode,
modeControlStep would handle the plate force. But simStep also calls forceDrive for the
aperture. I need to skip that.

I'll add `simModeHook.skipApertureForce = true` in the new mode. simStep checks it.

OK, this is getting detailed. For the plan, I'll describe this at a high level and note the
implementation approach.

## Gun mechanics

The new mode's guns reuse the ball-gun's pull/push/capture mechanics but for 2 players on
opposite sides. Key differences from ball-gun:
- 2 guns (P1 left, P2 right) instead of 1 gun at top.
- Guns can capture fully-tinted balls of their colour (in addition to pulling neutral balls).
- Guns use the same energy system (GUN_ENERGY_PUSH_COST, etc.) — or a shared energy with the
  plate? Separate energy for guns and plate? The user said "force use energy" for the plate.
  The guns also use energy (from ball-gun). I'll use separate energy pools: plate energy
  (force.js) and gun energy (per-gun, like ball-gun).

Actually, looking at ball-gun: gunState.energy is the gun's energy. force.js energy is the hole
force energy. These are separate. For the new mode: plate energy (force.js) + gun energy
(per-gun). Two separate energy systems.

Hmm, that might be confusing. Let me think... The user's sketch mentions "force use energy" for
the plate. The guns also use energy (from ball-gun). Having two energy systems (plate + gun) is
consistent with the existing design (hole force energy + gun energy in ball-gun mode).

Actually, in the territory mode, there's also gun energy (territoryGuns[gid].energy) and hole
force energy (force.js). So two energy systems is already the pattern.

For the new mode: plate energy (force.js, shared between players — they tug-of-war on the same
plate) + gun energy (per-gun, like territory).

Wait, but the plate is shared — both players push the same plate. The force system has per-player
energy. P1's energy funds P1's push; P2's energy funds P2's push. The plate moves based on the
net force. This is exactly like the hole force in standard mode (2 players, shared hole, separate
energy).

Guns: each player has their own gun with its own energy. P1's gun pulls/pushes/captures; P2's
gun does the same. Separate energy pools.

## Capture flow

1. Ball enters a room through an open door (hole aligned with door).
2. Room tints the ball toward the owner colour (roomsTint, ROOMS_TINT_RATE = 110/s).
3. When tint progress reaches 1.0 (fully colorized), the ball is "owned" by the room's owner.
4. The ball exits the room (through the door) and flies toward the owner's gun. The gun pulls it
   (like ball-gun's pull mechanic — gravity ray toward muzzle).
5. When the ball reaches the gun's muzzle, it's captured (gunCapture): removed from the field,
   added to the player's captured count.
6. The captured count is shown on the scoreboard and can be part of quests (future: add
   "captured" as a quest category).

For v1, step 4-5 can be simplified: when fully tinted, the ball is immediately removed and
counted (no gun pull). The gun pull can be a future enhancement. This keeps v1 simple and focused
on the plate/room mechanic.

Actually, the user said "after ball colorized to bg it captured by gun same color" — the gun
captures it. So the gun mechanic should be involved. But for v1, I'll implement the capture as
automatic (when fully tinted, removed and counted) and note that the gun-pull capture is a
polish item. The gun still pulls neutral balls (for pushing/solving quests) and can capture
fully-tinted balls that reach the muzzle.

Hmm, let me reconsider. The capture flow with the gun:
1. Ball enters room, gets tinted.
2. When fully tinted, the ball exits the room and becomes "targeted" by the owner's gun.
3. The owner's gun pulls the ball (gravity ray) — same as pulling a neutral ball, but the ball
   is now tinted (owned).
4. When the ball reaches the muzzle, it's captured (removed, counted).

The difference from neutral ball pull: a neutral ball, when pulled to the muzzle, is stored in
the gun's store (for later pushing). A tinted ball, when pulled to the muzzle, is captured
(removed, counted) — not stored.

So the gun treats tinted balls differently: capture (remove) instead of store. This is a small
change to gunCapture: if the ball is tinted (owned), capture (remove + count) instead of store.

For the plan, I'll describe this flow.

## Quest system

Reuse tasks.js as-is. The quest generator produces side/total, hot/cold/palette objectives based
on the field distribution (simDist). These objectives apply to the new mode's field (balls
flying around, crossing the central hole).

The plate/rooms/capture mechanic adds a new dimension: players can capture balls (remove them
from the field). This changes the field distribution. Quests about "left holds >60% red" can be
solved by capturing red balls on the right (removing them from the right side).

For v1, no new quest categories. Capture count is a scoreboard metric. Future: add "captured"
as a quest category (e.g., "P1 has captured >5 balls").

## HUD

- Plate indicator: a horizontal bar at the top showing the plate's position and the 2 holes.
  Highlighted when a hole aligns with a door (room open). Shows which player is pushing (force
  indicators on left/right).
- Room tint indicators: small swatches showing each room's colour and tint progress for balls
  inside.
- Gun HUD: per-player gun energy, stored balls, force (like territory's gun HUD).
- Plate force panels: per-player force direction/magnitude/energy (like the standard force
  panels, but for the plate).
- Scoreboard: player scores, captured ball counts, match-mode readout.

## Settings (layout variants)

Layout is a settings variant:
- Default: rooms at the top (as described above).
- Variant 2: rooms at the bottom (plate slides along the bottom wall, doors in the bottom wall).
- Future: rooms on left/right sides (plate slides vertically).

The layout variant is a setting (like mode/rooms). Stored in URL. The plate geometry (door
positions, hole positions, plate travel) is computed from the layout variant.

## Registration points

1. **New file `mode-plate.js`**: the mode's state, hooks (simModeHook, trajHook, canvas hook,
   input hook), plate logic, room generation, gun logic, HUD painting.
2. **`mode.js`**: add `'plate-color'` to MODE_NAMES and MODE_BALL_SPEED (0.25 like
   territory/ball-gun). Add modeSet boot for the new mode.
3. **`settings.js`**: add `'plate-color'` to SETTINGS_MODES. Add layout variant setting.
4. **`status.js`**: add STATUS_MODE_CONTROL.plate with P1/P2 control strings.
5. **`index.html`**: add `<script src="mode-plate.js"></script>` before mode.js (load order:
   …territory → gun → modeinput → mode-plate → mode → main).
6. **`rooms.js`**: may need a new room creation function for deterministic top-attached rooms
   (currently roomsMakeSide with side=2 creates a top room, but with random x position). Add a
   `roomsMakeTopDeterministic(owner, w, h, xCenter)` or reuse roomsMakeSide with a fixed x.
7. **`simulation.js`**: add `simModeHook.skipApertureForce` support (skip aperture force when
   the mode handles force). Add `simModeHook.topWall` hook for plate-ball interaction.
8. **`trajectory.js`**: the new mode's forecast hooks (trajHook.trace/reach/budget) — forecast
   balls through the plate holes and room doors.
9. **`canvas.js`**: plate drawing (via canvasSetModeHook wall/overlay), room door highlighting.

## Validation plan

- L0: `node --check` on all touched files.
- L1: extend `experiments/mode_smoke.js` with plate-color assertions:
  - Mode boots, URL state (mode=plate-color, layout=top).
  - Plate moves with force (P1 pushes left, P2 pushes right, net position).
  - Plate holes align with doors at correct positions (initial: hole 2 over door 2).
  - Ball entering through open hole+door gets tinted (roomsTint progress).
  - Fully tinted ball is captured (removed, counted).
  - Guns pull neutral balls and capture tinted balls.
  - Aura applies to fired balls (plan 3.2).
  - Quests generate and evaluate correctly.
  - HUD shows plate position, room tints, gun energy, force panels.
- L2: full suite (`experiments/run_all.sh` or equivalent) for shared/boot files (mode.js,
  settings.js, index.html, simulation.js changes).

## Open questions / future work

- Bot support for the new mode (bot policy for plate tug-of-war and room capture).
- Layout variants (bottom rooms, side rooms).
- Quest categories for captured balls.
- Gun-pull capture polish (tinted balls attracted to gun muzzle).
- Plate speed and force balance tuning (playtest).
- Room tint rate tuning (how fast balls get colorized).
