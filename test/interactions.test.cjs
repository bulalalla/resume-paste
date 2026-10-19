const {test}=require('node:test');const assert=require('node:assert/strict');const {normalizeTrigger,normalizeBindings,eventTrigger}=require('../src/interactions.js');
test('normalize mouse, modifier and keyboard triggers without ambiguous bindings',()=>{
 assert.equal(normalizeTrigger('右键'),'RightClick');assert.equal(normalizeTrigger('ctrl + 左键'),'Control+LeftClick');assert.equal(normalizeTrigger('alt+ctrl+k'),'Control+Alt+K');assert.equal(normalizeTrigger('禁用'),'None');
 for(const bad of ['x','ctrl++k','ctrl+leftclick+rightclick','ctrl+ctrl+k','Shift+C',null])assert.throws(()=>normalizeTrigger(bad));
 assert.throws(()=>normalizeBindings({text:'LeftClick',binding:'LeftClick'}));assert.throws(()=>normalizeBindings({text:'Ctrl+Shift+J',binding:'RightClick'}));
});
test('event matching respects exact modifiers and keyboard layouts through physical key codes',()=>{
 assert.equal(eventTrigger({type:'contextmenu',button:2,ctrlKey:true}),'Control+RightClick');assert.equal(eventTrigger({type:'click',button:0,shiftKey:true}),'Shift+LeftClick');assert.equal(eventTrigger({type:'auxclick',button:1}),'MiddleClick');assert.equal(eventTrigger({type:'keydown',code:'KeyP',key:'P',ctrlKey:true,shiftKey:true}),'Control+Shift+P');assert.equal(eventTrigger({type:'keydown',code:'KeyC',key:'c'}),null);
});
