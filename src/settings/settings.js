const NAV = [
  ['home', 'Home'], ['explore', 'Explore'], ['notifications', 'Notifications'], ['chat', 'Chat'], ['profile', 'Profile'], ['more', 'More'],
  ['bookmarks', 'Bookmarks'], ['lists', 'Lists'], ['communities', 'Communities'], ['calls', 'Calls'], ['history', 'History'],
  ['articles', 'Articles'], ['creator', 'Creator Studio'], ['jobs', 'Jobs'], ['premium', 'Premium'], ['grok', 'Grok'],
];
const ACCENTS = { zinc: '#71717a', blue: '#2563eb', violet: '#7c3aed', rose: '#e11d48', green: '#16a34a', orange: '#ea580c' };

let versionInfo;
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
    { type: 'seg', key: 'density', label: 'Density', options: [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['airy', 'Airy']] },
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
  { title: 'Notifications', rows: [
    { type: 'toggle', key: 'desktopNotifications', label: 'Desktop notifications', desc: 'Show a quiet alert for new X activity while Exiter is open in the background.' },
    { type: 'button', key: 'testNotification', label: 'Preview a notification', button: 'Send test',
      desc: 'Uses your system notification settings.', action: () => window.exiter.testNotification() },
  ] },
  { title: 'Updates', rows: [
    { type: 'toggle', key: 'autoUpdate', label: 'Check for updates automatically' },
    { type: 'button', key: 'checkUpdates', label: 'Check for updates', button: 'Check now', action: () => window.exiter.checkForUpdates(), versionDesc: true },
  ] },
];

const root = document.getElementById('root');
const status = document.getElementById('status');
const reset = document.getElementById('reset');
const confirmation = document.getElementById('confirm-reset');
const bindings = [];
let state;
let statusTimeout;

const el = (tag, attrs = {}, ...kids) => {
  const element = Object.assign(document.createElement(tag), attrs);
  element.append(...kids.flat());
  return element;
};

function showStatus(message, persistent = false) {
  clearTimeout(statusTimeout);
  status.textContent = message;
  status.toggleAttribute('data-visible', !!message);
  if (message && !persistent) statusTimeout = setTimeout(() => showStatus(''), 2500);
}

function update(next) {
  if (!next) return;
  state = next;
  document.documentElement.dataset.exTheme = next.theme;
  for (const binding of bindings) binding();
}

async function act(action, message, restore) {
  try {
    const result = await action();
    if (typeof result === 'string' || message) showStatus(result || message);
  } catch {
    restore?.();
    showStatus('Couldn’t complete that action. Try again.', true);
  }
}

function control(row) {
  const { key, type } = row;
  const labelId = key + '-label';
  const value = () => type === 'nav' ? state?.nav[key] : state?.[key];
  const save = (next, restore) => {
    if (next === value()) return;
    const patch = type === 'nav' ? { nav: { [key]: next } } : { [key]: next };
    act(() => window.exiter.set(patch), 'Saved', restore);
  };
  if (type === 'toggle' || type === 'nav') {
    const input = el('input', { type: 'checkbox' });
    input.setAttribute('role', 'switch');
    input.setAttribute('aria-labelledby', labelId);
    const sync = () => { input.checked = !!value(); };
    bindings.push(sync);
    input.addEventListener('change', () => save(input.checked, sync));
    return el('label', { className: 'switch' }, input, el('i'));
  }
  if (type === 'seg' || type === 'swatch') {
    const options = row.options || Object.keys(ACCENTS).map(key => [key, key[0].toUpperCase() + key.slice(1)]);
    const group = el('div', { className: type });
    group.setAttribute('role', 'group');
    group.setAttribute('aria-labelledby', labelId);
    for (const [option, label] of options) {
      const button = el('button', { type: 'button', textContent: type === 'seg' ? label : '', title: label });
      if (type === 'swatch') {
        button.style.setProperty('--swatch', ACCENTS[option]);
        button.setAttribute('aria-label', label);
      }
      bindings.push(() => button.setAttribute('aria-pressed', String(value() === option)));
      button.addEventListener('click', () => save(option));
      group.append(button);
    }
    return group;
  }
  if (type === 'range') {
    const output = el('output');
    const input = el('input', { id: key, type: 'range', min: row.min, max: row.max, step: row.step });
    input.setAttribute('aria-labelledby', labelId);
    output.setAttribute('for', key);
    const preview = () => {
      output.value = input.value + row.unit;
      input.setAttribute('aria-valuetext', output.value);
    };
    let applied;
    const sync = () => { applied = value(); input.value = applied; preview(); };
    bindings.push(() => { if (applied !== value()) sync(); });
    input.addEventListener('input', preview);
    input.addEventListener('change', () => save(Number(input.value), sync));
    return el('div', { className: 'range' }, input, output);
  }

  const button = el('button', { className: 'btn', type: 'button', textContent: row.button });
  button.setAttribute('aria-describedby', key + '-description');
  button.addEventListener('click', async () => {
    if (button.getAttribute('aria-busy') === 'true') return;
    button.setAttribute('aria-busy', 'true');
    if (key === 'testNotification') button.textContent = 'Sending…';
    await act(row.action);
    button.removeAttribute('aria-busy');
    button.textContent = row.button;
  });
  return button;
}

function render() {
  const navigation = document.getElementById('sections');
  for (const group of GROUPS) {
    const id = group.title.toLowerCase();
    navigation.append(el('a', { href: '#' + id, textContent: group.title }));
    const heading = el('h2', { id: id + '-heading', textContent: group.title });
    const section = el('section', { id }, heading);
    section.setAttribute('aria-labelledby', heading.id);
    const rows = el('div', { className: 'rows' });
    for (const row of group.rows) {
      const desc = row.versionDesc ? 'Exiter ' + versionInfo.version
        + (versionInfo.updatesEnabled ? '' : ' · Updates are off in development builds') : row.desc;
      rows.append(el('div', { className: 'row' },
        el('div', { className: 'label' },
          el('span', { id: row.key + '-label', className: 'name', textContent: row.label }),
          desc ? el('span', { id: row.key + '-description', className: 'description', textContent: desc }) : ''),
        control(row)));
    }
    section.append(rows);
    root.append(section);
  }
  const isMac = /Mac/i.test(navigator.platform);
  document.getElementById('shortcuts').textContent = isMac ? '⌘⇧X Show or hide · ⌘⇧N New post'
    : 'Ctrl+Shift+X Show or hide · Ctrl+Shift+N New post';
  reset.disabled = false;
  const syncNavigation = () => {
    for (const link of navigation.children) {
      if (link.hash === location.hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  window.addEventListener('hashchange', syncNavigation);
  syncNavigation();
}

reset.addEventListener('click', () => {
  confirmation.returnValue = '';
  confirmation.showModal();
});
confirmation.addEventListener('close', () => {
  if (confirmation.returnValue === 'reset') act(() => window.exiter.reset(), 'Settings reset');
  reset.focus();
});
window.exiter.onChange(update);
Promise.all([window.exiter.get(), window.exiter.version()]).then(([settings, version]) => {
  versionInfo = version;
  render();
  update(state || settings);
}).catch(() => showStatus('Couldn’t load settings.', true));
