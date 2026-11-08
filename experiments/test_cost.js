const { loadPage } = require('./dom_stub.js');
const page = loadPage({ search: '?ballCount=200' });
page.fireWindow('DOMContentLoaded', {});
const ctx = page.context;
const costs = {};
for (let side of ['left','right']) {
  for (let op of ['>','<']) {
    for (let cat of ['cold','hot']) {
      for (let pct of ctx.TaskGen.PCTS) {
        const c = ctx.TaskGen.cost(cat, op, pct, side==='left');
        costs[c] = (costs[c]||0)+1;
      }
    }
  }
}
console.log('cost histogram', costs);
console.log('costMax', ctx.TaskGen.costMax());
