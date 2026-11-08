const { loadPage } = require('./dom_stub.js');
const page = loadPage({ search: '?ballCount=200&ballSpeed=400&holeSize=16&generation=5' });
page.fireWindow('DOMContentLoaded', {});
const ctx = page.context;
let errors=0;
for (let f=0; f<1200; f++) {
  // random inputs
  if (f%7===0) ctx.Input && (ctx.Sim.hole.targetY = 100 + (f*37)%600);
  page.runFrames(1, 16.7);
  // check
  for (let i=0;i<ctx.Sim.MAX_BALLS;i++){
    const b=ctx.Sim.balls[i];
    if (!b.active) continue;
    if (isNaN(b.x)||isNaN(b.y)||isNaN(b.vx)||isNaN(b.vy)) { errors++; console.log('NaN frame',f,i); break; }
    if (b.x < -5 || b.x > ctx.Sim.W+5 || b.y < -5 || b.y > ctx.Sim.H+5) { errors++; console.log('oob frame',f,i,b.x,b.y); break; }
  }
  if (errors>5) break;
}
console.log('frames done, errors', errors, 'ballCount', ctx.Sim.ballCount, 'fps', ctx.Loop.fps);
// test goal open/close loop
for (let k=0;k<5;k++){
  const t = ctx.TaskGen.queue[k % ctx.TaskGen.queue.length];
  ctx.goalOpen(t);
  page.runFrames(3,16.7);
  ctx.goalClose();
}
console.log('goal loop ok');
// test settings url roundtrip
ctx.Settings.ballCount = 50;
ctx.applySettings();
console.log('url', ctx.location.search);
