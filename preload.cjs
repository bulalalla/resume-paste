const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  copyBindings: () => ipcRenderer.invoke('copy-bindings:get'),
  setCopyBindings: value => ipcRenderer.invoke('copy-bindings:set',value),
  pickAttachment: () => ipcRenderer.invoke('attachment:pick'),
  shortcuts: () => ipcRenderer.invoke('shortcuts:get'),
  setShortcut: value => ipcRenderer.invoke('shortcuts:set', value),
  windowState: () => ipcRenderer.invoke('window:state'),
  onWindowState: callback => { const listener=(_,state)=>callback(state);ipcRenderer.on('window:state-changed',listener);return ()=>ipcRenderer.removeListener('window:state-changed',listener); },
  load: () => ipcRenderer.invoke('resume:load'),
  save: raw => ipcRenderer.invoke('resume:save', raw),
  remove: () => ipcRenderer.invoke('resume:delete'),
  copy: text => ipcRenderer.invoke('clipboard:write', text),
  export: raw => ipcRenderer.invoke('resume:export', raw),
  pin: value => ipcRenderer.invoke('window:pin', value),
  compact: value => ipcRenderer.invoke('window:compact', value),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close')
});
