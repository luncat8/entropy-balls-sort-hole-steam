const { loadPage } = require('./dom_stub.js');
const page = loadPage({});
page.fireWindow('DOMContentLoaded', {});
const ctx = page.context;
const labels = {};
for (let i=0;i<200;i++) {
  const t = ctx.TaskGen.generate(null, []);
  labels[t.difficulty] = (labels[t.difficulty]||0)+1;
}
console.log('label distribution', labels);
// check no identical consecutive? generate avoids prev
const t1 = ctx.TaskGen.generate(null, []);
const t2 = ctx.TaskGen.generate(t1, []);
console.log('same?', ctx.TaskGen.same(t1,t2));
