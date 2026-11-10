#!/usr/bin/env node
/** WenSenLab_ ©文森策 — author theme wrapper; does not patch application bundles. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const cdp = require('./cdp');
const { getInjectionCode, getTeardownCode, PRESETS, normalizePreset } = require('./patch-core');
const { readOptions, saveOptions, CONFIG_FILE } = require('./options');
const ROOT = path.resolve(__dirname, '..');
const LABEL = 'com.wensenlab.antigravity-theme';
const PLIST = path.join(os.homedir(), 'Library/LaunchAgents', LABEL + '.plist');
const SERVICE = 'gui/' + process.getuid() + '/' + LABEL;
const DAEMON = path.join(__dirname, 'daemon.js');
const LEGACY_LABEL = 'com.vstart.antigravity-theme';
const LEGACY_PLIST = path.join(os.homedir(), 'Library/LaunchAgents', LEGACY_LABEL + '.plist');
const LEGACY_SERVICE = 'gui/' + process.getuid() + '/' + LEGACY_LABEL;
function launch(args) { return execFileSync('/bin/launchctl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function serviceLoaded(svc) {
  try { launch(['print', svc]); return true; }
  catch (e) {
    const detail = String(e.stderr || '');
    if (/could not find service|service not found/i.test(detail)) return false;
    throw new Error('无法确定 LaunchAgent 状态：' + detail.trim());
  }
}
function loaded() { return serviceLoaded(SERVICE) || serviceLoaded(LEGACY_SERVICE); }
function otherDaemons() {
  const output = execFileSync('/bin/ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
  return output.split('\n').filter(line => {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    return match && Number(match[1]) !== process.pid && match[2].includes(DAEMON);
  });
}
async function stopDaemon(remove = false) {
  if (serviceLoaded(LEGACY_SERVICE)) launch(['bootout', LEGACY_SERVICE]);
  if (serviceLoaded(SERVICE)) launch(['bootout', SERVICE]);
  const start = Date.now();
  while (otherDaemons().length && Date.now() - start < 16000) await new Promise(r => setTimeout(r, 100));
  const others = otherDaemons();
  if (others.length) throw new Error('仍有此 skill 的 daemon 进程；请退出原终端/nohup 守护后重试。未广泛终止进程。PID：' + others.map(x => x.trim().split(/\s+/)[0]).join(','));
  if (loaded()) throw new Error('LaunchAgent 未停止');
  if (remove && fs.existsSync(PLIST)) fs.unlinkSync(PLIST);
  if ((remove || fs.existsSync(PLIST)) && fs.existsSync(LEGACY_PLIST)) {
    try { fs.unlinkSync(LEGACY_PLIST); } catch {}
  }
}
function escapeXml(text) { return text.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])); }
function renderPlist(node = process.execPath, root = ROOT) {
  return fs.readFileSync(path.join(ROOT, 'assets/com.wensenlab.antigravity-theme.plist.template'), 'utf8')
    .replaceAll('{{NODE_PATH}}', escapeXml(node)).replaceAll('{{DAEMON_PATH}}', escapeXml(path.join(root, 'scripts/daemon.js'))).replaceAll('{{LOG_DIR}}', escapeXml(path.join(root, 'logs')));
}
async function installDaemon() {
  if (process.platform !== 'darwin') throw new Error('LaunchAgent 仅支持 macOS');
  if (readOptions().lite) throw new Error('轻量模式不能安装守护；先 apply 切回完整模式。');
  cdp.websocketClass();
  await stopDaemon();
  if (fs.existsSync(LEGACY_PLIST)) {
    try { fs.unlinkSync(LEGACY_PLIST); } catch {}
  }
  fs.mkdirSync(path.dirname(PLIST), { recursive: true }); fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });
  if (fs.existsSync(PLIST)) fs.copyFileSync(PLIST, PLIST + '.backup-' + Date.now());
  const tmp = PLIST + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, renderPlist());
  execFileSync('/usr/bin/plutil', ['-lint', tmp], { stdio: 'pipe' });
  fs.renameSync(tmp, PLIST);
  launch(['bootstrap', 'gui/' + process.getuid(), PLIST]);
  if (!loaded()) throw new Error('LaunchAgent 未加载');
  console.log('LaunchAgent 已加载；注入健康度请用 status 检查，日志位于 ' + path.join(ROOT, 'logs'));
}
function parseOptions(args, seed = {}) {
  const options = { ...seed }; let daemon = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--preset') {
      const value = args[++i]; if (!value) throw new Error('--preset 缺少值');
      options.flavor = normalizePreset(value);
    } else if (arg === '--no-i18n') options.i18n = false;
    else if (arg === '--i18n') options.i18n = true;
    else if (arg === '--no-settings-guard') options.settingsGuard = false;
    else if (arg === '--settings-guard') options.settingsGuard = true;
    else if (arg === '--lite') options.lite = true;
    else if (arg === '--full') options.lite = false;
    else if (arg === '--daemon') daemon = true;
    else throw new Error('未知参数：' + arg);
  }
  if (options.flavor !== undefined && ![...PRESETS, 'Default Light'].includes(options.flavor)) throw new Error('未知预设：' + options.flavor);
  if (options.lite && daemon) throw new Error('--lite 与 --daemon 不能同时使用');
  return { options, daemon };
}
async function inPages(fn) {
  const pages = await cdp.targets(); const results = [], errors = [];
  for (const target of pages) {
    let session;
    try { session = await cdp.connect(target); results.push({ target: target.id, result: await fn(session) }); }
    catch (error) { errors.push(target.id + ': ' + error.message); }
    finally { if (session) session.close(); }
  }
  if (errors.length) {
    const error = new Error('部分窗口失败：' + errors.join('; '));
    error.pageResults = { succeeded: results, failed: errors };
    throw error;
  }
  return results;
}
async function apply(args, resume = false) {
  const saved = readOptions();
  const seed = { i18n: true, settingsGuard: true, lite: false, ...saved };
  const { options, daemon } = parseOptions(args, seed);
  // Stop old registrations before replacing config; otherwise old document scripts retain old options.
  const wasLoaded = loaded();
  await stopDaemon();
  if (options.flavor === undefined) options.flavor = 'high-contrast';
  let result;
  try { result = await inPages(session => cdp.inject(session, getInjectionCode(options))); }
  catch (error) {
    if (error.pageResults) console.error(JSON.stringify(error.pageResults, null, 2));
    throw new Error(error.message + '。守护已停止，运行配置未保存；成功窗口可能已应用。修复失败窗口后重试 apply；需要先恢复官方时运行 pause。');
  }
  saveOptions(options);
  console.log(JSON.stringify(result, null, 2));
  if ((daemon || wasLoaded) && !options.lite) await installDaemon();
}
async function restore(remove) {
  await stopDaemon(remove);
  try {
    const result = await inPages(session => session.evaluate(getTeardownCode()));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { throw new Error('守护已停止；页面恢复未验证：' + error.message + '。请在应用中选择 Default Light，并完全退出、重开应用。'); }
  console.log('已请求恢复 Default Light；完全退出并重开 Antigravity 后验收官方外观。技能中央库保留。');
}
async function status() {
  const result = { node: process.version, config: CONFIG_FILE, launchAgentLoaded: loaded(), portFile: cdp.PORT_FILE };
  try {
    result.pages = await inPages(s => s.evaluate('({ title: document.title, runtime: (window.__wensenTheme || window.__vstartTheme)?.status() || null, probe: window.__ag_patch_version || null, fonts: ["Anthropic Sans Web","Anthropic Serif Web","Anthropic Mono Web","Sarasa UI SC","Sarasa Mono Slab SC"].map(name => ({ name, candidates: [...document.fonts].filter(f => f.family.replace(/[\x22\x27]/g, "") === name).map(f => f.status) })) })'));
  } catch (e) { result.pageError = e.message; }
  console.log(JSON.stringify(result, null, 2));
  if (result.pageError) process.exitCode = 1;
}
const HELP = 'WenSen Antigravity Theme · 文森策\n' +
  'apply [--preset NAME] [--no-i18n] [--no-settings-guard] [--lite|--full] [--daemon]\n' +
  'switch NAME | resume [same flags] | pause | uninstall\n' +
  'status | install-daemon | uninstall-daemon\n' +
  'Presets: high-contrast, claude-desktop-purewhite, vintage-deep, "Default Light"\n' +
  'apply defaults to high-contrast on first use; resume reapplies the last saved choice.\n' +
  'pause/uninstall stop the managed daemon and request Default Light; restart the app to finish.\n';
async function main(args = process.argv.slice(2)) {
  const [command = 'help', ...rest] = args;
  if (command === 'help') console.log(HELP);
  else if (command === 'apply') await apply(rest);
  else if (command === 'resume' || command === 'enable') await apply(rest, true);
  else if (command === 'switch') {
    if (rest.length !== 1) throw new Error('switch 需要且仅需要一个预设名称');
    if (normalizePreset(rest[0]) === 'Default Light') await restore(false);
    else await apply(['--preset', rest[0]]);
  } else if (command === 'pause' || command === 'disable') await restore(false);
  else if (command === 'uninstall') await restore(true);
  else if (command === 'status') await status();
  else if (command === 'install-daemon') await installDaemon();
  else if (command === 'uninstall-daemon') { await stopDaemon(true); console.log('LaunchAgent 已停止并移除；当前页面补丁需 pause 或重启撤销。'); }
  else throw new Error('未知命令：' + command);
}
if (require.main === module) main().catch(e => { console.error('执行失败：' + e.message); process.exitCode = 1; });
module.exports = { main, parseOptions, renderPlist, escapeXml, inPages };
