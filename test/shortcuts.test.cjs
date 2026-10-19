const {test}=require('node:test');const assert=require('node:assert/strict');
const {normalizeShortcut,createShortcutController,DEFAULT_COMPACT_SHORTCUT}=require('../shortcuts.cjs');
function setup({blocked=[],failSave=false}={}){const bindings=new Map(),saved=[];let triggers=0;const controller=createShortcutController({api:{register(key,fn){if(blocked.includes(key)||bindings.has(key))return false;bindings.set(key,fn);return true;},unregister:key=>bindings.delete(key)},onTrigger:()=>triggers++,persist:async key=>{if(failSave)throw new Error('disk');saved.push(key);}});return{controller,bindings,saved,triggers:()=>triggers};}
test('normalize keys and reject invalid or reserved shortcuts',()=>{
 assert.equal(normalizeShortcut('ctrl + 空格'),DEFAULT_COMPACT_SHORTCUT);assert.equal(normalizeShortcut('alt+ctrl+k'),'Control+Alt+K');assert.equal(normalizeShortcut('Win+F2'),'Super+F2');
 for(const value of ['K','Shift+K','Ctrl+K+L','Ctrl++Space','Ctrl+Ctrl+K','Ctrl+Shift+J','Cmd+Shift+J','Alt+F99',null])assert.throws(()=>normalizeShortcut(value));
});
test('default triggers fold, new shortcut replaces old only after persistence',async()=>{
 const t=setup();assert.equal(t.controller.start().registered,true);t.bindings.get(DEFAULT_COMPACT_SHORTCUT)();assert.equal(t.triggers(),1);
 await t.controller.set('Ctrl+Alt+K');assert.equal(t.bindings.has(DEFAULT_COMPACT_SHORTCUT),false);assert.deepEqual(t.saved,['Control+Alt+K']);t.bindings.get('Control+Alt+K')();assert.equal(t.triggers(),2);
 await t.controller.set(DEFAULT_COMPACT_SHORTCUT);assert.equal(t.bindings.size,1);
});
test('occupied shortcut preserves working binding and saved preference',async()=>{
 const t=setup({blocked:['Control+Alt+K']});t.controller.start();await assert.rejects(t.controller.set('Ctrl+Alt+K'),/占用/);assert.equal(t.controller.status().accelerator,DEFAULT_COMPACT_SHORTCUT);assert.equal(t.bindings.has(DEFAULT_COMPACT_SHORTCUT),true);assert.equal(t.saved.length,0);
});
test('disk errors roll back new binding, and a blocked default can be replaced',async()=>{
 const t=setup({failSave:true});t.controller.start();await assert.rejects(t.controller.set('Ctrl+Alt+K'),/保存失败/);assert.deepEqual([...t.bindings.keys()],[DEFAULT_COMPACT_SHORTCUT]);
 const other=setup({blocked:[DEFAULT_COMPACT_SHORTCUT]});assert.equal(other.controller.start().registered,false);await other.controller.set('Ctrl+Alt+K');assert.equal(other.controller.status().registered,true);
});
test('concurrent updates serialize and leave one active binding',async()=>{
 const t=setup();t.controller.start();await Promise.all([t.controller.set('Ctrl+Alt+K'),t.controller.set('Ctrl+Alt+L')]);assert.deepEqual([...t.bindings.keys()],['Control+Alt+L']);
});
