const DEFAULT_COMPACT_SHORTCUT = 'Control+Space';
function normalizeShortcut(input) {
  if (typeof input !== 'string' || input.length > 100) throw new Error('请输入快捷键，例如 Ctrl+Space 或 Ctrl+Alt+K。');
  const aliases = { ctrl:'Control',control:'Control',alt:'Alt',option:'Alt',shift:'Shift',cmd:'Super',command:'Super',super:'Super',meta:'Super',win:'Super',space:'Space','空格':'Space',enter:'Enter',return:'Enter',tab:'Tab',escape:'Escape',esc:'Escape',backspace:'Backspace',delete:'Delete',insert:'Insert',home:'Home',end:'End',pageup:'PageUp',pagedown:'PageDown',up:'Up',down:'Down',left:'Left',right:'Right',plus:'Plus' };
  const parts = input.split('+').map(part => part.trim().toLowerCase());
  if (parts.some(part => !part)) throw new Error('快捷键格式不正确，用 + 连接按键，例如 Ctrl+Space。');
  const keys = parts.map(part => aliases[part] || (/^[a-z0-9]$/.test(part) || /^f([1-9]|1\d|2[0-4])$/.test(part) ? part.toUpperCase() : null));
  const modifiers = ['Control','Alt','Shift','Super'];
  if (keys.includes(null) || new Set(keys).size !== keys.length || !keys.some(key => ['Control','Alt','Super'].includes(key)) || keys.filter(key => !modifiers.includes(key)).length !== 1) throw new Error('需要 Ctrl、Alt 或 Win/Cmd 加一个按键；空格写 Space，例如 Ctrl+Alt+Space。');
  const shortcut = [...modifiers.filter(key => keys.includes(key)), ...keys.filter(key => !modifiers.includes(key))].join('+');
  if (['Control+Shift+J','Shift+Super+J'].includes(shortcut)) throw new Error('该组合用于显示 / 隐藏窗口，请选择其他快捷键。');
  return shortcut;
}
function createShortcutController({ api, initial = DEFAULT_COMPACT_SHORTCUT, onTrigger, persist }) {
  let accelerator = normalizeShortcut(initial), registered = false, queue = Promise.resolve();
  const register = value => { try { return api.register(value,onTrigger); } catch { return false; } };
  const status = () => ({ accelerator, registered, defaultAccelerator: DEFAULT_COMPACT_SHORTCUT });
  function start() { registered = register(accelerator); return status(); }
  async function apply(value) {
    const next = normalizeShortcut(value);
    if (next === accelerator && registered) return status();
    if (!register(next)) throw new Error('该快捷键被其他软件或输入法占用，或当前系统不支持。原快捷键保持不变，请换一个组合。');
    try { await persist(next); } catch (error) { api.unregister(next); throw new Error('快捷键设置保存失败，原快捷键保持不变。'); }
    if (registered) api.unregister(accelerator);
    accelerator = next; registered = true; return status();
  }
  return { start, status, set(value) { const next = queue.then(() => apply(value)); queue = next.catch(() => {}); return next; } };
}
module.exports = { DEFAULT_COMPACT_SHORTCUT, normalizeShortcut, createShortcutController };
