const { app, BrowserWindow, ipcMain, clipboard, globalShortcut, screen, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { parse } = require('./src/model.js');
const { DEFAULT_COMPACT_SHORTCUT, normalizeShortcut, createShortcutController } = require('./shortcuts.cjs');
const { DEFAULT_BINDINGS, normalizeBindings, normalizeTrigger } = require('./src/interactions.js');
let compactShortcut;
let win, compact = false, normalBounds;
const storagePath = () => path.join(app.getPath('userData'), 'resume.json');
function createWindow() {
  compact = false;
  normalBounds = undefined;
  const area = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({ width: Math.min(860, area.width - 48), height: Math.min(1040, area.height - 48), minWidth: 620, minHeight: 180, x: area.x + 24, y: area.y + 24, icon: path.join(__dirname, 'src/assets/icon.png'), frame: false, transparent: true, backgroundColor: '#00000000', alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.loadFile(path.join(__dirname, 'src/index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
}
function setCompact(value) {
  if (Boolean(value) !== compact) {
    compact = Boolean(value);
    if (compact) { normalBounds=win.getBounds(); win.setBounds({...normalBounds,height:180}); }
    else if(normalBounds) win.setBounds(normalBounds);
  }
  const state={compact};win.webContents.send('window:state-changed',state);return state;
}
function toggleCompact() {
  if(!win||win.isDestroyed()){createWindow();win.webContents.once('did-finish-load',()=>setCompact(true));return;}
  if(!win.isVisible()||win.isMinimized())win.showInactive();
  setCompact(!compact);
}
app.whenReady().then(async () => {
  const settingsPath=path.join(app.getPath('userData'),'settings.json');
  let settings = { compactShortcut: DEFAULT_COMPACT_SHORTCUT, copyBindings: { ...DEFAULT_BINDINGS } };
  try { const loaded=JSON.parse(await fs.readFile(settingsPath,'utf8')); settings.compactShortcut=normalizeShortcut(loaded.compactShortcut); try {settings.copyBindings=normalizeBindings(loaded.copyBindings);}catch{} } catch {}
  let settingsQueue=Promise.resolve();
  function saveSettings(patch) {
    const operation=settingsQueue.then(async()=>{
      const next={...settings,...patch};
      if(Object.values(next.copyBindings).includes(normalizeTrigger(next.compactShortcut)))throw new Error('复制操作与全局折叠快捷键不能相同。');
      await fs.writeFile(settingsPath+'.tmp',JSON.stringify(next,null,2),{mode:0o600});await fs.rename(settingsPath+'.tmp',settingsPath);settings=next;return next;
    });settingsQueue=operation.catch(()=>{});return operation;
  }
  compactShortcut=createShortcutController({api:globalShortcut,initial:settings.compactShortcut,onTrigger:toggleCompact,persist:value=>saveSettings({compactShortcut:value})});
  compactShortcut.start();
  ipcMain.handle('shortcuts:get',()=>compactShortcut.status());
  ipcMain.handle('shortcuts:set',(_,value)=>{
    if(Object.values(settings.copyBindings).includes(normalizeTrigger(normalizeShortcut(value))))throw new Error('该组合已用于字段复制，请选择其他折叠快捷键。');
    return compactShortcut.set(value);
  });
  ipcMain.handle('copy-bindings:get',()=>settings.copyBindings);
  ipcMain.handle('copy-bindings:set',async(_,value)=>{
    const bindings=normalizeBindings(value);
    if(Object.values(bindings).includes(normalizeTrigger(compactShortcut.status().accelerator)))throw new Error('字段复制不能使用当前的全局折叠快捷键。');
    await saveSettings({copyBindings:bindings});return settings.copyBindings;
  });
  ipcMain.handle('attachment:pick',async()=>{
    const result=await dialog.showOpenDialog(win,{title:'选择要绑定的证明材料',properties:['openFile']});return result.canceled?null:result.filePaths[0];
  });
  ipcMain.handle('window:state',()=>({compact}));
  ipcMain.handle('resume:load', async () => { try { return { data: parse(await fs.readFile(storagePath(), 'utf8')) }; } catch (error) { return { data: null, error: error.code === 'ENOENT' ? null : '本地简历读取失败，请从备份重新导入。' }; } });
  ipcMain.handle('resume:save', async (_, raw) => { const data = parse(raw); const file = storagePath(); await fs.writeFile(file + '.tmp', JSON.stringify(data, null, 2), { mode: 0o600 }); await fs.rename(file + '.tmp', file); return true; });
  ipcMain.handle('resume:delete', async () => { await fs.rm(storagePath(), { force: true }); return true; });
  ipcMain.handle('clipboard:write', (_, text) => { if (typeof text !== 'string' || text.length > 2100000) throw new Error('复制内容过长'); clipboard.writeText(text); return true; });
  ipcMain.handle('resume:export', async (_, raw) => { const data = parse(raw); const result = await dialog.showSaveDialog(win, { defaultPath: 'resume-backup.json', filters: [{ name: 'JSON', extensions: ['json'] }] }); if (result.canceled) return false; await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), { mode: 0o600 }); return true; });
  ipcMain.handle('window:pin', (_, pinned) => { win.setAlwaysOnTop(Boolean(pinned)); return win.isAlwaysOnTop(); });
  ipcMain.handle('window:compact', (_, value) => setCompact(value));
  ipcMain.handle('window:minimize', () => win.minimize());
  ipcMain.handle('window:close', () => win.close());
  createWindow();
  globalShortcut.register('CommandOrControl+Shift+J', () => { if (!win || win.isDestroyed()) createWindow(); else if (win.isVisible() && !win.isMinimized()) win.hide(); else { win.show(); win.focus(); } });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else win.show(); });
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
