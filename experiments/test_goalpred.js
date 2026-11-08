const { loadPage } = require('./dom_stub.js');
const page = loadPage({});
page.fireWindow('DOMContentLoaded', {});
const ctx = page.context;
// pick a task
const task = ctx.TaskGen.queue[0];
console.log('task', task.side, task.op, task.pct, task.category, task.mode);
ctx.goalOpen(task);
const GV = ctx.GoalView;
// evaluate predicate on goal positions
let onSide=0, inCat=0;
for (let i=0;i<GV.ballCount;i++){
  const left = GV.x[i] < ctx.Sim.CX;
  if (task.side==='left' && !left) continue;
  if (task.side==='right' && left) continue;
  onSide++;
  // category
  let isCat;
  const c = task.category;
  // need colorIndex; we don't have. approximate by color string? Sim colors cold first3
  // Use TaskGen.catHas with color index unknown. Skip cat check; just print counts
}
console.log('onSide', onSide, 'movedCount', GV.movedCount, 'goalSide', GV.goalSide, 'goalMatch', GV.goalMatch);
// check moved balls crossed
let bad=0;
for (let i=0;i<GV.ballCount;i++){
  // original position unknown after build? GV doesn't store original x for moved? It overwrote x. So can't check crossing here.
}
console.log('active', GV.active);
ctx.goalClose();
