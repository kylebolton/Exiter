// Renders docs/hero.png (README header): the app icon on a dark background with a soft glow, plus the wordmark.
// Run with Electron: npx electron scripts/make-hero.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const W = 1600, H = 900;
const root = path.join(__dirname, '..');
const icon = fs.readFileSync(path.join(root, 'assets', 'icon.svg'), 'utf8');
const fonts = fs.readFileSync(path.join(root, 'src', 'theme', 'fonts.css'), 'utf8');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${fonts}
html,body{margin:0;width:${W}px;height:${H}px;background:#05050a;overflow:hidden;font-family:"Geist",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.stage{position:relative;width:${W}px;height:${H}px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:
    radial-gradient(900px 520px at 50% 38%, rgba(99,102,241,.30), transparent 70%),
    radial-gradient(700px 420px at 30% 70%, rgba(34,211,238,.10), transparent 70%),
    radial-gradient(700px 420px at 72% 72%, rgba(168,85,247,.12), transparent 70%),
    #05050a}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:64px 64px;
  -webkit-mask-image:radial-gradient(ellipse at 50% 45%,#000 0%,transparent 70%)}
.icon{position:relative;width:420px;height:420px;margin-top:-40px;filter:drop-shadow(0 30px 60px rgba(0,0,0,.6))}
.icon svg{width:100%;height:100%;display:block}
h1{position:relative;margin:6px 0 0;font-weight:600;font-size:76px;letter-spacing:-0.035em;color:#fafafa}
p{position:relative;margin:12px 0 0;font-size:26px;letter-spacing:-0.011em;color:#a1a1aa}
</style></head><body><div class="stage"><div class="grid"></div><div class="icon">${icon}</div><h1>Exiter</h1><p>A quiet, fast desktop client for X</p></div></body></html>`;

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: W, height: H, show: false, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 800));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'hero.png'), img.toPNG());
  app.quit();
});
