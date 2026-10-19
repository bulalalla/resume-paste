// Render the editable SVG using Electron, then package PNG-backed ICO / ICNS.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.join(__dirname, '..');
app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({ width: 1024, height: 1024, show: false, frame: false, transparent: true, backgroundColor: '#00000000', webPreferences: { offscreen: true, contextIsolation: true, sandbox: true } });
    await win.loadFile(path.join(root, 'src/assets/logo.svg'));
    await new Promise(resolve => setTimeout(resolve, 300));
    const image = (await win.webContents.capturePage()).resize({ width: 1024, height: 1024 });
    await fs.mkdir(path.join(root, 'build'), { recursive: true });
    await fs.writeFile(path.join(root, 'src/assets/icon.png'), image.toPNG());
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const chunks = sizes.map(size => image.resize({ width: size, height: size }).toPNG());
    const header = Buffer.alloc(6 + 16 * sizes.length);
    header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
    let offset = header.length;
    sizes.forEach((size, i) => { const entry = 6 + 16 * i; header[entry] = header[entry + 1] = size === 256 ? 0 : size; header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6); header.writeUInt32LE(chunks[i].length, entry + 8); header.writeUInt32LE(offset, entry + 12); offset += chunks[i].length; });
    await fs.writeFile(path.join(root, 'build/icon.ico'), Buffer.concat([header, ...chunks]));
    const macChunks = [[256, 'ic08'], [512, 'ic09'], [1024, 'ic10']].map(([size, type]) => { const png = image.resize({ width: size, height: size }).toPNG(); const head = Buffer.alloc(8); head.write(type); head.writeUInt32BE(png.length + 8, 4); return Buffer.concat([head, png]); });
    const macHeader = Buffer.alloc(8); macHeader.write('icns'); macHeader.writeUInt32BE(8 + macChunks.reduce((sum, b) => sum + b.length, 0), 4);
    await fs.writeFile(path.join(root, 'build/icon.icns'), Buffer.concat([macHeader, ...macChunks]));
    console.log('Generated icon.png (1024px), icon.ico (7 sizes), icon.icns (3 sizes).'); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
