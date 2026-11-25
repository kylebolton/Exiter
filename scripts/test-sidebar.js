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
  const theme = ['tokens', 'shell', 'nav', 'feed', 'cards', 'composer', 'overlays', 'pages', 'search', 'motion', 'hide', 'x-layout', 'loading'];
  const css = theme.map(name => readFileSync(path.join(__dirname, '..', 'src', 'theme', `${name}.css`), 'utf8')).join('\n');
  const chatCss = readFileSync(path.join(__dirname, '..', 'src', 'theme', 'chat.css'), 'utf8');
  ipcMain.on('exiter:get-css', (event, surface) => { event.returnValue = surface === 'chat' ? chatCss : css; });
  ipcMain.on('exiter:get-settings-sync', event => { event.returnValue = settings; });
  const { faces } = JSON.parse(readFileSync(path.join(__dirname, '..', 'src', 'theme', 'fonts.json'), 'utf8'));
  ipcMain.on('exiter:get-fonts', event => { event.returnValue = event.senderFrame.url.includes('new-layout') ? faces : []; });
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
  // The new renderer has no react-root, banner role, primaryColumn or tweet test IDs.
  const glyph = '<svg data-icon="icon-example" viewBox="0 0 24 24"><path d="M0 0h10v10z"/></svg>';
  const newFixture = `<!doctype html><html><head><style>
    body{margin:0;--x-main-column-width:600px}
    body>div{max-width:1024px;margin:auto} #desktop{display:flex;justify-content:center}
    #rail{width:calc(72px + 184px * var(--x-sidebar-expanded,1));display:flex;flex-direction:column}
    #rail nav{display:flex;flex-direction:column;padding:12px}
    #rail nav>a{display:flex;width:48px;height:48px} #rail nav span{display:inline-flex}
    #sidebar-compose-post{display:grid;width:48px;height:48px}
    #grid{display:grid;grid-template-columns:var(--x-main-column-width) minmax(0,1fr);flex:1;max-width:900px}
    main{width:100%;box-sizing:border-box;border-inline:1px solid;margin:auto}
    [id^="urt:"]{max-width:600px;margin:auto} [role="tablist"]{display:flex;flex:1}
    [role="group"]{display:flex} [role="group"] button span{display:inline-flex}
    div[lang]{font:400 15px/21px Arial,sans-serif} .text-primary{font:700 15px/20px Arial,sans-serif} .text-secondary{font-size:15px} .text-brand{color:blue}
  </style></head><body><div><div id="desktop"><div><div id="rail">
    <div><a href="/home" aria-label="X">X</a></div><div data-rail-overflow><nav aria-label="Primary">
      <a href="/home" aria-label="Home" data-status="active"><span><span>${glyph}${glyph}</span></span></a>
      <a href="/i/history" aria-label="History"><span><svg><use href="#icon-bookmark"/></svg>${glyph}</span></a>
      <a href="/i/calls" aria-label="Calls"><span>${glyph}</span></a>
      <a href="/reader" aria-label="Profile"><span>${glyph}</span></a>
    </nav><div><a id="sidebar-compose-post" href="/compose/post" aria-label="Post"><span>${glyph}</span><span>Post</span></a></div></div>
    <div><button aria-label="Account menu">Account</button></div>
  </div></div><div id="grid"><main><div><header data-page-header><div style="display:flex">
    <div role="tablist"><button role="tab" aria-selected="true"><span>For you</span><span data-tab-underline></span></button></div>
    <button aria-label="Manage timelines">+</button>
  </div><div id="live-spaces"><div class="group/carousel"><div><div role="list"><div role="listitem"><a href="/i/spaces/banner/peek">A listener is speaking</a></div></div></div></div></div>
  </header><div><textarea aria-label="What's happening?" aria-multiline="true" aria-autocomplete="list"></textarea></div>
  <section aria-labelledby="timeline-title"><h2 id="timeline-title">Your Home Timeline</h2><div><div><div id="urt:home:for-you"><div><button id="show-new"><div class="text-brand">Show 35 posts</div></button></div><ul>
    <li><div role="link" data-href="/reader/status/1"><article><div class="@container/post-actions"><div class="x-middot-group"><a href="/reader"><span class="text-primary">Reader</span></a><svg aria-label="Verified account"><use href="#icon-verified-premium-color"/></svg><a class="text-secondary" href="/reader/status/1">5h</a></div><div></div></div>
      <div lang="en"><span>An ordinary post that mentions <a href="/reader">Ad</a> and <a href="/i/spaces/post/peek">a Space</a>.</span></div><div role="group"><div data-engagement-action="like"><button class="x-engagement-button" aria-pressed="false"><span><span>${glyph}</span><span>3</span></span></button></div></div>
      <div role="link" data-href="/reader/status/3" data-slot="embedded-tweet-frame" style="border-radius:16px"><article><div class="whitespace-pre-wrap wrap-anywhere"><span>Quoted post without a language attribute.</span></div><div role="link" data-href="/reader/status/4"><div lang="en" class="text-subtext1 whitespace-pre-wrap">Compact quote preview</div></div><div class="overflow-hidden" style="border-radius:0"><div data-slot="xds-context-menu-trigger"><a data-engagement-action="media"><img src="${image}" alt="Quoted image"></a></div></div></article></div>
    </article></div></li>
    <li><div role="link" data-href="/reader/status/2"><article><div class="@container/post-actions"><div class="x-middot-group">Advertiser</div><div><a href="/reader">Ad</a></div></div><div lang="en">Promoted post</div></article></div></li>
  </ul></div></div></div></section></div></main><aside>Right column</aside></div></div></div></body></html>`;
  testSession.protocol.handle('https', request => new Response(new URL(request.url).searchParams.has('new-layout') ? newFixture : fixture, {
    headers: { 'content-type': 'text/html' },
  }));
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
      for (const recipient of new Set([event.sender, win.webContents])) recipient.send('exiter:settings', settings);
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

    Object.assign(settings, { theme: 'dark', accent: 'zinc', feedWidth: 'fill', hideAds: true, hideLogo: true, hideRightRail: true,
      hideMetrics: true, nav: { calls: false }, caps: 'names', fontFamily: 'geist', lineHeight: 'relaxed', fontSize: 17, density: 'comfortable' });
    await win.loadURL('https://x.com/home?new-layout');
    await settle();
    for (const width of [700, 1220]) {
      win.setContentSize(width, 900);
      await settle();
      const layout = await evaluate(`(() => {
        const q = s => document.querySelector(s);
        const style = s => getComputedStyle(q(s));
        const rect = s => q(s).getBoundingClientRect();
        return { rail: rect('#rail').width, feed: rect('main').width, left: rect('main').left,
          timeline: rect('[id^="urt:"]').width, right: style('aside').display,
          logo: rect('#rail a[aria-label="X"]').width, calls: style('nav a[href="/i/calls"]').display,
          railSpacing: rect('nav a[href="/i/history"]').top - rect('nav a[href="/home"]').bottom,
          homeIcons: [...q('nav a[href="/home"]').querySelectorAll('svg')].map(e => e.dataset.exiterIcon),
          compose: rect('#sidebar-compose-post svg[data-exiter-post-icon]').width, composeRadius: style('#sidebar-compose-post').borderRadius,
          bodyText: style('article [lang]').fontSize, name: style('.x-middot-group a > .text-primary').textTransform,
          border: style('main').borderColor, ad: style('[data-href="/reader/status/2"]').display,
          ordinary: style('[data-href="/reader/status/1"]').display, refresh: !!q('[data-exiter-refresh]'),
          icon: q('[data-engagement-action="like"] svg').dataset.exiterIcon,
          iconWidth: rect('[data-engagement-action="like"] svg').width,
          count: style('.x-engagement-button span > span:last-child').display };
      })()`);
      assert.deepEqual(layout, { rail: 88, feed: width - 88, left: 88, timeline: width - 89, right: 'none',
        logo: 0, calls: 'none', railSpacing: 14, homeIcons: ['house', 'house'], compose: 16, composeRadius: `${settings.radius}px`,
        bodyText: '17px', name: 'uppercase', border: 'rgb(39, 39, 42)', ad: 'none', ordinary: 'block', refresh: true,
        icon: 'heart', iconWidth: 16, count: 'none' }, `new X layout at ${width}px`);
    }
    await evaluate(`document.documentElement.dataset.exFeed = 'narrow';
      document.querySelector('[data-engagement-action="like"] button').setAttribute('aria-pressed', 'true');
      document.querySelector('[data-href="/reader/status/2"] .x-middot-group + div').replaceChildren();`);
    await settle();
    assert.deepEqual(await evaluate(`[
      document.querySelector('main').getBoundingClientRect().width,
      document.querySelector('[data-engagement-action="like"] svg').dataset.exiterIcon,
      document.querySelector('[data-engagement-action="like"] button').hasAttribute('data-exiter-action-pop'),
      getComputedStyle(document.querySelector('[data-href="/reader/status/2"]')).display,
    ]`), [600, 'heart-on', true, 'block']);
    assert.deepEqual(await evaluate(`(() => {
      delete document.documentElement.dataset.exHideRail;
      document.documentElement.dataset.exFeed = 'fill';
      return ['main', 'aside'].map(s => document.querySelector(s).getBoundingClientRect().width);
    })()`), [782, 350], 'X’s right column can be restored');
    assert.deepEqual(await evaluate(`(async () => {
      await document.fonts.ready;
      const style = selector => getComputedStyle(document.querySelector(selector));
      const font = style('article [lang] > span');
      const author = style('.x-middot-group .text-primary');
      const row = style('#show-new > div');
      const glyphs = s => [...document.querySelectorAll(s)].map(e => e.getAttribute('data-exiter-icon'));
      return { family: font.fontFamily.split(',')[0], fontLoaded: [...document.fonts].some(f => f.family === 'Exiter Geist' && f.status === 'loaded'),
        size: font.fontSize, leading: font.lineHeight, author: [author.fontSize, author.fontWeight], handle: style('.x-middot-group .text-secondary').fontSize,
        quoted: style('article article .whitespace-pre-wrap').fontSize, compactQuote: style('article article .text-subtext1').fontSize,
        newPosts: [row.fontSize, row.color, ...glyphs('#show-new svg')], history: glyphs('nav a[href="/i/history"] svg'),
        verified: glyphs('article svg[aria-label="Verified account"]'), nativeGlyphHidden: style('nav a[href="/i/history"] svg > use').display };
    })()`), { family: '"Exiter Geist"', fontLoaded: true, size: '17px', leading: '29.75px', author: ['12.88px', '600'], handle: '13px', quoted: '17px', compactQuote: '17px',
      newPosts: ['13px', 'rgb(161, 161, 170)', 'arrowUp'], history: ['bookmark', 'bookmark'], verified: ['badgeCheck'], nativeGlyphHidden: 'none' });
    assert.deepEqual(await evaluate(`['#live-spaces', 'article a[href="/i/spaces/post/peek"]'].map(s => getComputedStyle(document.querySelector(s)).display)`),
      ['none', 'inline'], 'hide the live Spaces strip and preserve links in posts');
    assert.deepEqual(await evaluate(`['[data-slot="embedded-tweet-frame"]', '[data-slot="embedded-tweet-frame"] .overflow-hidden'].map(s => getComputedStyle(document.querySelector(s)).borderRadius)`),
      [String(settings.radius + 4) + 'px', String(settings.radius) + 'px'], 'quote card and media follow Exiter’s corner radius settings');
    for (const value of [13, 22]) {
      await prefs(`(() => {
        const slider = document.getElementById('fontSize');
        slider.value = '${value}';
        slider.dispatchEvent(new Event('input'));
        slider.dispatchEvent(new Event('change'));
      })()`);
      await settle();
      assert.deepEqual(await evaluate(`['article [lang] > span', 'article article .whitespace-pre-wrap > span', 'article article .text-subtext1'].map(s => getComputedStyle(document.querySelector(s)).fontSize)`),
        Array(3).fill(`${value}px`), 'the Settings slider sizes regular and quoted post text together');
    }
    await evaluate(`document.querySelector('#show-new > div').firstChild.data = 'Show 70 posts';
      document.querySelector('#show-new').addEventListener('click', () => {
        document.querySelector('[data-href="/reader/status/1"]').dataset.href = '/reader/status/70';
        document.querySelector('#show-new').remove();
      });`);
    await settle();
    assert.equal(await evaluate(`document.querySelectorAll('#show-new [data-exiter-showposts-arrow]').length`), 1);
    await evaluate(`document.querySelector('[data-exiter-refresh]').click()`);
    assert.equal(await evaluate(`document.querySelector('[data-href="/reader/status/70"]') !== null && !document.querySelector('#show-new')`), true);

    await evaluate(`(() => {
      const timeline = document.querySelector('[id^="urt:"]');
      timeline.innerHTML = '<button>Show 1 new post</button><ul style="position:relative;list-style:none;margin:0;padding:0"></ul>';
      const list = timeline.querySelector('ul');
      timeline.querySelector('button').addEventListener('click', event => {
        event.currentTarget.remove();
        list.innerHTML = [120, 746, 140].map((height, index) => {
          const ad = index === 1 ? '<div class="@container/post-actions"><div class="x-middot-group"></div><div><a href="/reader">Ad</a></div></div>' : '';
          return '<li data-index="' + index + '" style="position:absolute;width:100%;top:0"><div role="link" data-href="/reader/status/' + (80 + index) + '"><article style="height:' + height + 'px">' + ad + '</article></div></li>';
        }).join('');
        const heights = [120, 746, 140];
        const place = () => {
          let top = 0;
          for (const [index, row] of [...list.children].entries()) {
            row.style.transform = 'translateY(' + top + 'px)';
            top += heights[index];
          }
          list.style.height = top + 'px';
        };
        place();
        // X ignores zero-height observations, retaining each row's last measured height.
        const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
            if (entry.contentRect.height > 0) heights[Number(entry.target.dataset.index)] = entry.contentRect.height;
          }
          place();
        });
        for (const row of list.children) observer.observe(row);
      });
    })()`);
    await settle();
    await evaluate(`document.querySelector('[data-exiter-showposts-button]').click()`);
    await settle();
    const gap = () => evaluate(`document.querySelector('li[data-index="2"]').getBoundingClientRect().top - document.querySelector('li[data-index="0"]').getBoundingClientRect().bottom`);
    assert.equal(await gap(), 1, 'the hidden promoted row preserves a measurable height after loading new posts');
    await evaluate(`document.documentElement.removeAttribute('data-ex-hide-ads')`);
    await settle();
    assert.equal(await gap(), 746, 'showing promoted posts restores their full height');
    await evaluate(`(() => {
      const container = document.createElement('div');
      container.setAttribute('role', 'status');
      container.setAttribute('data-top-chrome-follow', '');
      container.innerHTML = '<div><button style="background:blue;border-radius:999px"><svg></svg><span aria-hidden="true"><i class="x-avatar">Avatar</i></span><span>See new posts</span></button></div>';
      document.querySelector('section').prepend(container);
      container.querySelector('button').addEventListener('click', () => container.remove());
    })()`);
    await settle();
    assert.deepEqual(await evaluate(`(() => {
      const pill = document.querySelector('[data-top-chrome-follow] button');
      const svg = pill.querySelector('svg');
      const style = getComputedStyle(pill);
      return [style.backgroundColor, style.borderRadius, style.height, svg.dataset.exiterIcon, getComputedStyle(svg).width,
        getComputedStyle(pill.lastElementChild).fontSize, getComputedStyle(pill.querySelector('.x-avatar')).width];
    })()`), ['rgb(9, 9, 11)', String(settings.radius + 4) + 'px', '36px', 'arrowUp', '16px', '13px', '20px']);
    await evaluate(`document.querySelector('[data-exiter-refresh]').click()`);
    assert.equal(await evaluate(`!!document.querySelector('[data-top-chrome-follow] button')`), false);
    await evaluate(`(() => {
      document.querySelector('#rail').firstElementChild.outerHTML = '<h1><a href="/home" aria-label="X">X</a></h1>';
      document.querySelector('main').innerHTML = '<div data-top-chrome><button data-slot="xds-button" aria-label="Back">Back</button><h2>Post</h2></div>' +
        '<article><button data-slot="xds-button" aria-label="Follow @reader">Follow</button><div lang="en">Post text</div></article>' +
        '<form><div><div aria-hidden="true">Mirror</div><textarea aria-label="Post your reply" aria-multiline="true" aria-autocomplete="list"></textarea></div><button id="reply-submit" class="bg-btn-primary" disabled>Reply</button></form>' +
        '<form role="search"><div role="group"><input role="combobox"></div></form>' +
        '<section><a aria-label="Opens header photo" href="/reader/header_photo"><div></div></a><div class="@container"><div><a aria-label="Opens profile photo" href="/reader/photo">Avatar</a></div><button data-slot="xds-button" aria-label="Message" style="border-radius:9999px">Message</button><span>Bio <a class="text-brand" href="/writer" style="color:blue">@writer</a></span><div><a class="text-brand" href="https://example.invalid" style="color:blue">Website</a></div></div></section>';
      document.body.insertAdjacentHTML('beforeend', '<div role="dialog" data-modal-slot-surface><div data-slot="xds-modal-scroll-body">Compose</div></div>');
    })()`);
    assert.deepEqual(await evaluate(`(() => {
      const get = s => getComputedStyle(document.querySelector(s));
      const rail = document.querySelector('#rail');
      return { logo: rail.firstElementChild.getBoundingClientRect().height, editor: [get('textarea').fontSize, get('form > div').borderTopWidth, get('form > div').borderRadius],
        reply: [get('#reply-submit').height, get('#reply-submit').borderRadius, get('#reply-submit').backgroundColor],
        follow: [get('article button').borderRadius, get('article button').backgroundColor], body: get('article [lang]').fontSize,
        message: [get('[aria-label="Message"]').borderRadius, get('[aria-label="Message"]').fontSize],
        profileLinks: [...document.querySelectorAll('section a.text-brand')].map(link => [getComputedStyle(link).color, getComputedStyle(link).textDecorationLine]),
        search: get('[role="search"] > [role="group"]').borderRadius, cover: Math.round(document.querySelector('[aria-label="Opens header photo"]').getBoundingClientRect().height),
        avatar: get('[aria-label="Opens profile photo"]').getPropertyValue('--profile-avatar-size'),
        dialog: [get('[role="dialog"]').borderTopWidth, get('[role="dialog"] > div').borderTopWidth] };
    })()`), { logo: 0, editor: ['15px', '1px', String(settings.radius) + 'px'],
      reply: ['32px', String(settings.radius) + 'px', 'rgb(39, 39, 42)'], follow: [String(settings.radius) + 'px', 'rgb(250, 250, 250)'], body: '22px',
      message: [String(settings.radius) + 'px', '13px'], profileLinks: [['rgb(250, 250, 250)', 'underline'], ['rgb(250, 250, 250)', 'underline']],
      search: String(settings.radius) + 'px', cover: 220, avatar: '112px', dialog: ['1px', '0px'] });
    await evaluate(`document.documentElement.removeAttribute('data-ex-hide-logo')`);
    assert.notEqual(await evaluate(`document.querySelector('#rail > h1').getBoundingClientRect().height`), 0, 'the thread logo can still be enabled');
    await evaluate(`(() => {
      document.querySelector('main form').insertAdjacentHTML('beforeend', '<div><a id="participant" class="text-brand" style="color:blue" href="/reader">@reader</a><button aria-label="Add media">${glyph}</button><button aria-label="Generate image">${glyph}</button></div>');
      const article = document.querySelector('main article');
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-navigation-stop','');
      article.replaceWith(wrapper); wrapper.append(article);
      article.insertAdjacentHTML('beforeend', '<a href="/reader"><div class="text-body text-primary font-bold">Reader</div></a><a id="message-cta" data-slot="xds-button" href="/messages/compose?recipient_id=1" style="color:blue;border-radius:999px">${glyph}Send a private message</a>');
      document.body.insertAdjacentHTML('beforeend', '<div data-base-ui-portal><div role="presentation"><div data-base-ui-focusable data-side="bottom"><a class="text-brand" style="color:blue" href="/writer">Bio link</a><button data-slot="xds-button" style="border-radius:999px">${glyph}Profile Summary</button></div></div><div data-slot="xds-combobox-content" style="border-radius:999px"><div data-slot="xds-combobox-list" aria-label="Search results"><a data-slot="xds-combobox-item" href="/search">Recent query</a></div></div></div>');
    })()`);
    await settle();
    assert.deepEqual(await evaluate(`(() => {
      const q = s => document.querySelector(s);
      const css = s => getComputedStyle(q(s));
      return {toolbar: [css('[aria-label="Add media"]').width, css('[aria-label="Add media"] svg').width, css('[aria-label="Generate image"]').display],
        participant: css('#participant').color, cta: [css('#message-cta').color, css('#message-cta').borderRadius, q('#message-cta svg').dataset.exiterIcon],
        primaryName: [css('article a > .font-bold').fontWeight, css('article a > .font-bold').textTransform],
        search: css('[data-slot="xds-combobox-content"]').borderRadius,
        summary: [css('[data-exiter-profile-preview]').borderRadius, css('[data-exiter-profile-preview] a').color, css('[data-exiter-profile-summary-action]').borderRadius, q('[data-exiter-profile-summary-action] svg').dataset.exiterIcon]};
    })()`), { toolbar: ['32px', '16px', 'none'], participant: 'rgb(250, 250, 250)', cta: ['rgb(250, 250, 250)', String(settings.radius) + 'px', 'messageSquare'],
      primaryName: ['600', 'uppercase'], search: String(settings.radius + 4) + 'px', summary: [String(settings.radius + 4) + 'px', 'rgb(250, 250, 250)', String(settings.radius) + 'px', 'sparkles'] });
    await evaluate(`(() => {
      history.pushState({}, '', '/i/chat');
      const host = document.createElement('div');
      host.className = '[--dm-bottom-inset:0px]';
      document.querySelector('main').append(host);
      setTimeout(() => {
        host.attachShadow({ mode: 'open' }).innerHTML = '<style>:host{--radius:8px}</style><div data-xchat-root style="font-family:Arial"><button data-testid="dm-new-chat-button" data-slot="xds-button" style="border-radius:999px">New message</button><input data-testid="dm-search-input" style="border-radius:999px"></div>';
      }, 80);
    })()`);
    await evaluate(`new Promise(resolve => {
      const deadline = performance.now() + 3000;
      const waitForSkin = () => {
        const host = document.querySelector('main div[class*="--dm-bottom-inset:"]');
        if (host?.shadowRoot?.getElementById('exiter-chat-css') || performance.now() >= deadline) resolve();
        else setTimeout(waitForSkin, 50);
      };
      waitForSkin();
    })`);
    assert.deepEqual(await evaluate(`(() => {
      const root = document.querySelector('main div[class*="--dm-bottom-inset:"]').shadowRoot;
      return [root.querySelectorAll('#exiter-chat-css').length, getComputedStyle(root.querySelector('button')).fontFamily.split(',')[0],
        getComputedStyle(root.querySelector('button')).borderRadius, getComputedStyle(root.querySelector('input')).borderRadius];
    })()`), [1, '"Exiter Geist"', String(settings.radius) + 'px', String(settings.radius) + 'px']);
    console.log(`Passed ${cases} rail/fill cases, media viewers, profiles, sidebar clicks, palette controls, unread badges, reading shortcuts and restoration, motion, loading states, pins, in-page compose, and Settings.`);
    console.log('Passed new X layout at 700px and 1220px, including feed width, icons, typography, and virtualized ad spacing after loading new posts.');
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
