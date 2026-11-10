/** WenSenLab_ ©文森策 — session-local registration and bounded reconnect. */
const { targets, connect, inject } = require('./cdp');
const { getInjectionCode } = require('./patch-core');
const { readOptions } = require('./options');
let stopping = false, timer, running;
const sessions = new Map();
const log = (...args) => console.log(new Date().toISOString(), ...args);
async function release(entry) {
  try { if (entry.script && !entry.session.closed) await entry.session.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: entry.script }); }
  finally { entry.session.close(); }
}
async function tick() {
  try {
    const options = readOptions();
    if (options.lite) throw new Error('轻量模式不运行守护，请先用 apply 切回完整模式。');
    delete options.flavor; // Page/storage choice wins; heartbeat must not pin an old preset.
    const source = getInjectionCode(options);
    const pages = await targets();
    for (const [id, entry] of sessions) if (!pages.some(p => p.id === id) || entry.session.closed) {
      await release(entry).catch(e => log(e.message)); sessions.delete(id);
    }
    for (const target of pages) {
      if (stopping) break;
      let entry = sessions.get(target.id);
      try {
        if (!entry) {
          const session = await connect(target);
          entry = { session }; sessions.set(target.id, entry);
          if (stopping) break;
          await session.send('Page.enable');
          const registered = await session.send('Page.addScriptToEvaluateOnNewDocument', { source });
          entry.script = registered.identifier;
          if (!entry.script) throw new Error('CDP 未返回新文档脚本标识');
        }
        if (!stopping) await inject(entry.session, source);
      } catch (error) {
        log(target.id, error.message);
        if (entry) { await release(entry).catch(e => log(e.message)); sessions.delete(target.id); }
      }
    }
  } catch (error) { log(error.message); }
}
function schedule() {
  if (stopping) return;
  running = tick().finally(() => { if (!stopping) timer = setTimeout(schedule, sessions.size ? 2500 : 600); });
}
async function shutdown() {
  if (stopping) return;
  stopping = true; clearTimeout(timer);
  // Let an in-flight registration finish before removing it.
  const deadline = setTimeout(() => process.exit(1), 15000);
  if (running) await running;
  await Promise.allSettled([...sessions.values()].map(release));
  sessions.clear(); clearTimeout(deadline);
}
if (require.main === module) {
  process.on('SIGINT', () => shutdown().catch(e => { log(e.message); process.exitCode = 1; }));
  process.on('SIGTERM', () => shutdown().catch(e => { log(e.message); process.exitCode = 1; }));
  log('WenSen Antigravity Theme daemon started'); schedule();
}
module.exports = { shutdown };
