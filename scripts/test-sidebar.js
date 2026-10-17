// Exercise the shipped CSS in Chromium, including badges arriving after first paint.
const { app, BrowserWindow } = require('electron');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    const css = ['tokens', 'shell', 'nav'].map(name => readFileSync(path.join(__dirname, '..', 'src', 'theme', `${name}.css`), 'utf8')).join('\n');
    // X puts labels next to the icon wrapper and unread badges inside it.
    await win.loadURL('data:text/html,' + encodeURIComponent(`
      <style>body{margin:0} div,header,main,nav,a{display:flex;flex-direction:column}
      #layout{flex-direction:row} nav a>div{flex-direction:row}
      @media(max-width:1259px){.label{display:none}}
      ${css}</style>
      <div id="layout"><header role="banner"><div><div><div>
      <nav>${['home', 'notifications', 'i/chat'].map(route => `<a href="/${route}"><div><div class="icon"><svg></svg></div><div class="label"><span>${route}</span></div></div></a>`).join('')}</nav>
      <a data-testid="SideNav_NewTweet_Button"><svg></svg></a>
      <button data-testid="SideNav_AccountSwitcher_Button">Account</button>
      </div></div></div></header><main role="main"><div data-testid="primaryColumn">Timeline</div></main></div>`));
    // Like X, actually remove the labels at the compact breakpoint rather than hide them.
    await win.webContents.executeJavaScript(`document.querySelectorAll('.label').forEach(el => el.remove());`);
    let cases = 0;
    for (const width of [700, 1000, 1440]) {
      win.setContentSize(width, 900);
      for (const labelled of [false, true]) {
        await win.webContents.executeJavaScript(`
          document.querySelectorAll('nav a > div').forEach(row => {
            row.querySelector('.label')?.remove();
            if (${labelled}) { const label=document.createElement('div'); label.className='label'; label.innerHTML='<span>Navigation label</span>'; row.append(label); }
          });`);
        for (const count of ['', '1', '2', '99+', '']) {
          const actual = await win.webContents.executeJavaScript(`(() => {
            document.querySelectorAll('.icon').forEach(icon => {
              icon.querySelector('.badge')?.remove();
              if (${JSON.stringify(count)}) {const badge=document.createElement('div'); badge.className='badge'; badge.innerHTML='<span>${count}</span>'; icon.append(badge);}
            });
            const width = sel => document.querySelector(sel).getBoundingClientRect().width;
            return { sidebar: width('header'), post: width('[data-testid="SideNav_NewTweet_Button"]'), account: width('[data-testid="SideNav_AccountSwitcher_Button"]'), feedLeft: document.querySelector('main').getBoundingClientRect().left };
          })()`);
          const sidebar = labelled ? 220 : 88;
          assert.deepEqual(actual, { sidebar, post: labelled ? 176 : 40, account: labelled ? 176 : 40, feedLeft: sidebar }, `viewport=${width}, labels=${labelled}, badge=${count}`);
          cases++;
        }
      }
    }
    console.log(`Passed ${cases} sidebar layout cases (labelled/icon rail, badge arrival/change/removal, three window widths).`);
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
