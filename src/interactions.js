(function(root){
 const DEFAULT_BINDINGS=Object.freeze({text:'LeftClick',binding:'RightClick'});
 const modifiers=['Control','Alt','Shift','Super'];
 const aliases={ctrl:'Control',control:'Control',alt:'Alt',option:'Alt',shift:'Shift',cmd:'Super',command:'Super',meta:'Super',super:'Super',win:'Super',leftclick:'LeftClick',mouseleft:'LeftClick','左键':'LeftClick',rightclick:'RightClick',mouseright:'RightClick','右键':'RightClick',middleclick:'MiddleClick',mousemiddle:'MiddleClick','中键':'MiddleClick',space:'Space','空格':'Space',enter:'Enter',return:'Enter',tab:'Tab',escape:'Escape',esc:'Escape',backspace:'Backspace',delete:'Delete',insert:'Insert',home:'Home',end:'End',pageup:'PageUp',pagedown:'PageDown',up:'Up',down:'Down',left:'Left',right:'Right',plus:'Plus'};
 function normalizeTrigger(input){
  if(typeof input!=='string'||input.length>100)throw new Error('请输入复制操作，例如 LeftClick、Ctrl+RightClick 或 Ctrl+Shift+C。');
  if(['none','禁用'].includes(input.trim().toLowerCase()))return 'None';
  const parts=input.split('+').map(p=>p.trim().toLowerCase());
  const keys=parts.map(p=>aliases[p]||(/^[a-z0-9]$/.test(p)||/^f([1-9]|1\d|2[0-4])$/.test(p)?p.toUpperCase():null));
  const base=keys.filter(k=>!modifiers.includes(k));
  if(keys.includes(null)||new Set(keys).size!==keys.length||base.length!==1||(!base[0].endsWith('Click')&&!keys.some(k=>['Control','Alt','Super'].includes(k))))throw new Error('使用左 / 右 / 中键，或 Ctrl、Alt、Win/Cmd 加鼠标或键盘，例如 Ctrl+LeftClick、Ctrl+Shift+C。');
  return [...modifiers.filter(k=>keys.includes(k)),base[0]].join('+');
 }
 function normalizeBindings(value){
  if(!value||typeof value!=='object')throw new Error('复制操作设置格式不正确。');
  const result={text:normalizeTrigger(value.text),binding:normalizeTrigger(value.binding)};
  if(result.text!=='None'&&result.text===result.binding)throw new Error('复制文本和复制绑定值不能使用同一个组合。');
  if(Object.values(result).some(k=>['Control+Shift+J','Shift+Super+J'].includes(k)))throw new Error('该组合用于显示 / 隐藏窗口，请使用其他组合。');
  return result;
 }
 function eventTrigger(event){
  if(!event)return 'LeftClick';
  const prefix=[event.ctrlKey?'Control':null,event.altKey?'Alt':null,event.shiftKey?'Shift':null,event.metaKey?'Super':null].filter(Boolean);
  let key;
  if(event.type==='keydown'){
   const code=event.code||'';
   key=/^Key[A-Z]$/.test(code)?code.slice(3):/^Digit\d$/.test(code)?code.slice(5):code==='Space'?'Space':code.startsWith('Arrow')?code.slice(5):event.key;
   try{return normalizeTrigger([...prefix,key].join('+'));}catch{return null;}
  }
  key=event.type==='contextmenu'||event.button===2?'RightClick':event.button===1?'MiddleClick':'LeftClick';
  return [...prefix,key].join('+');
 }
 function triggerLabel(value){return value.replace('LeftClick','左键').replace('RightClick','右键').replace('MiddleClick','中键').replace('Control','Ctrl').replace('Super','Win/Cmd').replace('None','禁用');}
 const api={DEFAULT_BINDINGS,normalizeTrigger,normalizeBindings,eventTrigger,triggerLabel};
 if(typeof module!=='undefined')module.exports=api;else root.CopyInteractions=api;
})(globalThis);
