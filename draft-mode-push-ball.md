new game mode

## one player control hole, another control ball gun

default for this mode
2x slow ball movement

in both new 2 game modes ball gun should pull and consume balls.
wheel should change force and energy consumption of pull and push.



### 2nd player:
control hole
4x slow hole movement (energy source and consumption is same, to make hole weak)


### 1st player:
ball gun position is center of some side (75% x, y=0).
ball gun pull consume ball without bounce and store up to 3 balls.

ball gun control with mouse (instead of player):
right press suck pull aimed ball with force ~ 1/(5+distance px)
cursor: aim and force ~ distance, limit by max at something like 10..20% screen size.
press to push ball. abort push if trajectory lead this ball to hole in range of calculated trajectory.
draw predicted trajectory of captured ball that will be pushed with ball gun.
in this game mode for other balls draw only trajectories that pass through hole. draw trajectories longer - 3...6 segments limit or depends by time need to fly to hole to not overcrowd canvas with lines
