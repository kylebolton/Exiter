// Runs in an isolated world with no Node access (sandboxed, so no local requires).
// 1) hides promoted posts that CSS alone can't catch, 2) swaps X's icons for Lucide-style line icons.
const { ipcRenderer } = require('electron');

/* ---------- Lucide icon paths (ISC licence, https://lucide.dev), 24x24 viewBox ---------- */
const ICONS = {
  badgeCheck: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
  house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  messageSquare: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  ellipsis: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  messageCircle: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  repeat: '<path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  chart: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  share: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  gif: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M10 10.5a2 2 0 1 0 0 3v-1.5h-1"/><path d="M13.5 10v4"/><path d="M17.5 10h-2.5v4"/><path d="M17 12h-2"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/>',
  calendarClock: '<path d="M16 14v2.2l1.6 1"/><path d="M16 2v4"/><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M3 10h5"/><path d="M8 2v4"/><circle cx="16" cy="16" r="6"/>',
  mapPin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  refreshCw: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  arrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  x: '<path d="m18 6-12 12M6 6l12 12"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  squarePen: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  squareArrowOutUpRight: '<path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/>',
  mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
};

// [CSS selector for the control, icon name, optional state class]
const ICON_MAP = [
  ['a[data-testid="AppTabBar_Home_Link"]', 'house'],
  ['a[data-testid="AppTabBar_Explore_Link"]', 'search'],
  ['a[data-testid="AppTabBar_Notifications_Link"]', 'bell'],
  ['a[data-testid="AppTabBar_DirectMessage_Link"]', 'messageSquare'],
  ['a[data-testid="AppTabBar_Profile_Link"]', 'user'],
  ['button[data-testid="AppTabBar_More_Menu"]', 'ellipsis'],
  ['[data-testid="reply"]', 'messageCircle'],
  ['[data-testid="retweet"], [data-testid="unretweet"]', 'repeat'],
  ['[data-testid="like"]', 'heart'],
  ['[data-testid="unlike"]', 'heart', 'on'],
  ['[data-testid="bookmark"]', 'bookmark'],
  ['[data-testid="removeBookmark"]', 'bookmark', 'on'],
  ['article a[href$="/analytics"]', 'chart'],
  ['article button[aria-label="Share post"]', 'share'],
  ['button[aria-label="Manage timelines"]', 'plus'],
  ['button[aria-label^="New posts are available"]', 'arrowUp'],
  ['button[aria-label="Add photos or video"]', 'image'],
  ['[data-testid="gifSearchButton"]', 'gif'],
  ['[data-testid="createPollButton"]', 'list'],
  ['button[aria-label="Add emoji"]', 'smile'],
  ['[data-testid="scheduleOption"]', 'calendarClock'],
  ['[data-testid="geoButton"]', 'mapPin'],
];

function swapIcon(svg, name, state) {
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('data-exiter-icon', name + (state ? '-' + state : ''));
  svg.innerHTML = ICONS[name];
}

function sweepIcons() {
  for (const [sel, name, state] of ICON_MAP) {
    document.querySelectorAll(sel).forEach((el) => {
      const svg = el.querySelector('svg');
      const key = name + (state ? '-' + state : '');
      if (svg && svg.getAttribute('data-exiter-icon') !== key) swapIcon(svg, name, state);
    });
  }
}

/* X's verified badge is an <svg data-testid="icon-verified"> itself (not a wrapper), so it needs its own sweep */
function sweepBadges() {
  document.querySelectorAll('svg[data-testid="icon-verified"]:not([data-exiter-icon])').forEach((svg) => swapIcon(svg, 'badgeCheck'));
}

/* X removes the Post icon when its own navigation expands. Keep our rail's control present. */
function ensurePostIcon() {
  const post = document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
  if (!post) return;
  const icons = [...post.querySelectorAll('svg')];
  let svg = icons.find(icon => !icon.hasAttribute('data-exiter-added')) || icons[0];
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('data-exiter-added', '');
    (post.firstElementChild || post).prepend(svg);
  }
  for (const other of icons) {
    if (other === svg) continue;
    if (other.hasAttribute('data-exiter-added')) other.remove();
    else other.removeAttribute('data-exiter-post-icon');
  }
  svg.setAttribute('data-exiter-post-icon', '');
  if (svg.getAttribute('data-exiter-icon') !== 'squarePen') swapIcon(svg, 'squarePen');
}

/* Image viewers use full-screen wrappers, not the cards used by other dialogs. */
function tagMediaViewer() {
  const mediaRoute = /\/(?:photo(?:\/\d+)?|header_photo)\/?$/.test(location.pathname);
  document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
    // Post viewers may include a reply composer; avatar images in ordinary dialogs do not identify a viewer.
    const media = mediaRoute && (dialog.querySelector('[data-testid="swipe-to-dismiss"]') ||
      [...dialog.querySelectorAll('img')].some(img => !img.closest('[data-testid^="UserAvatar-Container"]')));
    dialog.toggleAttribute('data-exiter-media-viewer', !!media);
    dialog.querySelectorAll('[data-testid="app-bar-close"], button[aria-label="Close"]').forEach((button) => {
      button.toggleAttribute('data-exiter-media-close', !!media);
      const svg = button.querySelector('svg');
      if (media && svg && svg.getAttribute('data-exiter-icon') !== 'x') swapIcon(svg, 'x');
      if (media) {
        // Keep the cross inside the image stage: a post's reply panel otherwise covers
        // fixed controls positioned against the window's right edge. Leave room for X's panel toggle.
        let stage = button.parentElement;
        while (stage && stage !== dialog && !(stage.clientWidth > 160 && stage.querySelector('img'))) stage = stage.parentElement;
        const right = stage ? Math.max(0, innerWidth - stage.getBoundingClientRect().right) : 0;
        button.style.setProperty('--exiter-media-close-right', `${right + (location.pathname.includes('/status/') ? 60 : 16)}px`);
      } else button.style.removeProperty('--exiter-media-close-right');
    });
  });
}

/* Profile headers stretch with the feed; the avatar and cover height keep their own scale. */
function tagProfileHeader() {
  const name = document.querySelector('[data-testid="primaryColumn"] [data-testid="UserName"]');
  if (!name || name.closest('article')) return;
  const summary = name.parentElement;
  const header = summary.parentElement;
  header.setAttribute('data-exiter-profile-header', '');
  summary.setAttribute('data-exiter-profile-summary', '');
  const cover = header.querySelector('a[href$="/header_photo"]') || (header.firstElementChild !== summary ? header.firstElementChild : null);
  cover?.setAttribute('data-exiter-profile-banner', '');
  header.querySelector('[data-testid^="UserAvatar-Container"]')?.setAttribute('data-exiter-profile-avatar', '');
}

/* ---------- More menu: swap X's glyphs for Lucide, matched by label (hrefs differ per account) ---------- */
const MENU_ICONS = { 'lists': 'fileText', 'communities': 'users', 'business': 'zap', 'ads': 'squareArrowOutUpRight', 'create your space': 'mic', 'settings and privacy': 'settings' };
function sweepMenuIcons() {
  document.querySelectorAll('[data-testid="Dropdown"] a[role="link"]').forEach((a) => {
    const name = MENU_ICONS[(a.textContent || '').trim().toLowerCase()];
    const svg = a.querySelector('svg');
    if (name && svg && svg.getAttribute('data-exiter-icon') !== name) swapIcon(svg, name);
  });
}

/* ---------- Inline "Show N posts" banner: tag its timeline cell so CSS can restyle it, and give it an arrow ---------- */
const SHOW_POSTS = /^Show \d+\+? (new )?posts?$/i;
function tagShowPosts() {
  document.querySelectorAll('[data-testid="cellInnerDiv"]:not([data-exiter-showposts]):not(:has(article))').forEach((cell) => {
    const t = (cell.textContent || '').trim();
    if (t.length > 30 || !SHOW_POSTS.test(t)) return;
    cell.setAttribute('data-exiter-showposts', '1');
  });
  document.querySelectorAll('[data-exiter-showposts]:not([data-exiter-arrow])').forEach((cell) => {
    const label = [...cell.querySelectorAll('span')].find((s) => s.children.length === 0 && SHOW_POSTS.test(s.textContent.trim()));
    if (!label) return;
    cell.setAttribute('data-exiter-arrow', '1');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    swapIcon(svg, 'arrowUp');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('data-exiter-added', '1');
    label.parentElement.insertBefore(svg, label);
  });
}

/* ---------- Composer input box: tag the single ancestor X draws a border on ---------- */
function tagComposerInput() {
  document.querySelectorAll('[data-testid="tweetTextarea_0_label"]:not([data-exiter-tagged])').forEach((label) => {
    label.setAttribute('data-exiter-tagged', '1');
    for (let e = label.parentElement, i = 0; e && i < 16; e = e.parentElement, i++) {
      // The overlay gives the dialog card its own border. Only the input should respond to editor focus.
      if (e.matches('[role="dialog"], [role="dialog"] > *')) break;
      const cs = getComputedStyle(e);
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') {
        e.setAttribute('data-exiter-input', '1');
        break;
      }
    }
  });
}

/* ---------- Composer focus: X autofocuses the post box on load, which shows a stray caret before the placeholder.
   Blur it until the user actually interacts with the page. ---------- */
let userInteracted = false;
['pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, () => { userInteracted = true; }, { capture: true, once: false }));
document.addEventListener('focusin', (e) => {
  if (!userInteracted && e.target && e.target.closest && e.target.closest('[data-testid="tweetTextarea_0"]')) setTimeout(releaseAutofocus, 0);
}, true);
function releaseAutofocus() {
  if (userInteracted) return;
  const a = document.activeElement;
  if (a && a.closest && a.closest('[data-testid="tweetTextarea_0"]') && typeof a.blur === 'function') a.blur();
}

/* ---------- Quote cards: tag the wide rounded-border box so CSS can cap it with the media ---------- */
function tagQuoteCards() {
  document.querySelectorAll('article:not([data-exiter-q])').forEach((a) => {
    a.setAttribute('data-exiter-q', '1');
    for (const d of a.querySelectorAll('div')) {
      const cs = getComputedStyle(d);
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopLeftRadius !== '0px' && d.offsetWidth > 640) d.setAttribute('data-exiter-cap', '1');
    }
  });
}

/* Quoted posts: the bordered link box that holds a second User-Name inside an article. Tagged once so cards.css can restyle it at any width. */
function tagQuotedPosts() {
  document.querySelectorAll('article div[role="link"]:not([data-exiter-quote]):not([data-exiter-qn])').forEach((d) => {
    if (!d.querySelector('[data-testid="User-Name"]')) return; // contents may not have rendered yet: re-check on a later sweep
    const cs = getComputedStyle(d);
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopLeftRadius !== '0px') d.setAttribute('data-exiter-quote', '1');
    else d.setAttribute('data-exiter-qn', '1');
  });
}

/* ---------- Free layout wrappers, without stretching media or quoted cards ---------- */
let uncapTimer = null;
function uncapColumn() {
  const col = document.querySelector('[data-testid="primaryColumn"]');
  const main = col && col.closest('main[role="main"]');
  if (!main) return;
  for (let el = main.parentElement; el && el.id !== 'react-root'; el = el.parentElement) {
    el.setAttribute('data-exiter-shell', '');
  }
  for (let el = col.parentElement; el && el !== main; el = el.parentElement) {
    el.setAttribute('data-exiter-column', '');
  }
  let level = [col];
  for (let depth = 0; depth < 8 && level.length; depth++) {
    const next = [];
    for (const el of level) {
      for (const k of el.children) {
        if (k.tagName !== 'DIV' && k.tagName !== 'SECTION') continue;
        if (k.matches('[role="link"], [data-exiter-cap], [data-exiter-quote], [data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="card.wrapper"]')) continue;
        if (k.hasAttribute('data-exiter-free')) { next.push(k); continue; }
        if (getComputedStyle(k).maxWidth === '600px') k.setAttribute('data-exiter-free', '1');
        next.push(k);
      }
    }
    level = next.length > 400 ? [] : next;
  }
}

/* ---------- Sign-in pills: X draws its 9999px buttons on deeply nested divs; tag them so CSS can give them the control radius ---------- */
function tagPills() {
  document.querySelectorAll('[role="dialog"]:has(input) div:not([data-exiter-pill])').forEach((d) => {
    if (d.offsetWidth < 150 || d.offsetHeight < 30 || d.offsetHeight > 60) return;
    if (parseFloat(getComputedStyle(d).borderTopLeftRadius) >= 14) d.setAttribute('data-exiter-pill', '1');
  });
}

/* ---------- Promoted post hiding ---------- */
let enabled = true;  // promoted-post hiding, driven by settings.hideAds
const AD_LABELS = new Set(['Ad', 'Promoted']);
const isAdLabel = (t) => AD_LABELS.has(t) || t.startsWith('Promoted by');

function sweepAds() {
  if (!enabled) return;
  document.querySelectorAll('[data-testid="cellInnerDiv"]:not([data-exiter-checked])').forEach((cell) => {
    cell.setAttribute('data-exiter-checked', '1');
    for (const s of cell.querySelectorAll('span')) {
      if (s.children.length === 0 && isAdLabel(s.textContent.trim())) {
        cell.setAttribute('data-exiter-ad', '1');
        break;
      }
    }
  });
}

/* ---------- Route + pill tracking ---------- */
let lastHref = location.href;
let routeTimer = null;
let saveTimer = null;
const NO_RESTORE = /^\/(login|logout|i\/flow|i\/oauth2|compose|settings|account|intent)(\/|$)/;
function trackRoute() {
  if (location.href === lastHref) return;
  lastHref = location.href;
  startNavigationTiming();
  clearTimeout(readingTimer);
  const root = document.documentElement;
  root.setAttribute('data-ex-route-anim', '');
  clearTimeout(routeTimer);
  routeTimer = setTimeout(() => root.removeAttribute('data-ex-route-anim'), 300);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const route = location.pathname + location.search;
    if (location.host === 'x.com' && !NO_RESTORE.test(location.pathname) && route.length < 200) ipcRenderer.send('exiter:route', route);
  }, 800);
}
let lastPill = '';
function tickPill() {
  const pill = document.querySelector('button[aria-label^="New posts are available"]');
  const label = pill ? (pill.textContent || '').trim() : '';
  if (label && lastPill && label !== lastPill) {
    pill.setAttribute('data-ex-tick', '');
    setTimeout(() => pill.removeAttribute('data-ex-tick'), 260);
  }
  lastPill = label;
}

/* Read the unread indicator that X already keeps current, including while the
   window is hidden. A fresh document or account establishes a baseline. */
const NOTIFICATIONS_LINK = 'a[data-testid="AppTabBar_Notifications_Link"]';
const PROFILE_LINK = 'a[data-testid="AppTabBar_Profile_Link"]';
let unread;
let unreadAccount;
let unreadTimer;

function readUnread(link) {
  for (const candidate of [link, ...link.querySelectorAll('[aria-label]')]) {
    const label = candidate.getAttribute('aria-label') || '';
    const announced = label.match(/\b(\d+)\+?\s+unread\b/i);
    if (announced) return Number(announced[1]);
  }
  const icon = link.querySelector('svg');
  const badge = icon?.parentElement?.textContent.trim();
  return badge && /^\d+\+?$/.test(badge) ? Number(badge.replace('+', '')) : 0;
}

function checkUnread() {
  unreadTimer = undefined;
  if (!current?.desktopNotifications) {
    unread = unreadAccount = undefined;
    return;
  }
  const link = document.querySelector(NOTIFICATIONS_LINK);
  const account = document.querySelector(PROFILE_LINK)?.getAttribute('href');
  if (!link || !account) return;
  const next = readUnread(link);
  if (account === unreadAccount && next > unread) ipcRenderer.send('exiter:unread-increased');
  unread = next;
  unreadAccount = account;
}

function scheduleUnread() {
  if (!current?.desktopNotifications || unreadTimer !== undefined) return;
  unreadTimer = setTimeout(checkUnread, 300);
}

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    trackRoute();
    syncWorkspace();
    syncTimelineLoading();
    restoreReadingPosition();
    warmGallery();
    tagMediaViewer(); tagProfileHeader(); sweepAds(); sweepIcons(); markPostActionChanges(); sweepBadges(); ensurePostIcon(); sweepMenuIcons(); tagShowPosts(); tagComposerInput(); ensureRefreshButton(); releaseAutofocus(); tagQuoteCards(); tagQuotedPosts(); tagPills(); tickPill();
    // Throttle rather than continually postponing layout work while the timeline streams in.
    if (uncapTimer === null) uncapTimer = setTimeout(() => { uncapTimer = null; uncapColumn(); }, 100);
  });
}

window.addEventListener('resize', schedule);
window.addEventListener('popstate', schedule);

window.addEventListener('DOMContentLoaded', () => {
  new MutationObserver(schedule).observe(document.body, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['data-testid', 'aria-selected', 'href'],
  });
  schedule();
  if (location.origin === 'https://x.com' && window === window.top) {
    new MutationObserver(scheduleUnread).observe(document.body, {
      childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'href'], subtree: true,
    });
    scheduleUnread();
  }
});

/* ---------- Reading position, keyboard navigation, and pinned destinations ---------- */
const PRIMARY = '[data-testid="primaryColumn"]';
const TIMELINE = '[aria-label^="Timeline:"]';
const POST_PATH = /^\/[A-Za-z0-9_]{1,15}\/status\/\d+$/;
const FEED_PATH = /^\/(?:home|search|i\/(?:bookmarks|lists\/\d+))$/;
const EDITING = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
const isXWindow = location.origin === 'https://x.com' && window === window.top;
let workspace = { pins: [] };
let workspaceAccount = '';
let recentPositions = new Map();
let readingTimer;
let readingRestore;

function readingView() {
  if (!FEED_PATH.test(location.pathname)) return null;
  const route = location.pathname + location.search;
  if (route.length > 600) return null;
  const tab = document.querySelector(`${PRIMARY} [role="tab"][aria-selected="true"]`)?.textContent.trim().slice(0, 80) || '';
  return { route, tab };
}

const viewKey = ({ route, tab }) => `${route}#${tab}`;
const postLink = article => article.querySelector('a[href*="/status/"]:has(time)');
const postPath = article => {
  const href = postLink(article)?.getAttribute('href')?.split(/[?#]/)[0];
  return href && POST_PATH.test(href) ? href : null;
};
const feedPosts = () => [...document.querySelectorAll(`${PRIMARY} ${TIMELINE} article`)]
  .filter(article => postPath(article) && article.getClientRects().length);

function focusPost(article) {
  if (!article.hasAttribute('tabindex')) article.tabIndex = -1;
  article.setAttribute('data-exiter-reading-focus', '');
  article.focus({ preventScroll: true });
}

function syncWorkspace() {
  if (!isXWindow) return;
  const account = profilePath()?.match(/^\/([A-Za-z0-9_]{1,15})$/)?.[1].toLowerCase() || '';
  if (account === workspaceAccount) return;
  workspaceAccount = account;
  workspace = { pins: [] };
  recentPositions.clear();
  readingRestore = undefined;
  clearTimeout(readingTimer);
  if (palette) renderPalette();
  if (!account) return;
  ipcRenderer.invoke('exiter:workspace', account).then(saved => {
    if (account !== workspaceAccount || !saved) return;
    workspace = { pins: saved.pins || [], reading: workspace.reading || saved.reading };
    if (palette) renderPalette();
  }).catch(() => {});
}

function rememberReading() {
  const view = readingView();
  if (!workspaceAccount || !view || readingRestore || document.querySelector('[role="dialog"]')) return;
  const post = feedPosts().find(article => {
    const { top, bottom } = article.getBoundingClientRect();
    return bottom > 76 && top < innerHeight;
  });
  if (!post) return;
  const position = { ...view, post: postPath(post), top: Math.round(post.getBoundingClientRect().top) };
  if (Math.abs(position.top) > 4000) return;
  const key = viewKey(view);
  const focused = document.activeElement?.closest('article[data-exiter-reading-focus]');
  recentPositions.delete(key);
  recentPositions.set(key, { ...position, focusedPost: focused ? postPath(focused) : null });
  if (recentPositions.size > 20) recentPositions.delete(recentPositions.keys().next().value);
  const before = workspace.reading;
  if (before && viewKey(before) === key && before.post === position.post && Math.abs(before.top - position.top) < 24) return;
  workspace.reading = position;
  ipcRenderer.send('exiter:reading-position', workspaceAccount, position);
}

function restoreReadingPosition() {
  if (!readingRestore) return;
  const { position, expires, allowTabChange } = readingRestore;
  if (performance.now() > expires) { readingRestore = undefined; return; }
  const view = readingView();
  if (view?.route !== position.route) return;
  if (view.tab !== position.tab) {
    if (allowTabChange && position.tab && !readingRestore.requestedTab) {
      const tab = [...document.querySelectorAll(`${PRIMARY} [role="tab"]`)].find(el => el.textContent.trim() === position.tab);
      if (tab) { readingRestore.requestedTab = true; tab.click(); }
    }
    return;
  }
  const posts = feedPosts();
  const article = posts.find(el => postPath(el) === position.post);
  if (!article) return;
  readingRestore = undefined;
  window.scrollBy({ top: article.getBoundingClientRect().top - position.top, behavior: 'instant' });
  if (position.focusedPost) {
    const focused = posts.find(el => postPath(el) === position.focusedPost);
    if (focused) focusPost(focused);
  }
}

function continueReading() {
  const position = workspace.reading;
  if (!position) return;
  if (readingView()?.route === position.route && feedPosts().some(el => postPath(el) === position.post)) {
    readingRestore = { position, expires: performance.now() + 1600, allowTabChange: true };
    restoreReadingPosition();
  } else go(position.post);
}

function currentPin() {
  const view = readingView();
  if (!view) return null;
  if (location.pathname === '/search') {
    const label = new URLSearchParams(location.search).get('q')?.trim().slice(0, 100);
    return label ? { route: view.route, label } : null;
  }
  if (/^\/i\/lists\/\d+$/.test(location.pathname)) {
    const id = location.pathname.split('/').at(-1);
    const heading = [...document.querySelectorAll(`${PRIMARY} h2`)].find(el => !el.closest('article') && el.textContent.trim() !== 'Your Lists');
    return { route: view.route, label: heading?.textContent.trim().slice(0, 100) || `List ${id}` };
  }
  return null;
}

async function togglePin(pin) {
  const account = workspaceAccount;
  try {
    const pins = await ipcRenderer.invoke('exiter:toggle-pin', account, pin);
    if (!pins || account !== workspaceAccount) return;
    const wasPinned = workspace.pins.some(item => item.route === pin.route);
    workspace.pins = pins;
    if (palette) renderPalette();
    const isPinned = pins.some(item => item.route === pin.route);
    showStatus(wasPinned ? 'Pin removed.' : isPinned ? 'Pinned to your command palette.' : 'Your palette has room for 12 pins.');
  } catch { showStatus('Couldn’t update your pins. Try again.'); }
}

if (isXWindow) {
  window.addEventListener('scroll', () => {
    if (!readingView() || readingRestore) return;
    clearTimeout(readingTimer);
    readingTimer = setTimeout(rememberReading, 380);
  }, { passive: true });
  document.addEventListener('click', (event) => {
    if (event.target.closest?.(`${TIMELINE} article`) && !event.target.closest('button, [role="button"]') &&
        event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) rememberReading();
  }, true);
  window.addEventListener('popstate', (event) => {
    if (!event.isTrusted) return;
    const view = readingView();
    const matches = view && [...recentPositions.values()].filter(pos => pos.route === view.route);
    if (matches?.length) {
      const position = recentPositions.get(viewKey(view)) || matches.at(-1);
      readingRestore = { position, expires: performance.now() + 2200, allowTabChange: true };
    }
  });
  for (const type of ['wheel', 'pointerdown', 'keydown']) {
    window.addEventListener(type, () => { readingRestore = undefined; }, { passive: true, capture: true });
  }
  window.addEventListener('keydown', (event) => {
    const { key, altKey, ctrlKey, metaKey, shiftKey, target } = event;
    if (!readingView() || palette || event.isComposing || event.defaultPrevented ||
        target.closest?.(`${EDITING}, [role="dialog"], [role="menu"], [role="listbox"]`) ||
        document.querySelector('[role="dialog"]')) return;
    const currentPost = target.closest?.('article[data-exiter-reading-focus]');
    if (key === 'Enter' && currentPost === target && !altKey && !ctrlKey && !metaKey && !shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      postLink(currentPost)?.click();
    }
    if (!altKey || ctrlKey || metaKey || shiftKey || !['ArrowDown', 'ArrowUp'].includes(key)) return;
    const posts = feedPosts();
    const currentIndex = posts.indexOf(currentPost);
    const direction = key === 'ArrowDown' ? 1 : -1;
    const visible = posts.filter(post => {
      const rect = post.getBoundingClientRect();
      return rect.bottom > 76 && rect.top < innerHeight;
    });
    const next = currentIndex < 0 ? (direction === 1 ? visible[0] : visible.at(-1)) : posts[currentIndex + direction];
    if (!next) return;
    event.preventDefault();
    event.stopPropagation();
    focusPost(next);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    next.scrollIntoView({ block: 'nearest', behavior: reduced ? 'instant' : 'smooth' });
  }, true);
}

/* ---------- Loading feedback and local timings ---------- */
let loadingIndicator;
let loadingTimer;
let navigationStarted;
let navigationIntent;
let launchMeasured = false;
let contentBeforeNavigation;
let lastUsableContent;
const logTiming = (name, started) => ipcRenderer.send('exiter:timing', name, performance.now() - started);

function startNavigationTiming() {
  const now = performance.now();
  navigationStarted = navigationIntent?.href === location.href && now - navigationIntent.started < 4000
    ? navigationIntent.started : now;
  navigationIntent = undefined;
  contentBeforeNavigation = lastUsableContent;
}

if (isXWindow) document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href]');
  if (!link || link.origin !== location.origin || (link.target && link.target !== '_self') ||
      link.href === location.href || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  navigationIntent = { href: link.href, started: performance.now() };
}, true);

function syncTimelineLoading() {
  if (!isXWindow) return;
  const primary = document.querySelector(PRIMARY);
  const indicator = primary?.querySelector('[role="progressbar"][aria-label="Loading timeline"]:not(article *, [role="dialog"] *)');
  if (indicator !== loadingIndicator) {
    clearTimeout(loadingTimer);
    loadingIndicator?.removeAttribute('data-exiter-skeleton');
    loadingIndicator = indicator;
    if (indicator) loadingTimer = setTimeout(() => {
      if (indicator.isConnected && loadingIndicator === indicator) indicator.setAttribute('data-exiter-skeleton', '');
    }, 180);
  }
  if (!primary || indicator) return;
  const article = primary.querySelector('article');
  const usable = article ? postPath(article) || article : primary.querySelector('[data-testid="emptyState"], [data-testid="UserName"]');
  if (!usable) return;
  lastUsableContent = usable;
  if (!launchMeasured && primary.querySelector(TIMELINE) && article) {
    launchMeasured = true;
    logTiming('launch to timeline', 0);
  }
  if (navigationStarted !== undefined && usable !== contentBeforeNavigation) {
    logTiming('navigation to content', navigationStarted);
    navigationStarted = undefined;
  }
}

const decodedImages = new WeakMap();
let galleryIdle;
function warmGallery() {
  const page = location.pathname.match(/^(\/[A-Za-z0-9_]{1,15}\/status\/\d+)\/photo\/(\d+)$/);
  if (!page || galleryIdle !== undefined || document.hidden) return;
  const [, post, index] = page;
  const candidate = [Number(index) + 1, Number(index) - 1]
    .map(number => document.querySelector(`a[href="${post}/photo/${number}"] img`))
    .find(img => img?.complete && img.naturalWidth && decodedImages.get(img) !== img.currentSrc);
  if (!candidate) return;
  const source = candidate.currentSrc;
  const route = location.pathname;
  galleryIdle = (window.requestIdleCallback || (callback => setTimeout(callback, 100)))(() => {
    galleryIdle = undefined;
    if (document.hidden || location.pathname !== route || !candidate.isConnected ||
        !candidate.complete || candidate.currentSrc !== source) return;
    decodedImages.set(candidate, source);
    candidate.decode().catch(() => {});
  });
}
document.addEventListener('load', event => { if (event.target instanceof HTMLImageElement) warmGallery(); }, true);
document.addEventListener('visibilitychange', warmGallery);

/* Only animate interactions whose active state changes on a mounted, visible post. */
const postActions = new WeakMap();
const ON_ACTIONS = [
  ['like', 'unlike'], ['bookmark', 'removeBookmark'], ['retweet', 'unretweet'],
];
const ACTION_SELECTOR = ON_ACTIONS.flat().map(id => `[data-testid="${id}"]`).join(',');
function markPostActionChanges() {
  for (const article of document.querySelectorAll(`${PRIMARY} article`)) {
    const path = postPath(article);
    const before = postActions.get(article);
    const actions = [...article.querySelectorAll(ACTION_SELECTOR)];
    const states = ON_ACTIONS.map(([off, on]) => {
      const button = actions.find(el => el.dataset.testid === on || el.dataset.testid === off);
      return button ? button.dataset.testid === on : undefined;
    });
    const stablePost = before && path && before.path === path;
    if (stablePost && states.some((state, index) => state !== before.states[index])) {
      const { top, bottom } = article.getBoundingClientRect();
      const visible = top < innerHeight && bottom > 0;
      actions.forEach(button => {
        const index = ON_ACTIONS.findIndex(pair => pair.includes(button.dataset.testid));
        if (states[index] === before.states[index]) return;
        button.toggleAttribute('data-exiter-action-pop', visible && before.states[index] === false && states[index] === true);
      });
    } else if (!stablePost) actions.forEach(button => button.removeAttribute('data-exiter-action-pop'));
    postActions.set(article, { path, states });
  }
}

/* ---------- Settings: reflect the user's choices as <html> attributes (read by hide.css/theme.css) and CSS variables ---------- */
const ACCENTS = { zinc: '#18181b', blue: '#2563eb', violet: '#7c3aed', rose: '#e11d48', green: '#16a34a', orange: '#ea580c' };
let current = null;

function applySettings(s) {
  const notificationsChanged = current?.desktopNotifications !== s.desktopNotifications;
  current = s;
  if (notificationsChanged) {
    clearTimeout(unreadTimer);
    unreadTimer = undefined;
    unread = unreadAccount = undefined;
    if (location.origin === 'https://x.com' && window === window.top) scheduleUnread();
  }
  const root = document.documentElement;
  if (!root) return; // Settings can arrive before <html>; DOMContentLoaded applies current again.
  const flag = (name, on) => (on ? root.setAttribute(name, '') : root.removeAttribute(name));
  root.setAttribute('data-ex-theme', s.theme);
  root.setAttribute('data-ex-density', s.density);
  root.setAttribute('data-ex-feed', s.feedWidth);
  root.setAttribute('data-ex-caps', s.caps);
  root.setAttribute('data-ex-leading', s.lineHeight);
  root.setAttribute('data-ex-font', s.fontFamily);
  flag('data-ex-hide-rail', s.hideRightRail);
  flag('data-ex-hide-logo', s.hideLogo);
  flag('data-ex-hide-floating', s.hideFloating);
  flag('data-ex-hide-ads', s.hideAds);
  flag('data-ex-hide-suggest', s.hideSuggestions);
  flag('data-ex-hide-metrics', s.hideMetrics);
  root.setAttribute('data-ex-nav-off', Object.entries(s.nav).filter(([, on]) => !on).map(([k]) => k).join(' '));

  // zinc follows the theme (near-black on light, near-white on dark); other accents are fixed colours
  const dark = s.theme === 'dark';
  const primary = s.accent === 'zinc' ? (dark ? '#fafafa' : '#18181b') : ACCENTS[s.accent] || ACCENTS.zinc;
  const onPrimary = s.accent === 'zinc' ? (dark ? '#18181b' : '#fafafa') : '#ffffff';
  let el = document.getElementById('exiter-vars');
  if (!el) { el = document.createElement('style'); el.id = 'exiter-vars'; (document.head || root).appendChild(el); }
  el.textContent = `:root[data-ex-theme]{--primary:${primary};--primary-foreground:${onPrimary};--radius:${s.radius}px;--radius-lg:${s.radius + 4}px;--ex-font-size:${s.fontSize}px;--media-max:${s.mediaMax}px;}`;

  enabled = !!s.hideAds;
  if (enabled) {
    document.querySelectorAll('[data-exiter-checked]').forEach((c) => c.removeAttribute('data-exiter-checked'));
    sweepAds();
  }
}

ipcRenderer.on('exiter:settings', (_e, s) => applySettings(s));
// Apply as early as possible on every fresh document, then keep the style element alive if X rebuilds <head>
ipcRenderer.invoke('exiter:get-settings').then(applySettings);
window.addEventListener('DOMContentLoaded', () => { if (current) applySettings(current); });

/* ---------- Document-start injection: skin + settings are applied synchronously, before X paints anything ---------- */
function injectSkin() {
  const root = document.documentElement;
  if (!root) return false;
  if (!document.getElementById('exiter-css')) {
    const style = document.createElement('style');
    style.id = 'exiter-css';
    style.textContent = ipcRenderer.sendSync('exiter:get-css');
    root.appendChild(style);
  }
  return true;
}
// At preload time <html> may not exist yet (the page is still arriving). Apply the skin AND the settings (theme, hiding, vars) together
// the moment it does, so a slow load never paints a light page for dark-theme users.
function bootstrap() {
  if (!injectSkin()) return false;
  applySettings(current || ipcRenderer.sendSync('exiter:get-settings-sync'));
  return true;
}
if (location.protocol !== 'file:') {
  try {
    bootstrap();
    // Re-run if X ever replaces the document element's children, or if <html> only appears after this script
    new MutationObserver(() => { if (!document.getElementById('exiter-css')) bootstrap(); }).observe(document, { childList: true, subtree: false });
    document.addEventListener('readystatechange', () => { if (!document.getElementById('exiter-css')) bootstrap(); });
  } catch (err) { console.warn('exiter inject failed', err); }
}

/* ---------- Timeline refresh ---------- */
let refreshing = false;
function scrollToTop() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
}
const firstPostKey = () => {
  const a = document.querySelector('[data-testid="primaryColumn"] article');
  const t = a && a.querySelector('time');
  return a ? ((t && t.parentElement && t.parentElement.getAttribute('href')) || a.textContent.slice(0, 80)) : '';
};
function refreshTimeline() {
  if (refreshing) return;
  const active = document.activeElement;
  if (active?.closest(EDITING)) return;
  if (!navigator.onLine) { showStatus('You’re offline. Reconnect and try again.'); return; }
  refreshing = true;
  const spin = (on) => {
    const button = document.querySelector('button[data-exiter-refresh]');
    if (!button) return;
    button.toggleAttribute('data-spinning', on);
    button.setAttribute('aria-busy', String(on));
    button.setAttribute('aria-disabled', String(on));
    button.setAttribute('aria-label', on ? 'Refreshing timeline' : 'Refresh timeline');
  };
  spin(true);
  const before = firstPostKey();
  const route = location.href;
  let done = false;
  let obs = null;
  let cap = null;
  const finish = (result) => {
    if (done) return;
    done = true;
    if (obs) obs.disconnect();
    clearTimeout(cap);
    refreshing = false;
    spin(false);
    if (location.href !== route) return;
    if (result === 'updated') {
      scrollToTop();
      showStatus('Timeline updated.');
    } else if (result === 'waiting') {
      showStatus('Still waiting for X. You can try again.');
    } else showStatus('No timeline change yet.');
  };
  const pill = document.querySelector('button[aria-label^="New posts are available"]');
  const onHome = location.pathname === '/home';
  const tab = document.querySelector('[role="tab"][aria-selected="true"]');
  if (!pill && !onHome && !tab) { refreshing = false; spin(false); ipcRenderer.send('exiter:reload-page'); return; }
  obs = new MutationObserver(() => {
    if (location.href !== route) finish();
    else {
      const next = firstPostKey();
      if (next && next !== before) finish('updated');
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  cap = setTimeout(() => finish(loadingIndicator ? 'waiting' : 'unchanged'), 2500);
  if (pill) { pill.click(); return; }
  if (!onHome) { tab.click(); return; } // clicking the active tab re-fetches it and scrolls to the top
  // X reloads the timeline on its own "." shortcut, but only for trusted key events, so the main process sends a real one.
  ipcRenderer.send('exiter:press-refresh-key');
}
ipcRenderer.on('exiter:do-refresh', refreshTimeline);

function ensureRefreshButton() {
  const plus = document.querySelector('button[aria-label="Manage timelines"]');
  if (!plus || !plus.parentElement || plus.parentElement.querySelector('button[data-exiter-refresh]')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('data-exiter-refresh', '');
  b.setAttribute('aria-label', 'Refresh timeline');
  b.title = 'Refresh timeline';
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.refreshCw}</svg>`;
  b.addEventListener('click', refreshTimeline);
  plus.parentElement.setAttribute('data-exiter-hdr-actions', '');
  plus.parentElement.insertBefore(b, plus);
}

/* ---------- Command palette (Cmd/Ctrl+K). Lives in a shadow root so X's CSS cannot touch it. ---------- */
const IS_MAC = /Mac/i.test(navigator.platform);
const MOD = IS_MAC ? '⌘' : 'Ctrl+';
const PALETTE_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .overlay { position: fixed; inset: 0; z-index: 2147483646; display: flex; justify-content: center; align-items: flex-start; padding-top: 14vh;
    background: rgba(0,0,0,.4); backdrop-filter: blur(2px); font: 14px/1.5 var(--ex-font, system-ui); letter-spacing: -0.011em; color: var(--foreground, #09090b);
    opacity: 0; visibility: hidden; pointer-events: none;
    transition: opacity var(--ex-dur-fast) var(--ex-ease), visibility 0s var(--ex-dur-fast); }
  :host-context(html[data-ex-theme="dark"]) .overlay { background: rgba(0,0,0,.65); }
  :host([data-open]) .overlay { opacity: 1; visibility: visible; pointer-events: auto; transition-delay: 0s; }
  .panel { width: min(560px, calc(100vw - 32px)); max-height: 70vh; display: flex; flex-direction: column; overflow: hidden; background: var(--background, #fff);
    border: 1px solid var(--border, #e4e4e7); border-radius: var(--radius-lg); box-shadow: var(--shadow-pop, 0 8px 30px rgba(0,0,0,.12));
    transform: translateY(-6px) scale(.985); transition: transform var(--ex-dur) var(--ex-ease); }
  :host([data-open]) .panel { transform: none; }
  .row { display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid var(--border, #e4e4e7); }
  .row svg { width: 16px; height: 16px; flex: none; fill: none; stroke: var(--muted-foreground, #71717a); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  input { flex: 1; min-width: 0; height: 52px; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; font-size: 15px; }
  input::placeholder { color: var(--muted-foreground, #71717a); }
  .row:focus-within { border-bottom-color: var(--ring); }
  .list { position: relative; overflow-y: auto; padding: 6px; overscroll-behavior: contain; }
  .group { padding: 8px 10px 4px; font-size: 12px; font-weight: 500; color: var(--muted-foreground, #71717a); }
  .item { position: relative; display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px; border-radius: var(--radius); cursor: pointer; }
  .item svg { width: 16px; height: 16px; flex: none; fill: none; stroke: var(--muted-foreground, #71717a); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .selection { position: absolute; inset: 0 6px auto; height: 36px; border-radius: var(--radius); background: var(--muted);
    pointer-events: none; transform: translateY(var(--selection-top, 0px)); }
  .selection[data-moving] { transition: transform var(--ex-dur-fast) var(--ex-ease); }
  .item[aria-selected="true"] svg { stroke: var(--foreground, #09090b); }
  .item .label { flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  kbd { font-family: var(--font-mono, ui-monospace, Menlo, monospace); font-size: 11px; line-height: 1; padding: 3px 5px; border: 1px solid var(--border, #e4e4e7); border-radius: 4px; background: var(--muted, #f4f4f5); color: var(--muted-foreground, #71717a); }
  .empty { padding: 28px 12px; text-align: center; color: var(--muted-foreground, #71717a); }
  .foot { display: flex; gap: 14px; align-items: center; padding: 8px 14px; border-top: 1px solid var(--border, #e4e4e7); color: var(--muted-foreground, #71717a); font-size: 12px; }
  .foot span { display: inline-flex; align-items: center; gap: 6px; }
  .close { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 7px; border: 0; background: transparent; cursor: pointer; }
  .close:hover { background: var(--muted); }
  .close:focus-visible { outline: 2px solid var(--ring); outline-offset: -2px; }
  .status { position: fixed; z-index: 2147483645; right: 20px; bottom: 20px; max-width: min(340px, calc(100vw - 40px));
    padding: 10px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--background);
    color: var(--foreground); box-shadow: var(--shadow-pop); font: 13px/1.5 var(--font-sans);
    opacity: 0; transform: translateY(4px); pointer-events: none; transition: opacity var(--ex-dur-fast), transform var(--ex-dur-fast); }
  .status[data-visible] { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .overlay, .panel, .status { transition: none; transform: none; }
    .selection[data-moving] { transition: none; }
  }
`;

let palette = null; // { host, input, list, items, active, restore }

function go(path) {
  if (path === location.pathname + location.search) return;
  navigationIntent = { href: new URL(path, location.origin).href, started: performance.now() };
  const link = document.querySelector(`a[href="${CSS.escape(path)}"]`);
  if (link) { link.click(); return; }
  // Same-document navigation: X's router listens for popstate, so this swaps the route without reloading (no splash, no lost state)
  try {
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  } catch { location.assign(path); }
}
ipcRenderer.on('exiter:show-notifications', () => go('/notifications'));
ipcRenderer.on('exiter:show-home', () => go('/home'));
function openComposer() {
  userInteracted = true;
  const draft = location.pathname === '/compose/post' && document.querySelector('[role="dialog"] [contenteditable="true"]');
  if (draft) { draft.focus({ preventScroll: true }); return; }
  const button = document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
  if (button) button.click();
  else if (profilePath()) go('/compose/post');
  else if (location.pathname !== '/compose/post') location.assign('/compose/post');
}
ipcRenderer.on('exiter:open-composer', openComposer);
const profilePath = () => document.querySelector(PROFILE_LINK)?.getAttribute('href');
const patch = async (settings, message) => {
  try {
    await ipcRenderer.invoke('exiter:set-settings', settings);
    if (message) showStatus(message);
  } catch {
    showStatus('Couldn’t apply that setting. Try again.');
  }
};

function buildCommands(query) {
  const dark = current && current.theme === 'dark';
  const profile = profilePath();
  const pin = workspaceAccount && currentPin();
  const pinnedHere = pin && workspace.pins.some(item => item.route === pin.route);
  const cmds = [
    ...(workspace.reading ? [{ group: 'Reading', label: 'Continue reading', icon: 'fileText', run: continueReading }] : []),
    ...workspace.pins.map(item => ({ group: 'Pinned', label: item.label, icon: item.route.startsWith('/search') ? 'search' : 'list', run: () => go(item.route) })),
    { group: 'Go to', label: 'Home', icon: 'house', run: () => go('/home') },
    { group: 'Go to', label: 'Explore', icon: 'search', run: () => go('/explore') },
    { group: 'Go to', label: 'Notifications', icon: 'bell', run: () => go('/notifications') },
    { group: 'Go to', label: 'Chat', icon: 'messageSquare', run: () => go('/i/chat') },
    ...(profile ? [
      { group: 'Go to', label: 'Profile', icon: 'user', run: () => go(profile) },
      { group: 'Go to', label: 'Lists', icon: 'users', run: () => go(`${profile}/lists`) },
    ] : []),
    { group: 'Go to', label: 'Bookmarks', icon: 'bookmark', run: () => go('/i/bookmarks') },
    { group: 'Actions', label: 'New post', icon: 'squarePen', hint: `${MOD}${IS_MAC ? '⇧' : 'Shift+'}N`, run: openComposer },
    ...(pin ? [{
      group: 'Actions', label: `${pinnedHere ? 'Unpin' : 'Pin'} this ${location.pathname === '/search' ? 'search' : 'list'}`,
      icon: 'bookmark', run: () => togglePin(pin),
    }] : []),
    { group: 'Actions', label: 'Refresh timeline', icon: 'refreshCw', hint: `${MOD}R`, run: refreshTimeline },
    { group: 'Actions', label: 'Scroll to top', icon: 'arrowUp', run: scrollToTop },
    { group: 'Actions', label: 'Go back', icon: 'arrowLeft', hint: `${MOD}[`, run: () => history.back() },
    { group: 'Actions', label: 'Go forward', icon: 'arrowRight', hint: `${MOD}]`, run: () => history.forward() },
    { group: 'Settings', label: 'Open settings', icon: 'sliders', hint: `${MOD},`, run: () => ipcRenderer.send('exiter:open-settings') },
    { group: 'Settings', label: 'Check for updates', icon: 'refreshCw', run: () => ipcRenderer.send('exiter:check-updates') },
    { group: 'Settings', label: dark ? 'Switch to light theme' : 'Switch to dark theme', icon: dark ? 'sun' : 'moon', run: () => patch({ theme: dark ? 'light' : 'dark' }) },
    { group: 'Settings', label: current?.hideMetrics ? 'Show counts' : 'Hide counts', icon: 'chart', run: () => patch({ hideMetrics: !current?.hideMetrics }, current?.hideMetrics ? 'Engagement counts shown.' : 'Engagement counts hidden.') },
    { group: 'Settings', label: current?.hideAds ? 'Show promoted posts' : 'Hide promoted posts', icon: 'list', run: () => patch({ hideAds: !current?.hideAds }, current?.hideAds ? 'Promoted posts shown.' : 'Promoted posts hidden.') },
  ];
  const q = query.trim();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = words.length ? cmds.filter((c) => words.every((w) => c.label.toLowerCase().includes(w))) : cmds;
  if (q) {
    const handle = q.replace(/^@/, '');
    if (/^[A-Za-z0-9_]{1,15}$/.test(handle)) out.push({ group: 'Search', label: `Open profile @${handle}`, icon: 'user', run: () => go(`/${handle}`) });
    out.push({ group: 'Search', label: `Search X for “${q}”`, icon: 'search', run: () => go(`/search?q=${encodeURIComponent(q)}&src=typed_query`) });
  }
  return out;
}

function renderPalette() {
  const p = palette;
  const cmds = buildCommands(p.input.value);
  p.items = cmds;
  p.active = Math.min(p.active, Math.max(cmds.length - 1, 0));
  p.list.replaceChildren();
  if (!cmds.length) {
    const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No results. Try a name or a page.'; p.list.append(e);
    p.input.removeAttribute('aria-activedescendant');
    return;
  }
  let lastGroup = null;
  const selection = document.createElement('div');
  selection.className = 'selection';
  selection.setAttribute('aria-hidden', 'true');
  p.list.append(selection);
  cmds.forEach((c, i) => {
    if (c.group !== lastGroup) { const g = document.createElement('div'); g.className = 'group'; g.setAttribute('role', 'presentation'); g.textContent = c.group; p.list.append(g); lastGroup = c.group; }
    const el = document.createElement('div');
    el.className = 'item'; el.id = `exp-${i}`; el.setAttribute('role', 'option'); el.setAttribute('aria-selected', String(i === p.active));
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[c.icon] || ''}</svg><span class="label"></span>${c.hint ? '<kbd></kbd>' : ''}`;
    el.querySelector('.label').textContent = c.label;
    if (c.hint) el.querySelector('kbd').textContent = c.hint;
    el.addEventListener('mousemove', (e) => { if ((e.movementX || e.movementY) && p.active !== i) { p.active = i; markActive(); } });
    el.addEventListener('click', () => runActive(i));
    p.list.append(el);
  });
  markActive(false);
}

function markActive(animate = true) {
  const p = palette;
  const items = p.list.querySelectorAll('.item');
  items.forEach((el, i) => el.setAttribute('aria-selected', String(i === p.active)));
  p.input.setAttribute('aria-activedescendant', `exp-${p.active}`);
  const el = items[p.active];
  if (!el) return;
  const selection = p.list.querySelector('.selection');
  selection.toggleAttribute('data-moving', animate);
  selection.style.setProperty('--selection-top', `${el.offsetTop}px`);
  if (p.active === 0) p.list.scrollTop = 0;
  else if (el.offsetTop < p.list.scrollTop) p.list.scrollTop = el.offsetTop;
  else if (el.offsetTop + el.offsetHeight > p.list.scrollTop + p.list.clientHeight) {
    p.list.scrollTop = el.offsetTop + el.offsetHeight - p.list.clientHeight;
  }
}

function runActive(i) {
  const cmd = palette && palette.items[i];
  if (!cmd) return;
  closePalette();
  setTimeout(cmd.run, 0);
}

let warm = null; // the palette's DOM, built once at idle and reused; `palette` is only set while it is open
let statusTimer;

function showStatus(message) {
  const { status } = ensureWarm();
  clearTimeout(statusTimer);
  status.textContent = message;
  status.setAttribute('data-visible', '');
  statusTimer = setTimeout(() => { status.removeAttribute('data-visible'); status.textContent = ''; }, 3000);
}

function ensureWarm() {
  if (warm) return warm;
  const host = document.createElement('div');
  host.id = 'exiter-palette';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${PALETTE_CSS}</style>
    <div class="overlay" inert><div class="panel" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="row"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.search}</svg>
        <input type="text" role="combobox" aria-label="Find a command or search X" aria-expanded="true" aria-controls="list" aria-autocomplete="list" placeholder="Type a command or search…" spellcheck="false" autocomplete="off">
        <button type="button" class="close" aria-label="Close command palette" title="Close (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.x}</svg></button></div>
      <div class="list" id="list" role="listbox"></div>
      <div class="foot"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Select</span></div>
    </div></div><div class="status" role="status"></div>`;
  (document.body || document.documentElement).appendChild(host);
  const overlay = root.querySelector('.overlay');
  const close = root.querySelector('.close');
  warm = { host, overlay, input: root.querySelector('input'), list: root.querySelector('.list'), status: root.querySelector('.status') };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePalette(); });
  close.addEventListener('click', closePalette);
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); }
    if (e.key === 'Tab') { e.preventDefault(); (e.target === close ? warm.input : close).focus(); }
  });
  warm.input.addEventListener('input', () => { if (!palette) return; palette.active = 0; renderPalette(); });
  warm.input.addEventListener('keydown', (e) => {
    if (!palette) return;
    const n = palette.items.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) { palette.active = (palette.active + 1) % n; markActive(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) { palette.active = (palette.active - 1 + n) % n; markActive(); } }
    else if (e.key === 'Enter') { e.preventDefault(); runActive(palette.active); }
  });
  return warm;
}

function openPalette() {
  if (palette) return;
  const started = performance.now();
  const w = ensureWarm();
  palette = { host: w.host, input: w.input, list: w.list, items: [], active: 0, restore: document.activeElement };
  w.input.value = '';
  w.host.setAttribute('data-open', '');
  w.overlay.inert = false;
  renderPalette();
  w.input.focus({ preventScroll: true });
  requestAnimationFrame(() => logTiming('palette to input', started));
}

function closePalette() {
  if (!palette) return;
  const { host, restore } = palette;
  palette = null;
  warm.overlay.inert = true;
  host.removeAttribute('data-open');
  if (restore && typeof restore.focus === 'function' && document.contains(restore)) restore.focus({ preventScroll: true });
}

window.addEventListener('keydown', (e) => {
  if (location.origin !== 'https://x.com' || window !== window.top) return;
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault(); e.stopPropagation();
    palette ? closePalette() : openPalette();
  }
}, true);

/* ---------- Warm-up: have the real fonts decoded and connections open before the first menu, palette or image needs them ---------- */
function loadFonts() {
  // Raw bytes through the FontFace API: x.com's CSP blocks data: URLs in @font-face, but not this
  try {
    for (const f of ipcRenderer.sendSync('exiter:get-fonts')) {
      const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
      const face = new FontFace(f.family, bytes.buffer, { weight: f.weight, style: 'normal', display: 'block' });
      face.load().then(() => document.fonts.add(face)).catch((err) => console.warn('[exiter] font failed:', f.family, f.weight, err && err.message));
    }
  } catch (err) { console.warn('[exiter] fonts:', err && err.message); }
}

function warmUp() {
  const head = document.head || document.documentElement;
  ['https://pbs.twimg.com', 'https://video.twimg.com', 'https://abs.twimg.com', 'https://api.x.com'].forEach((href) => {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
    const l = document.createElement('link');
    l.rel = 'preconnect'; l.href = href; l.crossOrigin = '';
    head.appendChild(l);
  });
}
if (location.protocol !== 'file:') {
  loadFonts();
  try { warmUp(); } catch {}
  window.addEventListener('DOMContentLoaded', () => {
    warmUp();
    (window.requestIdleCallback || ((cb) => setTimeout(cb, 1500)))(() => ensureWarm(), { timeout: 4000 });
  });
}
