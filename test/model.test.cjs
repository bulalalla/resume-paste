const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse,example,MAX_SIZE}=require('../src/model.js');
test('import example and Markdown JSON',()=>{assert.deepEqual(parse(JSON.stringify(example)),example);assert.deepEqual(parse('```json\n'+JSON.stringify(example)+'\n```'),example);});
test('reject malformed data and oversized input',()=>{for(const v of ['null','{}','[]','{',JSON.stringify({...example,version:2}),JSON.stringify({...example,sections:[]}),JSON.stringify({...example,sections:[{title:'信息',fields:[{label:'年龄',value:22}]}]}),' '.repeat(MAX_SIZE+1)])assert.throws(()=>parse(v));});
test('preserve multiline fields and remove unknown properties',()=>{const v={version:1,name:' A ',extra:1,sections:[{title:' B ',fields:[{label:' C ',value:' 一\n二 ',extra:1}]}]};assert.deepEqual(parse(JSON.stringify(v)),{version:1,name:'A',sections:[{title:'B',fields:[{label:'C',value:'一\n二'}]}]});});
test('HTML stays plain text',()=>{const v=structuredClone(example);v.sections[0].fields[0].value='<img src=x onerror=alert(1)>';assert.equal(parse(JSON.stringify(v)).sections[0].fields[0].value,'<img src=x onerror=alert(1)>');});

test('optional template fields are pruned and supplied fields require labels',()=>{
 const {fromDraft,templates}=require('../src/model.js');assert.ok(templates.some(t=>t.title==='家庭成员'));assert.ok(templates.some(t=>t.title==='紧急联系人'));
 assert.deepEqual(fromDraft({name:'我',sections:[{title:'家庭',fields:[{label:'姓名',value:' 张先生 '},{label:'单位',value:''}]},{title:'空分组',fields:[{label:'空',value:' ' }]}]}),{version:1,name:'我',sections:[{title:'家庭',fields:[{label:'姓名',value:'张先生'}]}]});
 assert.throws(()=>fromDraft({name:'我',sections:[{title:'家庭',fields:[{label:'',value:'有内容'}]}]}),/名称/);
 assert.throws(()=>fromDraft({name:'我',sections:[]}),/至少/);
});
test('merge updates matching occurrences without losing manual/custom information',()=>{
 const {mergeResumes}=require('../src/model.js');
 const old={version:1,name:'旧',sections:[{title:'技能',fields:[{label:'语言',value:'A'},{label:'语言',value:'B'},{label:'自定义',value:'保留'}]},{title:'家庭成员',fields:[{label:'姓名',value:'家属'}]}]};
 const incoming={version:1,name:'新',sections:[{title:'技能',fields:[{label:'语言',value:'C'},{label:'语言',value:'D'}]}]};
 const result=mergeResumes(old,incoming);assert.equal(result.name,'新');assert.deepEqual(result.sections[0].fields.map(f=>f.value),['C','D','保留']);assert.equal(result.sections[1].fields[0].value,'家属');assert.equal(old.sections[0].fields[0].value,'A');
});

test('display groups responsibilities without mutating stored data or merging metadata',()=>{
 const {displayFields,prompt}=require('../src/model.js');const fields=[{label:'姓名',value:'A'},{label:'职责（一）',value:'第一条\n下一行'},{label:'工作职责 2',value:'第二条'},{label:'工作成果',value:'成果'},{label:'技能',value:'JS'},{label:'技能',value:'CSS'}];const result=displayFields(fields);
 assert.deepEqual(result,[{label:'姓名',value:'A'},{label:'主要工作',value:'第一条\n下一行\n第二条\n成果'},{label:'技能',value:'JS'},{label:'技能',value:'CSS'}]);assert.equal(fields[1].label,'职责（一）');assert.ok(prompt.includes('不要将每条职责拆成独立字段'));
});

test('new full work text replaces legacy fragments on merge without duplicating or losing custom fields',()=>{
 const {mergeResumes,displayFields}=require('../src/model.js');const old={version:1,name:'我',sections:[{title:'实习',fields:[{label:'公司',value:'A'},{label:'工作职责',value:'旧一'},{label:'工作成果',value:'旧二'},{label:'自定义补充',value:'保留'}]}]};
 const incoming={version:1,name:'我',sections:[{title:'实习',fields:[{label:'主要工作',value:'新一\n新二'}]}]};
 const result=mergeResumes(old,incoming);assert.deepEqual(displayFields(result.sections[0].fields).map(f=>f.value),['A','保留','新一\n新二']);assert.equal(old.sections[0].fields.length,4);
});

test('optional bindings survive parsing, manual edits and JSON roundtrips',()=>{
 const {fromDraft}=require('../src/model.js');const binding=String.raw`C:\证明材料\学位证.pdf`;
 const data={version:1,name:'材料',sections:[{title:'证明材料',fields:[{label:'学位证',value:'学位证扫描件',binding}]}]};assert.deepEqual(parse(JSON.stringify(data)),data);
 assert.equal(fromDraft({name:'材料',sections:[{title:'材料',fields:[{label:'学位证',value:'',binding}]}]}).sections[0].fields[0].value,'学位证');
 assert.equal(fromDraft(data).sections[0].fields[0].binding,binding);
 for(const bad of [42,null,'a\nb','a\rb','a\0b','x'.repeat(8193)]){const invalid=structuredClone(data);invalid.sections[0].fields[0].binding=bad;assert.throws(()=>parse(JSON.stringify(invalid)),/绑定值/);}
});
test('merging keeps existing attachment when import omits it and supports explicit clearing',()=>{
 const {mergeResumes}=require('../src/model.js');const old={version:1,name:'A',sections:[{title:'材料',fields:[{label:'学位证',value:'旧文本',binding:'https://example.com/degree.pdf'}]}]};
 const incoming={version:1,name:'A',sections:[{title:'材料',fields:[{label:'学位证',value:'新文本'}]}]};assert.equal(mergeResumes(old,incoming).sections[0].fields[0].binding,old.sections[0].fields[0].binding);
 incoming.sections[0].fields[0].binding='';assert.equal(mergeResumes(old,incoming).sections[0].fields[0].binding,'');
});
test('bound work fields remain separate and are never silently discarded by merging',()=>{
 const {displayFields,mergeResumes}=require('../src/model.js');const fields=[{label:'工作职责',value:'职责 A',binding:'A.pdf'},{label:'工作成果',value:'成果 B',binding:'B.pdf'}];assert.deepEqual(displayFields(fields),fields);
 const old={version:1,name:'A',sections:[{title:'工作',fields}]};const incoming={version:1,name:'A',sections:[{title:'工作',fields:[{label:'主要工作',value:'新正文'}]}]};assert.deepEqual(mergeResumes(old,incoming).sections[0].fields.slice(0,2),fields);
});
