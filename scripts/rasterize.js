// Run with Electron: renders an SVG to a transparent PNG using Chromium.
// usage: electron scripts/rasterize.js <in.svg> <out.png> <size>
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const [src, out, sizeArg] = process.argv.slice(-3);
const size = parseInt(sizeArg, 10);

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.resolve(src), 'utf8');
  const html = `<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</div></body></html>`;
  const win = new BrowserWindow({ width: size, height: size, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 300));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  fs.writeFileSync(path.resolve(out), img.toPNG());
  app.quit();
});
