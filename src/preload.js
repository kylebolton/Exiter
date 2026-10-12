// Runs in an isolated world with no Node access (sandboxed, so no local requires).
// 1) hides promoted posts that CSS alone can't catch, 2) swaps X's icons for Lucide-style line icons.
const { ipcRenderer } = require('electron');

/* ---------- Lucide icon paths (ISC licence, https://lucide.dev), 24x24 viewBox ---------- */
const ICONS = {
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
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  squarePen: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>',
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

/* ---------- Composer input box: tag the single ancestor X draws a border on ---------- */
function tagComposerInput() {
  document.querySelectorAll('[data-testid="tweetTextarea_0_label"]:not([data-exiter-tagged])').forEach((label) => {
    label.setAttribute('data-exiter-tagged', '1');
    for (let e = label.parentElement, i = 0; e && i < 16; e = e.parentElement, i++) {
      const cs = getComputedStyle(e);
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') { e.setAttribute('data-exiter-input', '1'); break; }
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

/* ---------- Free X's 600px width caps inside the main column (the depth differs per page) ---------- */
let uncapTimer = null;
function uncapColumn() {
  const col = document.querySelector('[data-testid="primaryColumn"]');
  if (!col) return;
  let level = [col];
  for (let depth = 0; depth < 8 && level.length; depth++) {
    const next = [];
    for (const el of level) {
      for (const k of el.children) {
        if (k.tagName !== 'DIV' && k.tagName !== 'SECTION') continue;
        if (k.hasAttribute('data-exiter-free')) { next.push(k); continue; }
        if (getComputedStyle(k).maxWidth === '600px') k.setAttribute('data-exiter-free', '1');
        next.push(k);
      }
    }
    level = next.length > 400 ? [] : next;
  }
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

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; sweepAds(); sweepIcons(); tagComposerInput(); ensureRefreshButton(); releaseAutofocus(); tagQuoteCards(); clearTimeout(uncapTimer); uncapTimer = setTimeout(uncapColumn, 250); });
}

window.addEventListener('DOMContentLoaded', () => {
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
});

/* ---------- Settings: reflect the user's choices as <html> attributes (read by hide.css/theme.css) and CSS variables ---------- */
const ACCENTS = { zinc: '#18181b', blue: '#2563eb', violet: '#7c3aed', rose: '#e11d48', green: '#16a34a', orange: '#ea580c' };
let current = null;

function applySettings(s) {
  current = s;
  const root = document.documentElement;
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
function refreshTimeline() {
  const btn = document.querySelector('button[data-exiter-refresh]');
  if (btn) { btn.setAttribute('data-spinning', ''); setTimeout(() => btn.removeAttribute('data-spinning'), 800); }
  const pill = document.querySelector('button[aria-label^="New posts are available"]');
  if (pill) { pill.click(); return; }
  if (location.pathname === '/home') {
    // X reloads the timeline on its own "." shortcut, but only for trusted key events, so the main process sends a real one.
    // Skip it while the user is typing so a "." never lands in the composer.
    window.scrollTo(0, 0);
    const a = document.activeElement;
    if (a && a !== document.body && a.closest && a.closest('[contenteditable="true"], input, textarea')) a.blur();
    setTimeout(() => ipcRenderer.send('exiter:press-refresh-key'), 120);
  } else {
    ipcRenderer.send('exiter:reload-page');
  }
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
    background: rgba(0,0,0,.4); backdrop-filter: blur(2px); font: 14px/1.5 var(--ex-font, system-ui); letter-spacing: -0.011em; color: var(--foreground, #09090b); animation: fade .12s ease-out; }
  :host-context(html[data-ex-theme="dark"]) .overlay { background: rgba(0,0,0,.65); }
  .panel { width: min(560px, calc(100vw - 32px)); max-height: 70vh; display: flex; flex-direction: column; overflow: hidden; background: var(--background, #fff);
    border: 1px solid var(--border, #e4e4e7); border-radius: 12px; box-shadow: var(--shadow-pop, 0 8px 30px rgba(0,0,0,.12)); animation: pop .12s ease-out; }
  .row { display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid var(--border, #e4e4e7); }
  .row svg { width: 16px; height: 16px; flex: none; fill: none; stroke: var(--muted-foreground, #71717a); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  input { flex: 1; height: 48px; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; font-size: 15px; }
  input::placeholder { color: var(--muted-foreground, #71717a); }
  .list { overflow-y: auto; padding: 6px; }
  .group { padding: 8px 10px 4px; font-size: 12px; font-weight: 500; color: var(--muted-foreground, #71717a); }
  .item { display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px; border-radius: 8px; cursor: pointer; }
  .item svg { width: 16px; height: 16px; flex: none; fill: none; stroke: var(--muted-foreground, #71717a); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .item[aria-selected="true"] { background: var(--muted, #f4f4f5); }
  .item[aria-selected="true"] svg { stroke: var(--foreground, #09090b); }
  .item .label { flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  kbd { font-family: var(--font-mono, ui-monospace, Menlo, monospace); font-size: 11px; line-height: 1; padding: 3px 5px; border: 1px solid var(--border, #e4e4e7); border-radius: 4px; background: var(--muted, #f4f4f5); color: var(--muted-foreground, #71717a); }
  .empty { padding: 28px 12px; text-align: center; color: var(--muted-foreground, #71717a); }
  .foot { display: flex; gap: 14px; align-items: center; padding: 8px 14px; border-top: 1px solid var(--border, #e4e4e7); color: var(--muted-foreground, #71717a); font-size: 12px; }
  .foot span { display: inline-flex; align-items: center; gap: 6px; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: scale(.98) translateY(-4px); } }
  @media (prefers-reduced-motion: reduce) { .overlay, .panel { animation: none; } }
`;

let palette = null; // { host, input, list, items, active, restore }

function go(path) {
  const link = document.querySelector(`a[href="${path}"]`);
  if (link) link.click(); else location.assign(path);
}
const profilePath = () => (document.querySelector('a[data-testid="AppTabBar_Profile_Link"]') || {}).getAttribute?.('href') || '/home';
const patch = (p) => ipcRenderer.invoke('exiter:set-settings', p);

function buildCommands(query) {
  const dark = current && current.theme === 'dark';
  const cmds = [
    { group: 'Go to', label: 'Home', icon: 'house', run: () => go('/home') },
    { group: 'Go to', label: 'Explore', icon: 'search', run: () => go('/explore') },
    { group: 'Go to', label: 'Notifications', icon: 'bell', run: () => go('/notifications') },
    { group: 'Go to', label: 'Chat', icon: 'messageSquare', run: () => go('/i/chat') },
    { group: 'Go to', label: 'Profile', icon: 'user', run: () => go(profilePath()) },
    { group: 'Go to', label: 'Bookmarks', icon: 'bookmark', run: () => go('/i/bookmarks') },
    { group: 'Go to', label: 'Lists', icon: 'users', run: () => go(`${profilePath()}/lists`) },
    { group: 'Actions', label: 'New post', icon: 'squarePen', hint: `${MOD}${IS_MAC ? '⇧' : 'Shift+'}N`, run: () => { const b = document.querySelector('[data-testid="SideNav_NewTweet_Button"]'); b ? b.click() : go('/compose/post'); } },
    { group: 'Actions', label: 'Refresh timeline', icon: 'refreshCw', hint: `${MOD}R`, run: refreshTimeline },
    { group: 'Actions', label: 'Scroll to top', icon: 'arrowUp', run: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { group: 'Actions', label: 'Go back', icon: 'arrowLeft', hint: `${MOD}[`, run: () => history.back() },
    { group: 'Actions', label: 'Go forward', icon: 'arrowRight', hint: `${MOD}]`, run: () => history.forward() },
    { group: 'Settings', label: 'Open settings', icon: 'sliders', hint: `${MOD},`, run: () => ipcRenderer.send('exiter:open-settings') },
    { group: 'Settings', label: 'Check for updates', icon: 'refreshCw', run: () => ipcRenderer.send('exiter:check-updates') },
    { group: 'Settings', label: dark ? 'Switch to light theme' : 'Switch to dark theme', icon: dark ? 'sun' : 'moon', run: () => patch({ theme: dark ? 'light' : 'dark' }) },
    { group: 'Settings', label: current && current.hideMetrics ? 'Show counts' : 'Hide counts', icon: 'chart', run: () => patch({ hideMetrics: !(current && current.hideMetrics) }) },
    { group: 'Settings', label: current && current.hideAds ? 'Show promoted posts' : 'Hide promoted posts', icon: 'list', run: () => patch({ hideAds: !(current && current.hideAds) }) },
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
  p.input.setAttribute('aria-activedescendant', `exp-${p.active}`);
}

function markActive() {
  const p = palette;
  p.list.querySelectorAll('.item').forEach((el, i) => el.setAttribute('aria-selected', String(i === p.active)));
  p.input.setAttribute('aria-activedescendant', `exp-${p.active}`);
  const el = p.list.querySelector(`#exp-${p.active}`);
  if (p.active === 0) p.list.scrollTop = 0; else if (el) el.scrollIntoView({ block: 'nearest' });
}

function runActive(i) {
  const cmd = palette && palette.items[i];
  if (!cmd) return;
  closePalette();
  setTimeout(cmd.run, 0);
}

let warm = null; // the palette's DOM, built once at idle and reused; `palette` is only set while it is open

function ensureWarm() {
  if (warm) return warm;
  const host = document.createElement('div');
  host.id = 'exiter-palette';
  host.style.display = 'none';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${PALETTE_CSS}</style>
    <div class="overlay"><div class="panel" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="row"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.search}</svg>
        <input type="text" role="combobox" aria-expanded="true" aria-controls="list" aria-autocomplete="list" placeholder="Type a command or search…" spellcheck="false" autocomplete="off"><kbd>esc</kbd></div>
      <div class="list" id="list" role="listbox"></div>
      <div class="foot"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Select</span></div>
    </div></div>`;
  (document.body || document.documentElement).appendChild(host);
  warm = { host, input: root.querySelector('input'), list: root.querySelector('.list') };
  root.querySelector('.overlay').addEventListener('mousedown', (e) => { if (e.target.classList.contains('overlay')) closePalette(); });
  warm.input.addEventListener('input', () => { if (!palette) return; palette.active = 0; renderPalette(); });
  warm.input.addEventListener('keydown', (e) => {
    if (!palette) return;
    const n = palette.items.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) { palette.active = (palette.active + 1) % n; markActive(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) { palette.active = (palette.active - 1 + n) % n; markActive(); } }
    else if (e.key === 'Enter') { e.preventDefault(); runActive(palette.active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); }
    else if (e.key === 'Tab') { e.preventDefault(); } // focus stays in the palette while it is open
  });
  return warm;
}

function openPalette() {
  if (palette) return;
  const w = ensureWarm();
  palette = { host: w.host, input: w.input, list: w.list, items: [], active: 0, restore: document.activeElement };
  w.input.value = '';
  w.host.style.display = ''; // display none -> block restarts the open animation
  renderPalette();
  w.input.focus();
}

function closePalette() {
  if (!palette) return;
  const { host, restore } = palette;
  palette = null;
  host.style.display = 'none';
  if (restore && typeof restore.focus === 'function' && document.contains(restore)) restore.focus();
}

window.addEventListener('keydown', (e) => {
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
