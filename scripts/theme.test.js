/** Isolated regression tests; no real app, launchctl or user preferences. */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { getInjectionCode, getTeardownCode } = require('./patch-core');
const { Session, loopback } = require('./cdp');
const { parseOptions, renderPlist } = require('./cli');
const { validate } = require('./options');
function fixture(delayed = false) {
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.nodeType = 1; this.children = []; this.attrs = {}; this.classNames = new Set(); this.classList = { contains: k => this.classNames.has(k) }; this.textContent = ''; }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
    appendChild(node) { node.parentElement = this; this.children.push(node); return node; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); }
    closest(selector) { return this.exclude && selector.includes(this.exclude) ? this : null; }
  }
  const listeners = new Map();
  const addEventListener = (k, fn) => { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(fn); };
  const removeEventListener = (k, fn) => listeners.get(k)?.delete(fn);
  const observers = [];
  class MutationObserver {
    constructor(fn) { this.fn = fn; this.connected = false; observers.push(this); }
    observe() { this.connected = true; }
    disconnect() { this.connected = false; }
  }
  class Storage {
    constructor() { this.data = new Map(); }
    getItem(k) { return this.data.get(String(k)) ?? null; }
    setItem(k, v) { this.data.set(String(k), String(v)); }
    removeItem(k) { this.data.delete(String(k)); }
    clear() { this.data.clear(); }
  }
  const root = new Element('html'), head = new Element('head'), body = new Element('body');
  body.classNames.add('theme-light');
  const nodes = [];
  const document = { documentElement: root, head: delayed ? null : head, body: delayed ? null : body,
    createElement: tag => new Element(tag),
    getElementById: id => head.children.find(x => x.id === id) || null,
    addEventListener, removeEventListener, querySelector: () => null,
    createTreeWalker: el => { const list = el === body ? nodes : []; let i = 0; return { nextNode: () => list[i++] || null }; }
  };
  const history = { state: { router: 'retain' }, replaceState(state, _, url) { this.state = state; this.url = url; } };
  const window = { addEventListener, removeEventListener, history, location: { href: 'http://127.0.0.1/?settingsOpen=true&settingsScreen=appearance', search: '?settingsOpen=true&settingsScreen=appearance' } };
  const localStorage = new Storage();
  const originalSet = Storage.prototype.setItem;
  const ctx = vm.createContext({ window, document, Storage, localStorage, MutationObserver, URL, Node: { TEXT_NODE: 3 }, NodeFilter: { SHOW_TEXT: 4 }, setTimeout, clearTimeout, console });
  function text(value, exclude) { const parent = new Element(); parent.exclude = exclude; const node = { nodeType: 3, nodeValue: value, parentElement: parent, isConnected: true }; nodes.push(node); return node; }
  return { window, document, localStorage, Storage, originalSet, head, body, listeners, observers, history, text,
    run: opts => vm.runInContext(getInjectionCode(opts), ctx),
    teardown: () => vm.runInContext(getTeardownCode(), ctx),
    mount() { document.head = head; document.body = body; for (const fn of listeners.get('DOMContentLoaded') || []) fn(); }
  };
}
test('switches, Chinese aliases, official release, empty fallback and Dark isolation', () => {
  const f = fixture();
  assert.equal(f.run().preset, 'high-contrast');
  assert.equal(f.run({ flavor: '复古深色' }).preset, 'vintage-deep');
  assert.equal(f.window.__wensenTheme, f.window.__vstartTheme);
  f.localStorage.setItem('theme-preset-light', 'ClaudeDesktop 净白'); f.window.__wensenTheme.sync();
  assert.equal(f.window.__wensenTheme.status().preset, 'claude-desktop-purewhite');
  assert.equal(f.localStorage.getItem('theme-preset-light'), 'Default Light');
  const sessionStorage = new f.Storage(); sessionStorage.setItem('theme-preset-light', 'vintage-deep');
  assert.equal(sessionStorage.getItem('theme-preset-light'), 'vintage-deep');
  f.localStorage.setItem('theme-preset-light', 'Default Light'); f.window.__wensenTheme.sync();
  assert.equal(f.window.__wensenTheme.status().preset, null);
  f.localStorage.removeItem('theme-color-flavor'); f.window.__wensenTheme.sync();
  assert.equal(f.window.__wensenTheme.status().preset, 'high-contrast');
  f.body.classNames.add('theme-dark'); f.window.__wensenTheme.sync();
  assert.equal(f.window.__wensenTheme.status().preset, null);
  f.teardown();
  assert.equal(f.Storage.prototype.setItem, f.originalSet);
  assert.equal(f.localStorage.getItem('theme-color-flavor'), 'Default Light');
});
test('idempotent injection self-heals missing style and releases observers/listeners', () => {
  const f = fixture(); f.run();
  const runtime = f.window.__wensenTheme;
  f.run({ flavor: 'vintage-deep' }); f.run({ flavor: 'high-contrast' });
  assert.equal(f.window.__wensenTheme, runtime); assert.equal(f.head.children.length, 1);
  assert.equal(f.listeners.get('click').size, 1);
  f.document.getElementById('ag-custom-fonts').remove();
  assert.equal(f.run().hasStyle, true); assert.equal(f.head.children.length, 1);
  f.teardown();
  assert.equal(f.head.children.length, 0); assert.equal(f.listeners.get('click').size, 0);
  assert.equal(f.observers.filter(o => o.connected).length, 0);
  assert.equal(f.window.__wensenTheme, undefined); assert.equal(f.window.__vstartTheme, undefined); assert.equal(f.window.__ag_patch_version, undefined);
});
test('document_start hooks precede DOM and initialization completes when DOM arrives', () => {
  const f = fixture(true);
  f.localStorage.setItem('theme-preset-light', 'vintage-deep');
  assert.equal(f.run().status, 'waiting-dom');
  assert.equal(f.localStorage.getItem('theme-preset-light'), 'Default Light');
  f.mount(); assert.equal(f.window.__wensenTheme.status().status, 'ok'); f.teardown();
});
test('optional features, guarded history state and translation exclusions/restoration', () => {
  const f = fixture(); const ui = f.text(' Settings '); const code = f.text('Settings', 'code'); const prose = f.text('Settings', '.prose');
  f.run(); assert.equal(ui.nodeValue, ' 系统设置 '); assert.equal(code.nodeValue, 'Settings'); assert.equal(prose.nodeValue, 'Settings');
  for (const fn of f.listeners.get('click')) fn({ target: { closest: () => true } });
  assert.deepEqual(f.history.state, { router: 'retain' }); assert.ok(!f.history.url.includes('settingsOpen'));
  const changed = f.text('Settings');
  const textObserver = f.observers.find(o => o.connected && o !== f.observers[0]);
  textObserver.fn([{ type: 'characterData', target: changed }]);
  assert.equal(changed.nodeValue, '系统设置'); changed.nodeValue = 'User text';
  f.run({ i18n: false, settingsGuard: false });
  assert.equal(ui.nodeValue, ' Settings '); assert.equal(changed.nodeValue, 'User text'); assert.equal(f.listeners.get('click').size, 0);
  f.teardown();
});
test('lite never hooks Storage, translates or guards, and still respects Dark', () => {
  const f = fixture(); const ui = f.text('Settings');
  assert.equal(f.run({ flavor: 'vintage-deep', lite: true }).preset, 'vintage-deep');
  assert.equal(f.Storage.prototype.setItem, f.originalSet); assert.equal(ui.nodeValue, 'Settings');
  assert.equal(f.localStorage.getItem('theme-color-flavor'), null);
  assert.equal(f.listeners.get('click')?.size || 0, 0);
  f.body.classNames.add('dark'); f.window.__wensenTheme.sync(); assert.equal(f.window.__wensenTheme.status().preset, null);
  f.teardown();
});
test('old anonymous hooks require a clean document', () => {
  const f = fixture(); f.window.__vstart_preset_hooked = true;
  assert.throws(() => f.run(), /旧补丁/); assert.equal(f.head.children.length, 0);
});
class Socket extends EventEmitter {
  addEventListener(k, fn) { this.on(k, fn); }
  send(raw) { this.last = JSON.parse(raw); if (this.respond) this.respond(this.last); }
  reply(payload) { this.emit('message', { data: JSON.stringify(payload) }); }
  close() { this.emit('close'); }
}
test('CDP matches IDs, propagates protocol/page errors, times out and rejects disconnect', async () => {
  const ws = new Socket(); const s = new Session(ws, 15);
  const first = s.send('First'); const id = ws.last.id;
  ws.reply({ method: 'Runtime.consoleAPICalled', params: {} }); ws.reply({ id: 999, result: {} }); ws.reply({ id, result: { success: true } });
  assert.deepEqual(await first, { success: true });
  const second = s.send('Fail'); ws.reply({ id: ws.last.id, error: { message: 'protocol error' } }); await assert.rejects(second, /protocol error/);
  ws.respond = msg => ws.reply({ id: msg.id, result: { exceptionDetails: { text: 'page error' } } });
  await assert.rejects(s.evaluate('throw Error()'), /page error/);
  ws.respond = null; await assert.rejects(s.send('Timeout'), /超时/);
  const disconnect = s.send('Disconnect'); ws.close(); await assert.rejects(disconnect, /断开/); assert.equal(s.pending.size, 0);
});
test('rejects nonloopback endpoints and invalid options; plist escapes paths', () => {
  assert.throws(() => loopback('ws://evil.invalid:9222/page', 9222), /非本机/);
  assert.throws(() => loopback('ws://127.0.0.1:9223/page', 9222), /非本机/);
  assert.equal(loopback('ws://127.0.0.1:9222/page', 9222), 'ws://127.0.0.1:9222/page');
  assert.throws(() => parseOptions(['--lite', '--daemon']), /不能同时/);
  assert.throws(() => parseOptions(['--preset', 'bad']), /未知预设/);
  assert.throws(() => validate({ i18n: 'false' }), /布尔/);
  const plist = renderPlist('/tmp/Node & "path"', '/tmp/a<b');
  assert.ok(plist.includes('&amp; &quot;path&quot;')); assert.ok(plist.includes('a&lt;b')); assert.ok(!plist.includes('{{'));
});

test('multiwindow failures preserve successful results and close all sessions', async () => {
  const cdp = require('./cdp'); const { inPages } = require('./cli');
  const original = { targets: cdp.targets, connect: cdp.connect }; const closed = [];
  cdp.targets = async () => [{ id: 'A' }, { id: 'B' }];
  cdp.connect = async target => ({ id: target.id, close() { closed.push(target.id); } });
  try {
    await assert.rejects(inPages(async session => { if (session.id === 'B') throw new Error('blocked'); return { status: 'ok' }; }), error => {
      assert.equal(error.pageResults.succeeded[0].target, 'A');
      assert.match(error.pageResults.failed[0], /B: blocked/); return true;
    });
    assert.deepEqual(closed, ['A', 'B']);
  } finally { cdp.targets = original.targets; cdp.connect = original.connect; }
});