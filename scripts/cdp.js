/** WenSenLab_ ©文森策 — loopback CDP transport, shared by CLI and daemon. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const PORT_FILE = path.join(os.homedir(), 'Library/Application Support/Antigravity/DevToolsActivePort');
function websocketClass() {
  if (globalThis.WebSocket) return globalThis.WebSocket;
  try { return require('ws'); } catch { throw new Error('需要 Node 内置 WebSocket（建议 Node 22+），或为当前 Node 安装 ws。'); }
}
function loopback(url, port) {
  const u = new URL(url);
  if (u.protocol !== 'ws:' || u.hostname !== '127.0.0.1' || Number(u.port) !== port) throw new Error('拒绝非本机 CDP WebSocket：' + u.origin);
  return u.href;
}
function getPort() {
  let raw;
  try { raw = fs.readFileSync(PORT_FILE, 'utf8').split(/\r?\n/)[0]; }
  catch { throw new Error('未找到 DevToolsActivePort；请核实调试启动参数 --remote-debugging-port，不代表应用一定未运行。'); }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DevToolsActivePort 端口无效');
  return port;
}
async function targets() {
  const port = getPort();
  const res = await fetch('http://127.0.0.1:' + port + '/json', { signal: AbortSignal.timeout(4000), redirect: 'error' });
  if (!res.ok) throw new Error('CDP /json HTTP ' + res.status);
  const list = await res.json();
  if (!Array.isArray(list)) throw new Error('CDP /json 不是目标列表');
  const pages = list.filter(t => t.type === 'page' && t.webSocketDebuggerUrl && !String(t.url).startsWith('data:') && !String(t.url).startsWith('chrome-devtools://') && (/Antigravity|Jetski/i.test(String(t.title)) || /^https?:\/\/127\.0\.0\.1/i.test(String(t.url))));
  if (!pages.length) throw new Error('未找到 Antigravity 主页面；请核实 /json 的标题和 URL，不能向任意网页注入。');
  return pages.map(t => ({ ...t, webSocketDebuggerUrl: loopback(t.webSocketDebuggerUrl, port) }));
}
class Session {
  constructor(socket, timeout = 5000) {
    this.socket = socket; this.timeout = timeout; this.nextId = 1; this.pending = new Map(); this.closed = false;
    socket.addEventListener('message', event => {
      let data; try { data = JSON.parse(String(event.data)); } catch { return; }
      const request = this.pending.get(data.id);
      if (!request) return;
      clearTimeout(request.timer); this.pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error.message || JSON.stringify(data.error)));
      else request.resolve(data.result);
    });
    const fail = () => {
      this.closed = true;
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('CDP 连接断开')); }
      this.pending.clear();
    };
    socket.addEventListener('close', fail); socket.addEventListener('error', fail);
  }
  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error('CDP 连接已关闭'));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP 超时：' + method)); }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      try { this.socket.send(JSON.stringify({ id, method, params })); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || '页面执行异常');
    if (!res.result || !Object.hasOwn(res.result, 'value')) throw new Error('页面没有返回可检查的结果');
    return res.result.value;
  }
  close() { this.socket.close(); }
}
async function connect(target) {
  const WS = websocketClass();
  const socket = new WS(target.webSocketDebuggerUrl);
  const session = new Session(socket);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('CDP 建连超时')); }, 5000);
    const cleanup = () => { clearTimeout(timer); socket.removeEventListener('open', open); socket.removeEventListener('error', error); socket.removeEventListener('close', error); };
    const open = () => { cleanup(); resolve(); };
    const error = () => { cleanup(); reject(new Error('CDP 建连失败')); };
    socket.addEventListener('open', open); socket.addEventListener('error', error); socket.addEventListener('close', error);
  });
  return session;
}
async function inject(session, source) {
  let result = await session.evaluate(source);
  if (result?.status === 'waiting-dom') {
    result = await session.evaluate('new Promise((resolve, reject) => { const start = Date.now(); const poll = () => { const r = (window.__wensenTheme || window.__vstartTheme)?.status(); if (r?.status === "ok") resolve(r); else if (Date.now() - start > 3000) reject(new Error("DOM 尚未就绪")); else setTimeout(poll, 25); }; poll(); })');
  }
  if (result?.status !== 'ok' || !result.hasStyle) throw new Error('注入未通过运行时验收：' + JSON.stringify(result));
  return result;
}
module.exports = { PORT_FILE, getPort, targets, connect, Session, inject, loopback, websocketClass };
