const { loadPage } = require('./dom_stub.js');
const page = loadPage({ search: '?bot0=1&bot1=1&storage=10&holeMoveEnergyCost=10' });
page.fireWindow('DOMContentLoaded', {});
const ctx = page.context;
let minE=[1e9,1e9];
for (let f=0; f<600; f++) {
  page.runFrames(1,16.7);
  for (let i=0;i<2;i++){ if (ctx.Players.list[i].energy < minE[i]) minE[i]=ctx.Players.list[i].energy; }
}
console.log('min energy', minE);
console.log('any negative', minE.some(e=>e<-1e-9));
