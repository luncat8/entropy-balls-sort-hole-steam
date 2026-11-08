const { loadPage } = require('./dom_stub.js');
const page = loadPage({});
page.fireWindow('DOMContentLoaded', {});
const ctx = page.context;
page.runFrames(5,16.7);
// refresh panel to attach handlers
ctx.UI.refreshTaskPanel();
// find hold button
const panel = page.elements.get('task-panel');
console.log('panel html', panel.innerHTML.slice(0,300));
// simulate pointerdown/up on first hold button
const btn = { /* can't easily */ };
// use page.fireElement? need element. dom_stub elements don't include buttons (querySelectorAll returns [])
console.log('no button elements in stub');
