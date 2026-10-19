(()=>{
const $ = id => document.getElementById(id);
const { parse, example, prompt, MAX_SIZE, templates, fromDraft, mergeResumes, displayFields } = ResumeModel;
const { DEFAULT_BINDINGS, normalizeBindings, eventTrigger, triggerLabel } = CopyInteractions;
let copyBindings={...DEFAULT_BINDINGS};
const desktop = window.desktop;
if (!desktop) document.body.classList.add('browser-preview');
let resume = null, saved = null, active = 0, isDemo = false, pinned = true, collapsed = false, timer;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(timer); timer = setTimeout(() => $('toast').classList.remove('visible'), 2400); }
function fail(error) { toast(error.message || '操作失败，请重试'); }
async function copy(text, label = '内容') { try { if (desktop) await desktop.copy(text); else await navigator.clipboard.writeText(text); toast(`已复制${label}`); } catch { toast('剪贴板不可用，请检查系统权限。'); } }
async function activateField(field, event) {
 const trigger=eventTrigger(event);
 const target=Object.keys(copyBindings).find(key=>copyBindings[key]===trigger);
 if(!target)return;
 event?.preventDefault?.();
 if(target==='binding'){
   if(!field.binding)return toast('该字段还没有绑定值，请在「编辑 / 补充」中绑定文件或 URL');
   await copy(field.binding,`${field.label}的绑定值`);
 }else await copy(field.value,field.label);
}
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
function render() {
 $('resume-name').textContent = resume ? resume.name : '你的简历，完整呈现。';
 $('status').textContent = isDemo ? '示例简历 · 每个字段均可单独复制，导入后替换为你的信息' : resume ? `${triggerLabel(copyBindings.text)}复制文本 · ${triggerLabel(copyBindings.binding)}复制绑定值 · 工作内容整段复制` : '导入一次，让每一项信息都在手边。';
 $('tabs').replaceChildren(); $('fields').replaceChildren();
 if (!resume) {
   const w = el('div','welcome');
   w.append(el('span','leaf','⌘'),el('h3','','投递时，不必反复翻找简历。'),el('p','','将 PDF 或 Word 交给你常用的大模型，用配套提示词提取 JSON。导入后，学校、专业、电话、经历等信息都能独立点击复制。'));
   const b = el('button','primary','导入我的简历 →'); b.onclick = openEditor;
   const d = el('button','','手动填写'); d.onclick = openDetails; const sample=el('button','','查看示例'); sample.onclick=showDemo; w.append(b,d,sample); $('fields').append(w); return;
 }
 const q = $('search').value.trim().toLocaleLowerCase(); let count = 0;
 resume.sections.forEach((section,index) => {
   const fields = displayFields(section.fields).filter(f => !q || `${section.title} ${f.label} ${f.value} ${f.binding||''}`.toLocaleLowerCase().includes(q));
   if (!fields.length) return;
   const block = el('section','resume-section'); block.id = `section-${index}`;
   const heading = el('div','group-heading');
   const icon = /教育|学校/.test(section.title) ? '◇' : /实习|工作|公司/.test(section.title) ? '▣' : /项目/.test(section.title) ? '⌘' : /技能|证书|荣誉/.test(section.title) ? '✧' : '◈';
   heading.append(el('span','section-icon',icon),el('h3','',section.title),el('span','section-note','逐项点击复制'));
   const fold=action('⌃','折叠或展开分组',()=>{if(collapsedGroups.has(index))collapsedGroups.delete(index);else collapsedGroups.add(index);render();}); fold.className='fold-group'; fold.disabled=Boolean(q); fold.setAttribute('aria-expanded',String(q?true:!collapsedGroups.has(index))); heading.append(fold);
   block.append(heading);
   const grid = el('div','metadata-grid');
   fields.forEach(field => {
     const long = field.value.includes('\n') || field.value.length > 48 || /描述|职责|成果|评价|介绍|工作内容|主要工作/.test(field.label);
     const button = el('button',long ? 'field field-long' : 'field');
     button.title = `${triggerLabel(copyBindings.text)}：复制文本；${triggerLabel(copyBindings.binding)}：复制绑定值${field.binding?'\n绑定值：'+field.binding:''}`; button.setAttribute('aria-label',`复制${field.label}：${field.value}`);
     button.append(el('span','label',field.label),el('span','value',field.value),el('span','copy-hint',long?'整段复制 ⧉':'⧉'));
     button.onmousedown = event => {if(event.button===1&&Object.values(copyBindings).includes(eventTrigger(event)))event.preventDefault();};
     button.onclick = event => activateField(field,event);
     button.oncontextmenu = event => activateField(field,event);
     button.onauxclick = event => {if(event.button===1)return activateField(field,event);};
     button.onkeydown = event => {if(!event.repeat)return activateField(field,event);};
     if(field.binding)button.append(el('span','attachment-badge','⌁ 已绑定'));
     grid.append(button); count++;
   });
   grid.hidden=!q&&collapsedGroups.has(index); block.append(grid); $('fields').append(block);
   const tab = el('button','','' + section.title);
   tab.onclick = () => {grid.hidden=false;collapsedGroups.delete(index);fold.setAttribute('aria-expanded','true');block.scrollIntoView({behavior:'smooth',block:'start'});}; $('tabs').append(tab);
 });
 if (!count) $('fields').append(el('p','empty','没有找到匹配内容，试试学校、公司或字段名称。'));
}
let draft = null, selectedGroup = 0;
const collapsedGroups = new Set();
function action(text, title, onClick) { const button = el('button','',text); button.type = 'button'; button.title = title; button.setAttribute('aria-label',title); button.onclick = onClick; return button; }
function openDetails() {
 draft = saved ? structuredClone(saved) : { version: 1, name: '我的信息', sections: [] };
 selectedGroup = 0; $('draft-name').value = draft.name; $('draft-validation').textContent = '';
 renderDetails(); $('details-dialog').showModal();
}
function renderGroupList() {
 $('draft-groups').replaceChildren();
 draft.sections.forEach((section,index) => {
  const b = action(section.title || '未命名分组', '编辑分组', () => { selectedGroup = index; renderDetails(); });
  b.className = index === selectedGroup ? 'selected' : ''; b.setAttribute('aria-pressed',String(index === selectedGroup)); $('draft-groups').append(b);
 });
}
function renderDetails() {
 renderGroupList(); $('draft-section-heading').replaceChildren(); $('draft-fields').replaceChildren();
 const section = draft.sections[selectedGroup]; $('add-field').disabled = !section;
 if (!section) { $('draft-fields').append(el('p','empty','从左侧选择模板添加分组，或创建自定义分组。')); return; }
 const title = el('input','section-title-input'); title.value = section.title; title.maxLength = 100; title.setAttribute('aria-label','分组名称'); title.placeholder = '分组名称，例如家庭成员 · 父亲';
 title.oninput = () => { section.title = title.value; renderGroupList(); };
 const controls = el('div','row-actions');
 const moveGroup = delta => { const next = selectedGroup + delta; if (next < 0 || next >= draft.sections.length) return; [draft.sections[selectedGroup],draft.sections[next]] = [draft.sections[next],draft.sections[selectedGroup]]; selectedGroup = next; renderDetails(); };
 const up = action('↑','上移分组',()=>moveGroup(-1)); up.disabled=selectedGroup===0;
 const down = action('↓','下移分组',()=>moveGroup(1)); down.disabled=selectedGroup===draft.sections.length-1;
 const remove = action('删除分组','删除当前分组',()=>{ if (section.fields.some(f=>f.value.trim()) && !confirm('删除此分组及其中的信息？保存后生效。')) return; draft.sections.splice(selectedGroup,1); selectedGroup=Math.max(0,selectedGroup-1); renderDetails(); }); remove.className='danger';
 controls.append(up,down,remove); $('draft-section-heading').append(title,controls);
 section.fields.forEach((field,index) => {
  const row=el('div','draft-field-row'); const label=el('input','field-label-input'); label.value=field.label; label.maxLength=100; label.placeholder='字段名称'; label.setAttribute('aria-label',`字段 ${index+1} 名称`); label.oninput=()=>field.label=label.value;
  const value=el('textarea','field-value-input'); value.value=field.value; value.maxLength=20000; value.rows=1; value.placeholder='未填写，不会显示'; value.setAttribute('aria-label',`字段 ${index+1} 内容`); value.oninput=()=>field.value=value.value;
  const actions=el('div','row-actions'); const move=delta=>{ const next=index+delta; if(next<0||next>=section.fields.length)return; [section.fields[index],section.fields[next]]=[section.fields[next],section.fields[index]]; renderDetails(); };
  const up=action('↑','上移字段',()=>move(-1)); up.disabled=index===0;
  const down=action('↓','下移字段',()=>move(1)); down.disabled=index===section.fields.length-1;
  actions.append(up,down,action('×','删除字段',()=>{section.fields.splice(index,1);renderDetails();})); row.append(label,value,actions);
  const bindingRow=el('div','field-binding-row');const binding=el('input','binding-value-input');binding.value=field.binding||'';binding.maxLength=8192;binding.placeholder='绑定值（可选）：文件完整路径或 URL';binding.setAttribute('aria-label',`字段 ${index+1} 绑定值`);binding.oninput=()=>field.binding=binding.value;
  const choose=action('选择文件','绑定本机文件路径',async()=>{
   if(!desktop)return toast('浏览器无法读取完整本机路径，请手动填写或使用桌面版');
   try{const chosen=await desktop.pickAttachment();if(chosen){field.binding=chosen;binding.value=chosen;}}catch(e){fail(e);}
  });bindingRow.append(binding,choose);row.append(bindingRow);$('draft-fields').append(row);
 });
}
templates.forEach((template,index)=>{const option=el('option','',template.title);option.value=String(index);$('preset').append(option);});
$('add-group').onclick=()=>{
 if(draft.sections.length>=50)return toast('最多支持 50 个分组');
 const template=templates[Number($('preset').value)];
 const base=template?template.title:'自定义分组'; let title=base, suffix=2; while(draft.sections.some(s=>s.title===title))title=`${base} · ${suffix++}`;
 draft.sections.push({title,fields:template?template.labels.map(label=>({label,value:''})):[{label:'',value:''}]}); selectedGroup=draft.sections.length-1;renderDetails();
};
$('add-field').onclick=()=>{const section=draft.sections[selectedGroup];if(section){section.fields.push({label:'',value:''});renderDetails();}};
$('draft-name').oninput=e=>{draft.name=e.target.value;};
$('details-form').onsubmit=e=>e.preventDefault();
$('details-close').onclick=$('details-cancel').onclick=()=>$('details-dialog').close();
async function persist(data) {
 const raw=JSON.stringify(data); if(desktop) await desktop.save(raw); else localStorage.setItem('resume-dock:data',raw);
 saved=resume=data;isDemo=false;active=0;collapsedGroups.clear();$('search').value='';render();
}
$('save-details').onclick=async()=>{
 $('save-details').disabled=true;
 try { draft.name=$('draft-name').value; const data=fromDraft(draft); await persist(data); $('details-dialog').close(); toast('信息已保存，新增字段可独立复制'); }
 catch(e){$('draft-validation').textContent=e.message;}finally{$('save-details').disabled=false;}
};
function openEditor() { $('editor-title').textContent='导入简历 JSON'; $('merge-import').checked=Boolean(saved); $('json').value=saved?JSON.stringify(saved,null,2):''; $('validation').textContent=''; $('file').value=''; $('editor').showModal(); }
function showDemo() { collapsedGroups.clear(); resume=structuredClone(example); isDemo=true; active=0; $('search').value=''; render(); }
$('edit').onclick=openDetails; $('import').onclick=openEditor; $('search').oninput=render;
$('prompt-text').value=prompt; $('prompt').onclick=()=>$('prompt-dialog').showModal(); $('copy-prompt').onclick=()=>copy(prompt,'提取提示词'); $('go-import').onclick=()=>{ $('prompt-dialog').close(); openEditor(); };
$('settings').onclick=()=>{$('settings-dialog').showModal();if(desktop){desktop.shortcuts().then(updateShortcutUI).catch(fail);desktop.copyBindings().then(updateCopyBindingsUI).catch(fail);}}; $('demo').onclick=()=>{ $('settings-dialog').close(); showDemo(); };
$('file').onchange=async e=>{ const file=e.target.files[0]; if (!file) return; try { if (file.size>MAX_SIZE) throw new Error('文件不能超过 2 MB。'); $('json').value=await file.text(); $('validation').textContent=''; } catch(e) { $('validation').textContent=e.message; } };
$('save').onclick=async()=>{ $('save').disabled=true; try { const incoming=parse($('json').value); const data=saved&&$('merge-import').checked?mergeResumes(saved,incoming):incoming; await persist(data); $('editor').close(); toast('简历已保存，点击字段即可复制'); } catch(e) { $('validation').textContent=e.message; } finally { $('save').disabled=false; } };
$('export').onclick=async()=>{ if(!saved) return toast('请先导入并保存自己的简历'); try { const raw=JSON.stringify(saved,null,2); if(desktop) { if(await desktop.export(raw)) toast('备份已导出'); } else { const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})); const a=el('a'); a.href=url; a.download='resume-backup.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast('已开始下载备份'); } } catch(e) { fail(e); } };
$('reset').onclick=async()=>{ if(!confirm('确定清除已保存的简历？建议先导出备份。')) return; try { if(desktop) await desktop.remove(); else localStorage.removeItem('resume-dock:data'); resume=saved=null; isDemo=false; active=0; $('search').value=''; render(); $('settings-dialog').close(); toast('本机简历已清除'); } catch(e) { fail(e); } };
$('pin').onclick=async()=>{ if(!desktop) return toast('浏览器预览不支持置顶，请使用桌面版'); try { pinned=await desktop.pin(!pinned); $('pin').classList.toggle('active',pinned); $('pin').setAttribute('aria-pressed',String(pinned)); $('pin').title=pinned?'取消窗口置顶':'开启窗口置顶'; } catch(e) { fail(e); } };
let suspendedDialogs=[];
function syncCompact(state) {
 if(typeof state.compact!=='boolean')return;
 const changed=collapsed!==state.compact; collapsed=state.compact;
 if(changed&&collapsed){suspendedDialogs=[...document.querySelectorAll('dialog[open]')];suspendedDialogs.forEach(dialog=>dialog.close());}
 document.body.classList.toggle('compact',collapsed);$('compact').title=collapsed?'展开窗口':'折叠窗口';$('compact').setAttribute('aria-expanded',String(!collapsed));
 if(changed&&!collapsed){const dialogs=suspendedDialogs;suspendedDialogs=[];dialogs.forEach(dialog=>{if(!dialog.open)dialog.showModal();});}
}
$('compact').onclick=async()=>{try{syncCompact(desktop?await desktop.compact(!collapsed):{compact:!collapsed});}catch(e){fail(e);}};
function shortcutLabel(value){return value.replace('Control','Ctrl').replace('Super','Super');}
function updateShortcutUI(state){
 $('compact-shortcut').value=shortcutLabel(state.accelerator);$('compact-hint').textContent=state.registered?`${shortcutLabel(state.accelerator)} 折叠`:'折叠快捷键不可用 · 设置中修改';
 $('shortcut-status').textContent=state.registered?'已启用，重启后保留。':'注册失败：可能已被输入法或其他软件占用，请更换组合键。';
 $('compact-hint').title='可在「备份与设置」中自定义折叠快捷键';
}
async function saveShortcut(value){
 if(!desktop)return toast('全局快捷键需要桌面版');
 $('save-shortcut').disabled=$('reset-shortcut').disabled=true;
 try{const state=await desktop.setShortcut(value);updateShortcutUI(state);toast('折叠快捷键已更新');}catch(e){$('shortcut-status').textContent=e.message;}finally{$('save-shortcut').disabled=$('reset-shortcut').disabled=false;}
}
$('save-shortcut').onclick=()=>saveShortcut($('compact-shortcut').value);
$('reset-shortcut').onclick=()=>saveShortcut('Control+Space');
$('compact-shortcut').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveShortcut(e.target.value);}};
if(desktop){
 desktop.onWindowState(syncCompact);
 desktop.windowState().then(syncCompact).catch(fail);
 desktop.shortcuts().then(state=>{updateShortcutUI(state);if(!state.registered)toast('折叠快捷键注册失败，请到设置中更换');}).catch(fail);
}else{
 $('compact-hint').textContent='全局快捷键需要桌面版';$('compact-shortcut').disabled=true;
}
function updateCopyBindingsUI(bindings){
 copyBindings=normalizeBindings(bindings);$('text-trigger').value=copyBindings.text;$('binding-trigger').value=copyBindings.binding;
 $('copy-bindings-status').textContent=`${triggerLabel(copyBindings.text)}复制文本；${triggerLabel(copyBindings.binding)}复制绑定值。键盘组合需先聚焦字段。`;render();
}
async function saveCopyBindings(bindings){
 $('save-copy-bindings').disabled=$('reset-copy-bindings').disabled=true;
 try{const normalized=normalizeBindings(bindings);if(desktop)await desktop.setCopyBindings(normalized);else localStorage.setItem('resume-dock:copy-bindings',JSON.stringify(normalized));updateCopyBindingsUI(normalized);toast('复制操作已更新');}
 catch(e){$('copy-bindings-status').textContent=e.message;}finally{$('save-copy-bindings').disabled=$('reset-copy-bindings').disabled=false;}
}
$('save-copy-bindings').onclick=()=>saveCopyBindings({text:$('text-trigger').value,binding:$('binding-trigger').value});
$('reset-copy-bindings').onclick=()=>saveCopyBindings(DEFAULT_BINDINGS);
if(desktop)desktop.copyBindings().then(updateCopyBindingsUI).catch(fail);
else{try{const raw=localStorage.getItem('resume-dock:copy-bindings');if(raw)copyBindings=normalizeBindings(JSON.parse(raw));}catch{}updateCopyBindingsUI(copyBindings);}
$('minimize').onclick=()=>desktop?desktop.minimize().catch(fail):toast('最小化需要桌面版'); $('close').onclick=()=>desktop?desktop.close().catch(fail):toast('请关闭当前浏览器标签页');
function opacity(v) { document.documentElement.style.setProperty('--panel-alpha',String(Number(v)/100)); $('opacity').value=v; $('opacity-value').textContent=`${v}%`; }
$('opacity').oninput=e=>{ opacity(e.target.value); try { localStorage.setItem('resume-dock:opacity',e.target.value); } catch {} };
(async()=>{ try { const v=Number(localStorage.getItem('resume-dock:opacity')); if(v>=40&&v<=100) opacity(v); if(desktop) { const r=await desktop.load(); resume=saved=r.data; if(r.error) toast(r.error); } else { const raw=localStorage.getItem('resume-dock:data'); if(raw) resume=saved=parse(raw); $('shortcut').textContent='浏览器预览模式'; } } catch { toast('本地数据读取失败，请重新导入备份'); } render(); })();

})();
