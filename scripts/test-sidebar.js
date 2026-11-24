// Exercise the shipped preload and CSS in Chromium, without an X account or network requests.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

app.whenReady().then(async () => {
  const settings = {
    theme: 'light', accent: 'zinc', radius: 8, fontSize: 15, density: 'comfortable',
    feedWidth: 'fill', mediaMax: 620, fontFamily: 'geist', lineHeight: 'normal',
    caps: 'names', hideRightRail: true, nav: {}, uiZoom: 100,
  };
  const theme = ['tokens', 'shell', 'nav', 'feed', 'cards', 'composer', 'overlays', 'pages', 'search', 'motion', 'loading', 'hide'];
  const css = theme.map(name => readFileSync(path.join(__dirname, '..', 'src', 'theme', `${name}.css`), 'utf8')).join('\n');
  ipcMain.on('exiter:get-css', event => { event.returnValue = css; });
  ipcMain.on('exiter:get-settings-sync', event => { event.returnValue = settings; });
  ipcMain.on('exiter:get-fonts', event => { event.returnValue = []; });
  ipcMain.handle('exiter:get-settings', () => settings);
  const workspaces = new Map();
  const workspace = account => {
    if (!workspaces.has(account)) workspaces.set(account, { pins: [] });
    return workspaces.get(account);
  };
  ipcMain.handle('exiter:workspace', (_event, account) => workspace(account));
  ipcMain.on('exiter:reading-position', (_event, account, position) => { workspace(account).reading = position; });
  ipcMain.handle('exiter:toggle-pin', (_event, account, pin) => {
    const data = workspace(account);
    const index = data.pins.findIndex(item => item.route === pin.route);
    if (index >= 0) data.pins.splice(index, 1);
    else data.pins.push(pin);
    return data.pins;
  });
  const testSession = session.fromPartition('exiter-layout-test');
  const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="gray"/></svg>');
  const fixture = `<!doctype html><html><head><style>
    body{margin:0} div,header,main,nav,a,section{display:flex;flex-direction:column;box-sizing:border-box}
    #layout{flex-direction:row} .fixed-nav{position:fixed;left:200px;width:275px}
    nav a>div{flex-direction:row}.icon svg{width:24px;height:24px}
    #outer{max-width:1180px;margin:auto} .column-wrapper{width:600px;max-width:600px;align-self:center}
    .timeline{width:600px;max-width:600px;align-self:center}
    #columns{flex-direction:row} [data-testid="sidebarColumn"]{width:300px;flex-shrink:0}
    #media{width:100%;max-width:300px} #media img{width:100%;height:auto}
    #layer{position:fixed;inset:0} [role="dialog"]{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
    .close-wrapper{position:absolute;left:0;top:0;padding:12px}
    .native-close{background:black;color:white;border-radius:50%;width:32px;height:32px}
    .native-close svg{fill:currentColor;width:24px;height:24px}
    .media-stage{position:absolute;left:0;top:0;width:calc(100% - 350px);height:100%;z-index:0}
    .reply-panel{position:absolute;right:0;top:0;width:350px;height:100%;z-index:1;background:white}
    @media(max-width:1259px){.label{display:none}}
  </style></head><body><div id="react-root"><div id="outer"><div id="layout">
    <header role="banner"><div><div class="fixed-nav"><div>
      <nav>${['home', 'notifications', 'i/chat'].map(route => `<a role="link" aria-label="${route}" href="/${route}"><div><div class="icon"><svg></svg></div><div class="label"><span>${route}</span></div></div></a>`).join('')}</nav>
      <a aria-label="Post" data-testid="SideNav_NewTweet_Button"><div><span>Post</span></div></a>
      <button aria-label="Account menu" data-testid="SideNav_AccountSwitcher_Button"><div><div data-testid="UserAvatar-Container-user"><img alt="Avatar" src="${image}"></div><div class="account-name">Account</div></div><svg></svg></button>
    </div></div></div></header>
    <main role="main"><div><div><div class="column-wrapper"><div id="columns"><div data-testid="primaryColumn">
      <section class="timeline" aria-label="Timeline: Home"><div><div data-testid="cellInnerDiv"><article><div id="media" data-testid="tweetPhoto"><img alt="Media" src="${image}"></div></article></div></div></section>
    </div><div data-testid="sidebarColumn">Right rail</div></div></div></div></div></main>
  </div></div></div><div id="layer"></div></body></html>`;
  testSession.protocol.handle('https', () => new Response(fixture, { headers: { 'content-type': 'text/html' } }));
  const win = new BrowserWindow({ show: false, webPreferences: {
    sandbox: true, session: testSession, backgroundThrottling: false,
    preload: path.join(__dirname, '..', 'src', 'preload.js'),
  } });
  const evaluate = code => win.webContents.executeJavaScript(code);
  // Wait for the renderer's throttled layout pass, including asynchronous DOM arrivals.
  const settle = () => evaluate(`new Promise(resolve => setTimeout(() => requestAnimationFrame(resolve), 150))`);
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1, `${message}: ${actual} != ${expected}`);
  try {
    await win.loadURL('https://x.com/home');
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
    await settle();
    let cases = 0;
    for (const width of [700, 1000, 1260, 1440, 1920, 1440, 1260, 1000, 700]) {
      win.setContentSize(width, 900);
      for (const labelled of [false, true]) {
        await evaluate(`document.querySelectorAll('nav a > div').forEach(row => {
          row.querySelector('.label')?.remove();
          if (${labelled}) { const label=document.createElement('div'); label.className='label'; label.innerHTML='<span>Navigation label</span>'; row.append(label); }
        });`);
        await settle();
        for (const count of ['', '1', '2', '99+', '']) {
          const actual = await evaluate(`(() => {
            document.querySelectorAll('.icon').forEach(icon => {
              icon.querySelector('.badge')?.remove();
              if (${JSON.stringify(count)}) {const badge=document.createElement('div'); badge.className='badge'; badge.innerHTML='<span>${count}</span>'; icon.append(badge);}
            });
            const rect = sel => document.querySelector(sel).getBoundingClientRect();
            return { sidebar: rect('header').width, railLeft: rect('.fixed-nav').left,
              post: rect('[data-testid="SideNav_NewTweet_Button"]').width,
              account: rect('[data-testid="SideNav_AccountSwitcher_Button"]').width,
              feedLeft: rect('main').left, feedRight: rect('[data-testid="primaryColumn"]').right,
              timeline: rect('.timeline').width, primary: rect('[data-testid="primaryColumn"]').width,
              overflow: document.documentElement.scrollWidth > innerWidth,
              labelsVisible: [...document.querySelectorAll('.label')].some(el => el.getBoundingClientRect().width > 0),
              badgeVisible: [...document.querySelectorAll('.badge')].every(el => el.getBoundingClientRect().width > 0),
              accountTextVisible: rect('.account-name').width > 0,
              postIcon: !!document.querySelector('[data-testid="SideNav_NewTweet_Button"] svg[data-exiter-icon="squarePen"]'),
              media: rect('#media').width, imageHeight: rect('#media img').height };
          })()`);
          const context = `viewport=${width}, labels=${labelled}, badge=${count}`;
          assert.deepEqual(actual, { sidebar: 88, railLeft: 0, post: 40, account: 40, feedLeft: 88,
            feedRight: width, timeline: width - 89, primary: width - 88, overflow: false,
            labelsVisible: false, badgeVisible: true, accountTextVisible: false, postIcon: true,
            media: 300, imageHeight: 150 }, context);
          cases++;
        }
      }
    }
    win.setContentSize(1440, 900);
    for (const [mode, expected] of [['medium', 760], ['narrow', 600], ['fill', 1352]]) {
      await evaluate(`document.documentElement.setAttribute('data-ex-feed', '${mode}')`);
      await settle();
      const width = await evaluate(`document.querySelector('main').getBoundingClientRect().width`);
      near(width, expected, `${mode} feed width`);
    }
    // Width limits arriving below the initial render and beyond main's immediate children.
    // Replacing the content must still trigger the actual preload sweep.
    await evaluate(`document.querySelector('.timeline > div').insertAdjacentHTML('afterbegin', '<div id="late-content" style="max-width:600px;width:600px">Late content</div>')`);
    await settle();
    near(await evaluate(`document.querySelector('#late-content').getBoundingClientRect().width`), 1351, 'late timeline content');

    // X can mount its own Post SVG after our fallback and can replace it again on resize.
    for (const native of [true, false, true]) {
      await evaluate(`(() => {const row=document.querySelector('[data-testid="SideNav_NewTweet_Button"] > div');row.querySelector('.native-post')?.remove();if(${native})row.insertAdjacentHTML('beforeend', '<div class="native-post"><svg></svg><svg></svg></div>');})()`);
      await settle();
      assert.equal(await evaluate(`[...document.querySelectorAll('[data-testid="SideNav_NewTweet_Button"] svg')].filter(svg=>getComputedStyle(svg).display!=='none').length`), 1, 'exactly one Post icon after native mount/removal');
    }

    for (const theme of ['light', 'dark']) {
      for (const route of ['/user/photo', '/user/status/123/photo/1', '/user/header_photo']) {
        win.webContents.sendInputEvent({ type:'mouseMove', x:500, y:500 });
        await evaluate(`(() => {
          document.documentElement.setAttribute('data-ex-theme', '${theme}');
          history.pushState({}, '', '${route}');
          document.querySelector('#layer').innerHTML='<div role="dialog" aria-label="Image viewer"><div class="close-wrapper"><button class="native-close" aria-label="Close" data-testid="app-bar-close"><div><svg viewBox="0 0 24 24"><path d="M0 0h24v24z"/></svg></div></button></div><div class="image-wrapper"><img alt="Image" src="${image}"></div></div>';
          if (location.pathname.includes('/status/')) {
            const dialog=document.querySelector('[role="dialog"]'), stage=document.createElement('div');
            stage.className='media-stage'; stage.append(...dialog.children); dialog.append(stage);
            dialog.insertAdjacentHTML('beforeend', '<div class="reply-panel"><div contenteditable="true" aria-label="Reply"></div></div>');
          }
        })()`);
        await settle();
        const actual = await evaluate(`(() => {
          const dialog=document.querySelector('[role="dialog"]'), button=dialog.querySelector('button'), svg=button.querySelector('svg');
          const cs=getComputedStyle(button), wrapper=getComputedStyle(button.parentElement), rect=button.getBoundingClientRect();
          return { tagged: dialog.hasAttribute('data-exiter-media-viewer'), width:rect.width, height:rect.height,
            right:innerWidth-rect.right, top:rect.top, iconWidth:svg.getBoundingClientRect().width,
            icon:svg.getAttribute('data-exiter-icon'), fill:getComputedStyle(svg).fill,
            color:getComputedStyle(svg).color, background:cs.backgroundColor,
            wrapperBorder:wrapper.borderTopWidth, wrapperShadow:wrapper.boxShadow, animation:getComputedStyle(dialog.firstElementChild).animationName,
            visible:document.elementFromPoint(rect.x+18, rect.y+18)?.closest('button')===button };
        })()`);
        const right = route.includes('/status/') ? 410 : 16;
        assert.deepEqual(actual, { tagged:true, width:36, height:36, right, top:20, iconWidth:18,
          icon:'x', fill:'none', color:theme === 'light' ? 'rgb(9, 9, 11)' : 'rgb(250, 250, 250)',
          background:theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(9, 9, 11)',
          wrapperBorder:'0px', wrapperShadow:'none', animation:'none', visible:true }, `${theme} ${route}`);
        // Exercise hover and keyboard focus through Chromium's input dispatch.
        win.webContents.sendInputEvent({ type:'mouseMove', x:1440-right-18, y:38 });
        await settle();
        const hover = await evaluate(`getComputedStyle(document.querySelector('[data-exiter-media-close]')).backgroundColor`);
        assert.equal(hover, theme === 'light' ? 'rgb(244, 244, 245)' : 'rgb(39, 39, 42)');
        await evaluate(`document.querySelector('button[aria-label="Close"]').focus()`);
        win.webContents.sendInputEvent({ type:'keyDown', keyCode:'Tab', modifiers:['shift'] });
        win.webContents.sendInputEvent({ type:'keyUp', keyCode:'Tab', modifiers:['shift'] });
        win.webContents.sendInputEvent({ type:'keyDown', keyCode:'Tab' });
        win.webContents.sendInputEvent({ type:'keyUp', keyCode:'Tab' });
        await settle();
        const outline = await evaluate(`(() => {const b=document.querySelector('[data-exiter-media-close]'); b.focus(); return getComputedStyle(b).outlineWidth;})()`);
        assert.equal(outline, '2px');
        // X owns these handlers. Verify the skin leaves the controls and events intact.
        await evaluate(`window.closedBy=''; document.querySelector('button[aria-label="Close"]').onclick=()=>window.closedBy='click'; document.onkeydown=e=>{if(e.key==='Escape')window.closedBy='escape'}; document.querySelector('button[aria-label="Close"]').click()`);
        assert.equal(await evaluate('window.closedBy'), 'click');
        win.webContents.sendInputEvent({ type:'keyDown', keyCode:'Escape' });
        win.webContents.sendInputEvent({ type:'keyUp', keyCode:'Escape' });
        await settle();
        assert.equal(await evaluate('window.closedBy'), 'escape');
        await evaluate(`document.querySelector('#layer').replaceChildren()`);
      }
    }
    await evaluate(`history.pushState({}, '', '/compose/post'); document.querySelector('#layer').innerHTML='<div role="dialog"><div id="ordinary-card"><input aria-label="Post text"><button aria-label="Close"><svg></svg></button></div></div>'`);
    await settle();
    assert.deepEqual(await evaluate(`(() => {const el=document.querySelector('#ordinary-card'), cs=getComputedStyle(el);return {media:el.parentElement.hasAttribute('data-exiter-media-viewer'),border:cs.borderTopWidth,radius:cs.borderTopLeftRadius,shadow:cs.boxShadow!=='none'};})()`), {media:false,border:'1px',radius:'12px',shadow:true});
    await evaluate(`document.querySelector('#ordinary-card').innerHTML = '<div style="border:1px solid"><div id="editor-box" style="border:1px solid"><div data-testid="tweetTextarea_0_label"><div data-testid="tweetTextarea_0" contenteditable="true"></div></div></div></div><button data-testid="tweetButton" aria-disabled="true"><span>Post</span></button>'`);
    await settle();
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('#ordinary-card[data-exiter-input], #ordinary-card [data-exiter-input]')].map(el => el.id)`), ['editor-box']);
    for (const [theme, background, label] of [
      ['light', 'rgb(244, 244, 245)', 'rgb(113, 113, 122)'],
      ['dark', 'rgb(39, 39, 42)', 'rgb(161, 161, 170)'],
    ]) {
      await evaluate(`document.documentElement.dataset.exTheme = '${theme}'`);
      await settle();
      assert.deepEqual(await evaluate(`(() => {
        const post = document.querySelector('[data-testid="tweetButton"]');
        return [getComputedStyle(post).backgroundColor, getComputedStyle(post.firstElementChild).color, getComputedStyle(post).opacity];
      })()`), [background, label, '1'], `disabled composer Post in ${theme} mode`);
    }
    await evaluate(`document.querySelector('#layer').replaceChildren(); history.pushState({}, '', '/user'); document.querySelector('[data-testid="primaryColumn"]').insertAdjacentHTML('afterbegin', '<div id="profile"><a href="/user/header_photo"><div style="position:relative"><div style="padding-bottom:33.3333%"></div><img alt="Cover" src="${image}" style="position:absolute;inset:0;width:100%;height:100%"></div></a><div style="padding:16px"><div style="flex-direction:row;justify-content:space-between"><div data-testid="UserAvatar-Container-profile" style="width:25%;aspect-ratio:1;margin-top:-15%"><a href="/user/photo"><img alt="Avatar" src="${image}"></a></div><button id="profile-edit" style="height:32px">Edit profile</button></div><div data-testid="UserName">Profile name</div><div data-testid="UserDescription">A profile bio</div></div></div>')`);
    for (const width of [700, 1000, 1440, 1920, 1000]) {
      win.setContentSize(width, 900);
      await settle();
      const actual = await evaluate(`(() => {
        const rect=sel=>document.querySelector(sel).getBoundingClientRect(), banner=rect('[data-exiter-profile-banner]'), avatar=rect('[data-exiter-profile-avatar]');
        return {header:rect('#profile').width,banner:banner.width,height:banner.height,avatarWidth:avatar.width,avatarHeight:avatar.height,overlap:banner.bottom-avatar.top,
          editWithin:rect('#profile-edit').right<=rect('#profile').right,editClear:rect('#profile-edit').left>avatar.right,
          nameBelow:rect('[data-testid="UserName"]').top>=avatar.bottom,overflow:document.documentElement.scrollWidth>innerWidth};
      })()`);
      near(actual.overlap, 40, `profile avatar overlap at ${width}`);
      delete actual.overlap;
      assert.deepEqual(actual, {header:width-89,banner:width-89,height:Math.max(160,Math.min(240,width*.18)),avatarWidth:112,avatarHeight:112,
        editWithin:true,editClear:true,nameBelow:true,overflow:false}, `profile width ${width}`);
    }
    // A profile without a cover image still needs a bounded placeholder and compact avatar.
    await evaluate(`document.querySelector('[data-exiter-profile-banner]').outerHTML='<div id="empty-cover" style="padding-bottom:33.3333%"></div>'`);
    await settle();
    assert.equal(await evaluate(`document.querySelector('#empty-cover').hasAttribute('data-exiter-profile-banner')`), true);
    near(await evaluate(`document.querySelector('#empty-cover').getBoundingClientRect().height`), 180, 'empty profile cover height');

    // A press can be cancelled. Mouse release and keyboard-generated clicks are X's to handle.
    assert.equal(await evaluate(`(() => {
      const link = document.querySelector('nav a');
      let clicks = 0;
      link.addEventListener('click', event => { event.preventDefault(); clicks++; });
      link.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      const pressed = clicks;
      link.click();
      return pressed === 0 && clicks === 1;
    })()`), true, 'navigation waits for the click');

    await evaluate(`document.querySelector('nav a').focus()`);
    const sendKey = (keyCode, modifiers = []) => {
      for (const type of ['keyDown', 'keyUp']) win.webContents.sendInputEvent({ type, keyCode, modifiers });
    };
    sendKey('K', [process.platform === 'darwin' ? 'meta' : 'control']);
    await settle();
    assert.equal(await evaluate(`document.querySelector('#exiter-palette').hasAttribute('data-open')`), true);
    sendKey('Down');
    await settle();
    assert.equal(await evaluate(`document.querySelector('#exiter-palette').shadowRoot.querySelector('input').getAttribute('aria-activedescendant')`), 'exp-1');
    await evaluate(`document.querySelector('#exiter-palette').shadowRoot.querySelector('.close').click()`);
    assert.equal(await evaluate(`document.activeElement === document.querySelector('nav a')`), true);

    const notifications = [];
    ipcMain.on('exiter:unread-increased', () => notifications.push(true));
    await evaluate(`document.querySelector('nav').insertAdjacentHTML('beforeend', '<a data-testid="AppTabBar_Profile_Link" href="/user">Profile</a><a data-testid="AppTabBar_Notifications_Link" href="/notifications" aria-label="1 unread notifications">Notifications</a>')`);
    const waitForBadge = () => evaluate('new Promise(resolve => setTimeout(resolve, 420))');
    const badge = count => evaluate(`document.querySelector('[data-testid="AppTabBar_Notifications_Link"]').setAttribute('aria-label', '${count} unread notifications')`);
    win.webContents.send('exiter:settings', { ...settings, desktopNotifications: true });
    await waitForBadge();
    assert.equal(notifications.length, 0, 'existing unread badge does not alert');
    await badge(2);
    await waitForBadge();
    assert.equal(notifications.length, 1, 'an increase alerts');
    await badge(1);
    await waitForBadge();
    assert.equal(notifications.length, 1, 'a decrease stays quiet');
    await evaluate(`document.querySelector('[data-testid="AppTabBar_Profile_Link"]').href = '/other-account'`);
    await badge(4);
    await waitForBadge();
    assert.equal(notifications.length, 1, 'switching accounts establishes a baseline');
    win.webContents.send('exiter:settings', settings);
    await badge(5);
    await waitForBadge();
    assert.equal(notifications.length, 1, 'disabled alerts stay quiet');

    await evaluate(`history.pushState({}, '', '/home');
      document.querySelector('[data-testid="AppTabBar_Profile_Link"]').href = '/reader';
      document.querySelector('[data-testid="primaryColumn"]').innerHTML = \`
        <section aria-label="Timeline: Home">
          <article style="min-height:480px">
            <a href="/reader/status/1"><time>First post</time></a>
            <button data-testid="unlike"><svg></svg></button>
            <button data-testid="bookmark"><svg></svg></button>
          </article>
          <article style="min-height:480px"><a href="/reader/status/2"><time>Second post</time></a></article>
          <article style="min-height:480px"><a href="/reader/status/3"><time>Third post</time></a></article>
        </section>\`;
      window.feedMarkup = document.querySelector('[data-testid="primaryColumn"]').innerHTML;
      document.addEventListener('click', event => {
        const href = event.target.closest('a')?.getAttribute('href');
        if (!href?.includes('/status/')) return;
        event.preventDefault();
        history.pushState({}, '', href);
        document.querySelector('[data-testid="primaryColumn"]').innerHTML = '<article>Thread</article>';
        window.scrollTo(0, 0);
      });
      window.addEventListener('popstate', () => {
        if (location.pathname === '/home') document.querySelector('[data-testid="primaryColumn"]').innerHTML = window.feedMarkup;
      });
    `);
    await settle();
    assert.equal(await evaluate(`document.querySelector('[data-testid="unlike"]').hasAttribute('data-exiter-action-pop')`), false);
    await evaluate(`document.querySelector('[data-testid="bookmark"]').dataset.testid = 'removeBookmark'`);
    await settle();
    assert.equal(await evaluate(`document.querySelector('[data-testid="removeBookmark"]').hasAttribute('data-exiter-action-pop')`), true);
    for (const [mode, expected] of [['reduce', 'none'], ['no-preference', 'ex-pop-in']]) {
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: mode }] });
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-exiter-action-pop] svg')).animationName`), expected);
    }
    await evaluate(`window.scrollTo(0, 365)`);
    await waitForBadge();
    assert.equal(workspace('reader').reading.post, '/reader/status/1');
    sendKey('Down', ['alt']);
    await settle();
    assert.equal(await evaluate(`document.activeElement.getAttribute('data-exiter-reading-focus')`), '');
    await evaluate(`window.scrollTo(0, 260)`);
    sendKey('Return');
    await settle();
    assert.equal(await evaluate('location.pathname'), '/reader/status/1');
    const beforeThread = workspace('reader').reading.top;
    assert.ok(beforeThread < -200, 'the saved post was partly scrolled out of view');
    await evaluate('history.back()');
    await settle();
    assert.equal(await evaluate('location.pathname'), '/home');
    near(await evaluate(`document.querySelector('article').getBoundingClientRect().top`), beforeThread, 'back preserves reading position');
    assert.equal(await evaluate(`document.activeElement === document.querySelector('article')`), true, 'back restores keyboard focus');

    const paletteKey = process.platform === 'darwin' ? 'meta' : 'control';
    sendKey('K', [paletteKey]);
    await settle();
    assert.equal(await evaluate(`document.querySelector('#exiter-palette').shadowRoot.querySelector('.item').textContent`), 'Continue reading');
    assert.equal(await evaluate(`(() => {
      const root = document.querySelector('#exiter-palette').shadowRoot;
      return root.querySelector('.selection').style.getPropertyValue('--selection-top') === root.querySelector('.item').offsetTop + 'px';
    })()`), true, 'selection aligns with the active option');
    sendKey('Escape');
    await evaluate(`history.pushState({}, '', '/search?q=design&src=typed_query'); document.querySelector('[data-testid="primaryColumn"]').innerHTML = '<div role="progressbar" aria-label="Loading timeline"><span>Loading</span></div>'`);
    assert.equal(await evaluate(`document.querySelector('[role="progressbar"]').hasAttribute('data-exiter-skeleton')`), false);
    await waitForBadge();
    for (const theme of ['light', 'dark']) {
      assert.deepEqual(await evaluate(`(() => {
        document.documentElement.dataset.exTheme = '${theme}';
        const indicator = document.querySelector('[role="progressbar"]');
        const pseudo = getComputedStyle(indicator, '::after');
        return { label: indicator.getAttribute('aria-label'), height: pseudo.height, visible: indicator.hasAttribute('data-exiter-skeleton') };
      })()`), { label: 'Loading timeline', height: '336px', visible: true });
    }
    const choose = label => evaluate(`[...document.querySelector('#exiter-palette').shadowRoot.querySelectorAll('.item')].find(item => item.textContent === ${JSON.stringify(label)}).click()`);
    sendKey('K', [paletteKey]);
    await settle();
    await choose('Pin this search');
    await settle();
    assert.deepEqual(workspace('reader').pins, [{ label: 'design', route: '/search?q=design&src=typed_query' }]);
    sendKey('K', [paletteKey]);
    await settle();
    assert.equal(await evaluate(`[...document.querySelector('#exiter-palette').shadowRoot.querySelectorAll('.item')].some(item => item.textContent === 'design')`), true);
    await choose('Unpin this search');
    await settle();
    assert.deepEqual(workspace('reader').pins, []);
    await evaluate(`window.composerClicks = 0; document.querySelector('[data-testid="SideNav_NewTweet_Button"]').addEventListener('click', event => { event.preventDefault(); window.composerClicks++; })`);
    win.webContents.send('exiter:open-composer');
    await settle();
    assert.equal(await evaluate('window.composerClicks'), 1, 'desktop compose uses the in-page button');

    ipcMain.handle('exiter:get-version', () => ({ version: '0.4.1', updatesEnabled: false }));
    ipcMain.handle('exiter:set-settings', (event, patch) => {
      const nav = { ...settings.nav, ...patch.nav };
      Object.assign(settings, patch, { nav });
      event.sender.send('exiter:settings', settings);
      return settings;
    });
    let resets = 0;
    let testAlerts = 0;
    let updateChecks = 0;
    ipcMain.handle('exiter:reset-settings', () => { resets++; });
    ipcMain.handle('exiter:test-notification', () => { testAlerts++; return 'Test notification sent.'; });
    ipcMain.on('exiter:check-updates', () => { updateChecks++; });
    const preferences = new BrowserWindow({ show: false, width: 480, webPreferences: {
      sandbox: true, preload: path.join(__dirname, '..', 'src', 'settings', 'preload.js'),
    } });
    const prefs = code => preferences.webContents.executeJavaScript(code);
    await preferences.loadFile(path.join(__dirname, '..', 'src', 'settings', 'index.html'));
    preferences.webContents.debugger.attach('1.3');
    await preferences.webContents.debugger.sendCommand('Emulation.setFocusEmulationEnabled', { enabled: true });
    await prefs('new Promise(resolve => setTimeout(resolve, 150))');
    const groups = await prefs(`[...document.querySelectorAll('#sections a')].map(a => a.hash)`);
    assert.deepEqual(groups, ['#appearance', '#text', '#layout', '#content', '#sidebar', '#app', '#notifications', '#updates']);
    for (const group of groups) {
      await prefs(`document.querySelector('a[href="${group}"]').click(); new Promise(resolve => setTimeout(resolve, 30))`);
      assert.equal(await prefs('location.hash'), group);
    }
    await prefs(`(async () => {
      for (const button of document.querySelectorAll('[aria-pressed]')) {
        button.focus();
        button.click();
        await new Promise(next => setTimeout(next, 20));
        if (!button.isConnected || button.getAttribute('aria-pressed') !== 'true' || document.activeElement !== button) {
          throw Error('Settings option lost its value or focus: ' + button.title);
        }
      }
      for (const input of document.querySelectorAll('[role="switch"]')) {
        input.focus();
        const before = input.checked;
        input.click();
        await new Promise(next => setTimeout(next, 20));
        if (input.checked === before || document.activeElement !== input) {
          throw Error('Settings switch lost its value or focus: ' + input.getAttribute('aria-labelledby'));
        }
      }
    })()`);
    for (const [id, value, unit] of [['radius', 9, 'px'], ['fontSize', 17, 'px'], ['uiZoom', 115, '%'], ['mediaMax', 800, 'px']]) {
      const current = await prefs(`(async () => {
        const input = document.getElementById('${id}');
        input.value = '${value}';
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 30));
        return document.querySelector('output[for="${id}"]').value;
      })()`);
      assert.equal(settings[id], value);
      assert.equal(current, value + unit);
    }
    await prefs(`(async () => {
      document.querySelector('[aria-describedby="testNotification-description"]').click();
      document.querySelector('[aria-describedby="checkUpdates-description"]').click();
      const reset = document.getElementById('reset');
      reset.click();
      document.querySelector('#confirm-reset button[value="cancel"]').click();
      await new Promise(resolve => setTimeout(resolve, 30));
    })()`);
    assert.equal(resets, 0);
    assert.equal(testAlerts, 1);
    assert.equal(updateChecks, 1);
    await prefs(`document.getElementById('reset').click();
      document.querySelector('#confirm-reset button[value="reset"]').click();
      new Promise(resolve => setTimeout(resolve, 30));`);
    assert.equal(resets, 1);
    console.log(`Passed ${cases} rail/fill cases, media viewers, profiles, sidebar clicks, palette controls, unread badges, reading shortcuts and restoration, motion, loading states, pins, in-page compose, and Settings.`);
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
