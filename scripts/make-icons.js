// Rasterises assets/*.svg into the PNG/ICNS/ICO files used by the app and installers.
// Requires ImageMagick (`magick`) and, for .icns, macOS `iconutil`.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const run = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: root });
const png = (src, out, size) =>
  run(`npx electron scripts/rasterize.js ${src} ${out} ${size}`);

png('assets/icon.svg', 'build/icon.png', 1024);
png('assets/icon.svg', 'assets/icon.png', 512);
png('assets/icon-small.svg', 'build/icon-small.png', 64);
png('assets/tray.svg', 'assets/trayTemplate.png', 18);
png('assets/tray.svg', 'assets/trayTemplate@2x.png', 36);

run('magick build/icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico');

if (process.platform === 'darwin') {
  const set = path.join(root, 'build', 'icon.iconset');
  fs.rmSync(set, { recursive: true, force: true });
  fs.mkdirSync(set, { recursive: true });
  for (const s of [16, 32, 128, 256, 512]) {
    const src = s <= 32 ? 'assets/icon-small.svg' : 'assets/icon.svg';
    const src2x = s * 2 <= 64 ? 'assets/icon-small.svg' : 'assets/icon.svg';
    png(src, `build/icon.iconset/icon_${s}x${s}.png`, s);
    png(src2x, `build/icon.iconset/icon_${s}x${s}@2x.png`, s * 2);
  }
  run('iconutil -c icns build/icon.iconset -o build/icon.icns');
  fs.rmSync(set, { recursive: true, force: true });
}
