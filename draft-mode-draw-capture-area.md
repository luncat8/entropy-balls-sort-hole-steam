## add settings:
[] few holes and rooms with colored background that gradually changed ball color to same as this bg. 
room mean some area restricted by walls or wall + canvas border, think what good for game or generate random. for example: wall that cut corner of game field and has big hole in center so balls can pass to it. better not in center but connected to side of canvas. you can generate sometimes zone without walls but not always.

## implement new game mode
in this mode:
by default [x] few holes and rooms with colored background that gradually changed ball color.
[x] highlight trajectories that intersect with player's color

[x] permanent marks from balls on wallCentral 
[x] neutral colors does not draw on wallCentral 

both players has ball guns that move by wall marks of similar color as player's name color.
task is increase own color area.
tactics: push other color balls out of wallCentral
limitations:
- cant pull or push player's colors directly. only neutral colors.
- player 1 R, 2 B colors. and neutral color range green.

universal hole is fixed on top Y near canvas side. 
player 1 and 2 is random on wallCentral and can move by his color area that is initially small. 
balls pass through similar area as it will be hole for similar colors. other colors - recolor area, 
neutral balls settings:
(x) bounce () clean color
