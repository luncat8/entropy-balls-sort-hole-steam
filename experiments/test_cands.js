const { loadPage } = require('./dom_stub.js');
const page = loadPage({ search: '?ballCount=200' });
page.fireWindow('DOMContentLoaded', {});
const ctx = page.context;
// replicate candidate generation quickly by monkey? Instead inspect TaskGen.generate internals via adding debug
const orig = ctx.TaskGen.inBand;
let costs=[];
const origGen = ctx.TaskGen.generate;
ctx.TaskGen.generate = function(prev, avoid) {
  // call original but capture? no. Instead just call and inspect result cost
  const t = origGen.call(this, prev, avoid);
  return t;
};
// sample 500 tasks and record cost/difficulty
const hist={};
for (let i=0;i<500;i++){
  const t = ctx.TaskGen.generate(null, []);
  hist[t.difficulty+' cost'+t.cost] = (hist[t.difficulty+' cost'+t.cost]||0)+1;
}
console.log(Object.keys(hist).sort());
