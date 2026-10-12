const NAV = [
  ['home', 'Home'], ['explore', 'Explore'], ['notifications', 'Notifications'], ['chat', 'Chat'], ['profile', 'Profile'], ['more', 'More'],
  ['bookmarks', 'Bookmarks'], ['lists', 'Lists'], ['communities', 'Communities'], ['calls', 'Calls'], ['history', 'History'],
  ['articles', 'Articles'], ['creator', 'Creator Studio'], ['jobs', 'Jobs'], ['premium', 'Premium'], ['grok', 'Grok'],
];
const ACCENTS = { zinc: '#71717a', blue: '#2563eb', violet: '#7c3aed', rose: '#e11d48', green: '#16a34a', orange: '#ea580c' };

const GROUPS = [
  { title: 'Appearance', rows: [
    { type: 'seg', key: 'theme', label: 'Theme', desc: 'Reloads the page when changed.', options: [['light', 'Light'], ['dark', 'Dark']] },
    { type: 'swatch', key: 'accent', label: 'Accent', desc: 'Post button and highlights.' },
    { type: 'range', key: 'radius', label: 'Corner radius', min: 0, max: 16, step: 1, unit: 'px' },
  ] },
  { title: 'Text', rows: [
    { type: 'seg', key: 'fontFamily', label: 'Font', options: [['geist', 'Geist'], ['system', 'System'], ['serif', 'Serif'], ['mono', 'Mono']] },
    { type: 'range', key: 'fontSize', label: 'Post text size', min: 13, max: 22, step: 1, unit: 'px' },
    { type: 'seg', key: 'lineHeight', label: 'Line spacing', options: [['tight', 'Tight'], ['normal', 'Normal'], ['relaxed', 'Relaxed']] },
    { type: 'range', key: 'uiZoom', label: 'Interface zoom', desc: 'Scales the whole app.', min: 80, max: 130, step: 5, unit: '%' },
    { type: 'seg', key: 'caps', label: 'CAPITALISE usernames', desc: 'On posts in the feed.', options: [['off', 'Off'], ['names', 'Names'], ['all', 'Names + @handles']] },
  ] },
  { title: 'Layout', rows: [
    { type: 'seg', key: 'feedWidth', label: 'Feed width', options: [['fill', 'Fill'], ['medium', 'Medium'], ['narrow', 'Narrow']] },
    { type: 'seg', key: 'density', label: 'Density', options: [['comfortable', 'Comfortable'], ['compact', 'Compact']] },
    { type: 'range', key: 'mediaMax', label: 'Max media width', min: 360, max: 960, step: 20, unit: 'px' },
  ] },
  { title: 'Content', rows: [
    { type: 'toggle', key: 'hideAds', label: 'Hide promoted posts', desc: 'Ads and promoted cards in the feed.' },
    { type: 'toggle', key: 'hideRightRail', label: 'Hide right column', desc: 'Search, trends, news, who to follow.' },
    { type: 'toggle', key: 'hideSuggestions', label: 'Hide suggestions', desc: 'Premium upsells and follow suggestions in the feed.' },
    { type: 'toggle', key: 'hideFloating', label: 'Hide floating chat & Grok', desc: 'The buttons in the bottom-right corner.' },
    { type: 'toggle', key: 'hideLogo', label: 'Hide X logo' },
    { type: 'toggle', key: 'hideMetrics', label: 'Hide counts', desc: 'Like, repost, reply and view numbers.' },
  ] },
  { title: 'Sidebar', rows: NAV.map(([k, label]) => ({ type: 'nav', key: k, label })) },
  { title: 'App', rows: [
    { type: 'toggle', key: 'launchAtLogin', label: 'Launch at login' },
  ] },
  { title: 'Updates', rows: [
    { type: 'toggle', key: 'autoUpdate', label: 'Check for updates automatically' },
    { type: 'button', label: 'Check for updates', desc: '', button: 'Check now', action: () => window.exiter.checkForUpdates(), versionDesc: true },
  ] },
];

const root = document.getElementById('root');
let state = null;
const el = (tag, attrs = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), attrs);
  kids.flat().forEach((k) => e.append(k));
  return e;
};

function control(row) {
  if (row.type === 'toggle' || row.type === 'nav') {
    const nav = row.type === 'nav';
    const input = el('input', { type: 'checkbox', checked: nav ? state.nav[row.key] : state[row.key] });
    input.addEventListener('change', () => window.exiter.set(nav ? { nav: { [row.key]: input.checked } } : { [row.key]: input.checked }));
    return el('label', { className: 'switch' }, input, el('i'));
  }
  if (row.type === 'seg') {
    const wrap = el('div', { className: 'seg' });
    for (const [v, label] of row.options) {
      const b = el('button', { textContent: label, type: 'button' });
      b.setAttribute('aria-pressed', String(state[row.key] === v));
      b.addEventListener('click', () => window.exiter.set({ [row.key]: v }));
      wrap.append(b);
    }
    return wrap;
  }
  if (row.type === 'swatch') {
    const wrap = el('div', { className: 'sw' });
    for (const [k, color] of Object.entries(ACCENTS)) {
      const b = el('button', { type: 'button', title: k });
      b.style.background = color;
      b.setAttribute('aria-pressed', String(state.accent === k));
      b.addEventListener('click', () => window.exiter.set({ accent: k }));
      wrap.append(b);
    }
    return wrap;
  }
  if (row.type === 'button') {
    const b = el('button', { type: 'button', className: 'btn', textContent: row.button });
    b.addEventListener('click', row.action);
    return b;
  }
  if (row.type === 'range') {
    const out = el('output', { textContent: state[row.key] + row.unit });
    const input = el('input', { type: 'range', min: row.min, max: row.max, step: row.step, value: state[row.key] });
    input.addEventListener('input', () => { out.textContent = input.value + row.unit; });
    input.addEventListener('change', () => window.exiter.set({ [row.key]: Number(input.value) }));
    return el('div', { className: 'range' }, input, out);
  }
}

function render() {
  const scroll = window.scrollY;
  root.replaceChildren(...GROUPS.map((g) => el('section', {}, el('h2', { textContent: g.title }),
    g.rows.map((r) => el('div', { className: 'row' },
      el('div', { className: 't' }, el('b', { textContent: r.label }), r.versionDesc ? el('span', { textContent: versionInfo ? `Exiter ${versionInfo.version}${versionInfo.updatesEnabled ? '' : ' (updates are off in development builds)'}` : '' }) : (r.desc ? el('span', { textContent: r.desc }) : '')),
      control(r))))));
  window.scrollTo(0, scroll);
}

document.getElementById('reset').addEventListener('click', () => window.exiter.reset());
window.exiter.onChange((s) => { state = s; render(); });
let versionInfo = null;
window.exiter.version().then((v) => { versionInfo = v; render(); });
window.exiter.get().then((s) => { state = s; render(); });
