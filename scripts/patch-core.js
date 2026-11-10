/** WenSenLab_ ©文森策 — author baseline: 2026-10-19 Solid Ink v2. */
const fs = require('node:fs');
const path = require('node:path');
const PATCH_VERSION = '20261019-solid-consolidated-v2';
const IMPLEMENTATION_VERSION = 'wensen-20261111-v1';
const PRESETS = ['high-contrast', 'claude-desktop-purewhite', 'vintage-deep'];
const ALIASES = {
  'chuanban-warm-white': PRESETS[0], '高对比版': PRESETS[0],
  'claude-desktop-official': PRESETS[1], 'ClaudeDesktop 净白': PRESETS[1],
  'absoulutely-chuanban': PRESETS[2], '复古深色': PRESETS[2]
};
function normalizePreset(value) { return ALIASES[value] || value; }

// Serialized into the page; keep this function independent of Node globals.
function install(config) {
  const key = '__wensenTheme';
  const existing = window[key] || window.__vstartTheme;
  if (existing && existing.implementation === config.implementation) return existing.configure(config);
  if (existing) existing.dispose();
  // Old anonymous hooks cannot be safely removed without recreating the document.
  if (window.__vstart_preset_hooked || window.__vstart_settings_guard_installed || window.__vstart_i18n_observer || window.__ag_preset_hooked || window.__ag_settings_guard_installed) {
    throw new Error('检测到旧补丁运行时，请先停止旧守护并完全退出、重开 Antigravity，再应用新版。');
  }
  const proto = Storage.prototype;
  const descriptors = Object.fromEntries(['getItem', 'setItem', 'removeItem', 'clear'].map(k => [k, Object.getOwnPropertyDescriptor(proto, k)]));
  const raw = Object.fromEntries(Object.keys(descriptors).map(k => [k, descriptors[k].value]));
  const read = k => raw.getItem.call(localStorage, k);
  const write = (k, v) => raw.setItem.call(localStorage, k, v);
  const normalize = v => config.aliases[v] || v;
  const custom = v => config.presets.includes(normalize(v));
  let active = true, ready = false, hooks = false;
  let options = {}, style, bodyObserver, textObserver, domObserver, timer;
  let guardInstalled = false;
  const translations = new Map();
  const wrappers = {};
  const initial = { flavor: read('theme-color-flavor'), preset: read('theme-preset-light') };

  function sync() {
    if (!active || !ready) return;
    if (!options.lite && custom(read('theme-preset-light'))) write('theme-preset-light', 'Default Light');
    const root = document.documentElement;
    const dark = [document.body, root].some(el => el.classList.contains('dark') || el.classList.contains('theme-dark'));
    const flavor = normalize((options.lite ? options.flavor : read('theme-color-flavor')) || 'high-contrast');
    // Explicit official choice wins over the author's historical warm-background fallback.
    if (!dark && custom(flavor)) root.setAttribute('data-ag-preset', flavor);
    else root.removeAttribute('data-ag-preset');
  }
  function scheduleSync() {
    clearTimeout(timer);
    timer = setTimeout(sync, 50);
  }
  function setHooks(enabled) {
    if (enabled === hooks) return;
    if (enabled) {
      wrappers.getItem = function(k) {
        const v = raw.getItem.call(this, k);
        return this === localStorage && String(k) === 'theme-preset-light' && custom(v) ? 'Default Light' : v;
      };
      wrappers.setItem = function(k, v) {
        k = String(k); v = String(v);
        if (this === localStorage) {
          if (k === 'theme-preset-light' && custom(v)) { write('theme-color-flavor', normalize(v)); v = 'Default Light'; }
          else if (k === 'theme-preset-light' && v === 'Default Light') write('theme-color-flavor', 'Default Light');
          if (k === 'theme-color-flavor') v = normalize(v);
          // Selecting the official preset is an explicit request to release custom styling.

        }
        const result = raw.setItem.call(this, k, v);
        if (this === localStorage && ['theme-preset-light', 'theme-mode', 'theme-color-flavor'].includes(k)) scheduleSync();
        return result;
      };
      wrappers.removeItem = function(k) {
        const result = raw.removeItem.call(this, k);
        if (this === localStorage) scheduleSync();
        return result;
      };
      wrappers.clear = function() {
        const result = raw.clear.call(this);
        if (this === localStorage) scheduleSync();
        return result;
      };
      hooks = true;
      try {
        for (const name of Object.keys(wrappers)) Object.defineProperty(proto, name, { ...descriptors[name], value: wrappers[name] });
      } catch (error) { setHooks(false); throw error; }
    } else {
      for (const name of Object.keys(wrappers)) {
        if (proto[name] === wrappers[name]) Object.defineProperty(proto, name, descriptors[name]);
      }
      hooks = false;
    }
  }
  function settingsGuard(e) {
    const btn = e.target && e.target.closest && e.target.closest('[data-testid="settings-button"]');
    if (!btn) return;
    if (!document.querySelector('[role="dialog"]') && window.location.search.includes('settingsOpen=true')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('settingsOpen'); url.searchParams.delete('settingsScreen');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }
  function restoreTranslations() {
    for (const [node, entry] of translations) if (node.nodeValue === entry.translated) node.nodeValue = entry.original;
    translations.clear();
  }
  function translate(node) {
    if (node.nodeType !== Node.TEXT_NODE || !node.parentElement || node.parentElement.closest(config.i18n.exclusions.join(','))) return;
    const original = node.nodeValue;
    const text = original.trim();
    if (!text) return;
    let replacement = config.i18n.exact[text];
    if (!replacement) {
      for (const p of config.i18n.patterns) {
        const re = new RegExp(p.regex, p.flags);
        if (re.test(text)) { replacement = text.replace(re, p.replace); break; }
      }
    }
    if (replacement && replacement !== text) {
      const translated = original.replace(text, replacement);
      translations.set(node, { original, translated });
      node.nodeValue = translated;
    }
  }
  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) { translate(root); return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translate(node);
  }
  function configureFeatures() {
    const guard = !options.lite && options.settingsGuard;
    if (guard !== guardInstalled) {
      document[guard ? 'addEventListener' : 'removeEventListener']('click', settingsGuard, true);
      guardInstalled = guard;
    }
    if (textObserver) textObserver.disconnect();
    textObserver = null;
    if (!options.lite && options.i18n) {
      walk(document.body);
      textObserver = new MutationObserver(mutations => {
        if (!active) return;
        for (const [node] of translations) if (!node.isConnected) translations.delete(node);
        for (const m of mutations) {
          if (m.type === 'characterData') translate(m.target);
          else for (const node of m.addedNodes) walk(node);
        }
      });
      textObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    } else restoreTranslations();
  }
  function status() {
    return { status: ready ? 'ok' : 'waiting-dom', version: config.version, implementation: config.implementation,
      preset: document.documentElement?.getAttribute('data-ag-preset') || null,
      flavor: read('theme-color-flavor'), options: { ...options }, hooks,
      dark: !!document.body && [document.body, document.documentElement].some(el => el.classList.contains('dark') || el.classList.contains('theme-dark')),
      hasStyle: !!document.getElementById('ag-custom-fonts') };
  }
  function configure(next) {
    if (next.css) config.css = next.css;
    if (next.i18n) config.i18n = next.i18n;
    options = { i18n: true, settingsGuard: true, lite: false, ...options, ...next.options };
    if (!options.lite && custom(read('theme-preset-light'))) write('theme-preset-light', 'Default Light');
    if (options.lite) options.flavor = next.flavor === undefined ? (options.flavor || read('theme-color-flavor') || 'high-contrast') : normalize(next.flavor);
    else if (next.flavor !== undefined) write('theme-color-flavor', normalize(next.flavor));
    else if (read('theme-color-flavor') === null) write('theme-color-flavor', 'high-contrast');
    setHooks(!options.lite);
    if (ready) { ensureStyle(); configureFeatures(); sync(); }
    return status();
  }
  function ensureStyle() {
    style = document.getElementById('ag-custom-fonts');
    if (!style) { style = document.createElement('style'); style.id = 'ag-custom-fonts'; document.head.appendChild(style); }
    if (style.textContent !== config.css) style.textContent = config.css;
  }
  function mount() {
    if (!active || ready || !document.head || !document.body) return;
    ready = true;
    if (domObserver) domObserver.disconnect();
    document.removeEventListener('DOMContentLoaded', mount);
    ensureStyle();
    bodyObserver = new MutationObserver(sync);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    bodyObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', sync);
    configureFeatures(); sync();
    window.__ag_patch_version = config.version;
  }
  function dispose() {
    active = false;
    clearTimeout(timer);
    for (const observer of [domObserver, bodyObserver, textObserver]) if (observer) observer.disconnect();
    document.removeEventListener('DOMContentLoaded', mount);
    document.removeEventListener('click', settingsGuard, true);
    window.removeEventListener('storage', sync);
    setHooks(false); restoreTranslations();
    if (style) style.remove();
    document.documentElement?.removeAttribute('data-ag-preset');
    if (window.__ag_patch_version === config.version) {
      delete window.__ag_patch_version;
    }
    if (window[key] === api) delete window[key];
    if (window.__vstartTheme === api) delete window.__vstartTheme;
    return { disposed: true, restartRequired: false };
  }
  const api = { implementation: config.implementation, configure, sync, status, dispose, initial };
  window[key] = window.__vstartTheme = api;
  try {
    configure(config);
    mount();
    if (!ready) {
      document.addEventListener('DOMContentLoaded', mount);
      domObserver = new MutationObserver(mount);
      domObserver.observe(document, { childList: true, subtree: true });
    }
    return status();
  } catch (error) { dispose(); throw error; }
}
function getInjectionCode(options = {}) {
  const flavor = options.flavor === undefined ? undefined : normalizePreset(options.flavor);
  if (flavor !== undefined && !PRESETS.includes(flavor) && flavor !== 'Default Light') throw new Error('未知预设：' + options.flavor);
  const config = {
    version: PATCH_VERSION, implementation: IMPLEMENTATION_VERSION, presets: PRESETS, aliases: ALIASES, flavor,
    options: Object.fromEntries(['i18n', 'settingsGuard', 'lite'].filter(k => options[k] !== undefined).map(k => [k, options[k]])),
    css: fs.readFileSync(path.join(__dirname, '../assets/themes.css'), 'utf8'),
    i18n: JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/i18n.json'), 'utf8'))
  };
  return '(' + install.toString() + ')(' + JSON.stringify(config) + ')';
}
function getTeardownCode() {
  return '(() => { const r = window.__wensenTheme || window.__vstartTheme; const result = r ? r.dispose() : { disposed: false, restartRequired: true }; Storage.prototype.setItem.call(localStorage, "theme-color-flavor", "Default Light"); Storage.prototype.setItem.call(localStorage, "theme-preset-light", "Default Light"); document.documentElement.removeAttribute("data-ag-preset"); for (const id of ["ag-custom-fonts", "wensen-ag-custom-theme", "vstart-ag-custom-theme"]) document.getElementById(id)?.remove(); return result; })()';
}
module.exports = { getInjectionCode, getTeardownCode, PATCH_VERSION, IMPLEMENTATION_VERSION, PRESETS, normalizePreset };