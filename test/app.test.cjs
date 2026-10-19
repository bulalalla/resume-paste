const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const model = require('../src/model.js');
function setup(raw) {
 const nodes = new Map(), storage = new Map(raw ? [['resume-dock:data', raw]] : []), copied = [];
 function element() { return { value:'', textContent:'', children:[], style:{setProperty(){}}, classList:{add(){},remove(){},toggle(){}}, setAttribute(){}, append(...items){this.children.push(...items);}, replaceChildren(){this.children=[];}, showModal(){this.open=true;},close(){this.open=false;},click(){} }; }
 const context = {CopyInteractions:require('../src/interactions.js'),ResumeModel:model,window:{},document:{getElementById(id){if(!nodes.has(id)) nodes.set(id,element());return nodes.get(id);},createElement:element,documentElement:element(),body:element()},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},navigator:{clipboard:{writeText:async t=>copied.push(t)}},structuredClone,setTimeout:()=>0,clearTimeout(){},confirm:()=>true,Blob,URL};
 vm.runInNewContext(fs.readFileSync(require.resolve('../src/app.js'),'utf8'),context);
 return {node:id=>context.document.getElementById(id),storage,copied};
}
test('import, copy raw value, search, update and clear local data',async()=>{
 const app=setup(); app.node('import').onclick(); assert.equal(app.node('editor').open,true);
 app.node('json').value='{'; await app.node('save').onclick(); assert.match(app.node('validation').textContent,/JSON/); assert.equal(app.storage.size,0);
 app.node('json').value=JSON.stringify(model.example); await app.node('save').onclick(); assert.equal(app.node('editor').open,false); assert.ok(app.storage.has('resume-dock:data'));
 await app.node('fields').children[0].children[1].children[0].onclick(); await new Promise(resolve=>setImmediate(resolve)); assert.equal(app.copied[0],'林晓');
 app.node('search').value='TypeScript'; app.node('search').oninput(); assert.ok(app.node('fields').children.length>0);
 app.node('edit').onclick(); assert.equal(app.node('draft-name').value,model.example.name);
 await app.node('reset').onclick(); assert.equal(app.storage.has('resume-dock:data'),false);
});
test('restore persisted resume, safely render HTML as text, and keep demo separate',()=>{
 const data=structuredClone(model.example);data.name='<script>alert(1)</script>';
 const app=setup(JSON.stringify(data)); assert.equal(app.node('resume-name').textContent,data.name);
 app.node('demo').onclick(); app.node('edit').onclick(); assert.equal(app.node('draft-name').value,data.name);
});

test('metadata copies independently while multiline responsibilities copy as one complete value',async()=>{
 const data={version:1,name:'复制测试',sections:[{title:'教育背景',fields:[{label:'学校',value:'示例大学'},{label:'专业',value:'计算机科学'},{label:'入学时间',value:'2023.09'}]},{title:'公司经历',fields:[{label:'公司名称',value:'示例科技'},{label:'职责',value:'第一条职责\n第二条职责'}]}]};
 const app=setup(JSON.stringify(data));
 const blocks=app.node('fields').children; assert.equal(blocks.length,2);
 const first=blocks[0].children[1].children; assert.equal(first.length,3);
 for(const field of first) { await field.onclick(); }
 const second=blocks[1].children[1].children; assert.equal(second.length,2);
 for(const field of second) { await field.onclick(); }
 assert.deepEqual(app.copied,['示例大学','计算机科学','2023.09','示例科技','第一条职责\n第二条职责']);
 app.node('search').value='公司'; app.node('search').oninput(); assert.equal(app.node('fields').children.length,1);
});

test('manually add family and emergency records, omit blanks, and preserve them on JSON import',async()=>{
 const app=setup(JSON.stringify(model.example));app.node('edit').onclick();
 assert.equal(app.node('details-dialog').open,true);
 app.node('preset').value=String(model.templates.findIndex(t=>t.title==='家庭成员'));app.node('add-group').onclick();
 let rows=app.node('draft-fields').children;
 rows[0].children[1].value='父亲';rows[0].children[1].oninput();
 rows[1].children[1].value='示例家属';rows[1].children[1].oninput();
 app.node('preset').value=String(model.templates.findIndex(t=>t.title==='紧急联系人'));app.node('add-group').onclick();
 rows=app.node('draft-fields').children;rows[0].children[1].value='示例联系人';rows[0].children[1].oninput();rows[2].children[1].value='13900139000';rows[2].children[1].oninput();
 app.node('add-field').onclick();rows=app.node('draft-fields').children;const custom=rows.at(-1);custom.children[0].value='联系时段';custom.children[0].oninput();custom.children[1].value='工作日晚间';custom.children[1].oninput();
 await app.node('save-details').onclick();assert.equal(app.node('details-dialog').open,false);
 let data=JSON.parse(app.storage.get('resume-dock:data'));assert.equal(data.sections.at(-2).fields.length,2);assert.equal(data.sections.at(-1).fields.length,3);
 const index=data.sections.findIndex(s=>s.title==='紧急联系人');await app.node('fields').children[index].children[1].children[1].onclick();assert.equal(app.copied.at(-1),'13900139000');
 app.node('import').onclick();const incoming=structuredClone(model.example);incoming.sections[0].fields[1].value='13700137000';app.node('json').value=JSON.stringify(incoming);await app.node('save').onclick();
 data=JSON.parse(app.storage.get('resume-dock:data'));assert.equal(data.sections[0].fields[1].value,'13700137000');assert.equal(data.sections.at(-1).title,'紧急联系人');assert.equal(data.sections.at(-2).title,'家庭成员');
});
test('unsaved edits do not change saved data, and group/field reordering persists',async()=>{
 const app=setup(JSON.stringify(model.example));app.node('edit').onclick();let rows=app.node('draft-fields').children;rows[0].children[1].value='未保存';rows[0].children[1].oninput();assert.equal(JSON.parse(app.storage.get('resume-dock:data')).sections[0].fields[0].value,'林晓');
 app.node('edit').onclick();rows=app.node('draft-fields').children;rows[1].children[2].children[0].onclick();
 await app.node('save-details').onclick();assert.equal(JSON.parse(app.storage.get('resume-dock:data')).sections[0].fields[0].label,'手机');
});

test('legacy responsibility fields and results copy together within their own experience, even during search',async()=>{
 const data={version:1,name:'工作内容复制',sections:[{title:'公司 A',fields:[{label:'公司名称',value:'甲公司'},{label:'工作职责1',value:'开发报名系统'},{label:'工作职责2',value:'完成接口联调'},{label:'工作成果',value:'上线交付'}]},{title:'公司 B',fields:[{label:'公司名称',value:'乙公司'},{label:'主要工作',value:'其他工作'}]}]};
 const app=setup(JSON.stringify(data));const first=app.node('fields').children[0].children[1].children;assert.equal(first.length,2);
 await first[1].onclick();assert.equal(app.copied.at(-1),'开发报名系统\n完成接口联调\n上线交付');
 app.node('search').value='报名';app.node('search').oninput();await app.node('fields').children[0].children[1].children[0].onclick();assert.equal(app.copied.at(-1),'开发报名系统\n完成接口联调\n上线交付');
 assert.equal(JSON.parse(app.storage.get('resume-dock:data')).sections[0].fields.length,4);
});

test('right click copies only binding; missing binding leaves clipboard unchanged',async()=>{
 const raw=JSON.stringify({version:1,name:'材料',sections:[{title:'证明',fields:[{label:'学位证',value:'扫描件',binding:String.raw`C:\证明材料\degree.pdf`},{label:'说明',value:'普通信息'}]}]});const app=setup(raw);const fields=app.node('fields').children[0].children[1].children;let prevented=0;
 await fields[0].onclick();assert.equal(app.copied.at(-1),'扫描件');
 await fields[0].oncontextmenu({type:'contextmenu',button:2,preventDefault(){prevented++;}});assert.equal(app.copied.at(-1),String.raw`C:\证明材料\degree.pdf`);assert.equal(prevented,1);
 await fields[1].oncontextmenu({type:'contextmenu',button:2,preventDefault(){}});assert.equal(app.copied.length,2);assert.match(app.node('toast').textContent,/没有绑定值/);
});
test('custom mouse actions, modifier keyboard actions and disabled actions persist',async()=>{
 const data={version:1,name:'测试',sections:[{title:'材料',fields:[{label:'链接',value:'材料说明',binding:'https://example.com/a.pdf'}]}]};const app=setup(JSON.stringify(data));
 app.node('text-trigger').value='RightClick';app.node('binding-trigger').value='LeftClick';await app.node('save-copy-bindings').onclick();let button=app.node('fields').children[0].children[1].children[0];
 await button.onclick();assert.equal(app.copied.at(-1),'https://example.com/a.pdf');await button.oncontextmenu({type:'contextmenu',button:2,preventDefault(){}});assert.equal(app.copied.at(-1),'材料说明');assert.deepEqual(JSON.parse(app.storage.get('resume-dock:copy-bindings')),{text:'RightClick',binding:'LeftClick'});
 app.node('text-trigger').value='Ctrl+Shift+C';app.node('binding-trigger').value='Ctrl+Shift+P';await app.node('save-copy-bindings').onclick();button=app.node('fields').children[0].children[1].children[0];
 await button.onkeydown({type:'keydown',code:'KeyP',key:'p',ctrlKey:true,shiftKey:true,preventDefault(){}});assert.equal(app.copied.at(-1),'https://example.com/a.pdf');
 const count=app.copied.length;await button.onkeydown({type:'keydown',code:'KeyP',key:'p',ctrlKey:true,shiftKey:true,repeat:true});assert.equal(app.copied.length,count);
 app.node('text-trigger').value='None';app.node('binding-trigger').value='MiddleClick';await app.node('save-copy-bindings').onclick();button=app.node('fields').children[0].children[1].children[0];await button.onclick();assert.equal(app.copied.length,count);await button.onauxclick({type:'auxclick',button:1,preventDefault(){}});assert.equal(app.copied.length,count+1);
 await app.node('reset-copy-bindings').onclick();assert.deepEqual(JSON.parse(app.storage.get('resume-dock:copy-bindings')),{text:'LeftClick',binding:'RightClick'});
});
test('manual binding edit saves independently and bad trigger settings do not replace active mapping',async()=>{
 const app=setup(JSON.stringify({version:1,name:'材料',sections:[{title:'证书',fields:[{label:'证书',value:'扫描件'}]}]}));app.node('edit').onclick();const input=app.node('draft-fields').children[0].children[3].children[0];input.value='/tmp/证明 材料.pdf';input.oninput();await app.node('save-details').onclick();assert.equal(JSON.parse(app.storage.get('resume-dock:data')).sections[0].fields[0].binding,'/tmp/证明 材料.pdf');
 app.node('text-trigger').value='RightClick';app.node('binding-trigger').value='RightClick';await app.node('save-copy-bindings').onclick();assert.match(app.node('copy-bindings-status').textContent,/同一个/);await app.node('fields').children[0].children[1].children[0].onclick();assert.equal(app.copied.at(-1),'扫描件');
});
