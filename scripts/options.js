/** WenSenLab_ ©文森策 — runtime preferences, separate from skill assets. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PRESETS, normalizePreset } = require('./patch-core');
const CONFIG_FILE = path.join(os.homedir(), '.config/wensen-antigravity-theme/options.json');
const LEGACY_CONFIG_FILE = path.join(os.homedir(), '.config/vstart-antigravity-theme/options.json');
function readOptions() {
  try { return validate(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))); }
  catch (e) {
    if (e.code === 'ENOENT') {
      try { return validate(JSON.parse(fs.readFileSync(LEGACY_CONFIG_FILE, 'utf8'))); }
      catch (e2) { if (e2.code === 'ENOENT') return {}; throw e2; }
    }
    throw e;
  }
}
function validate(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('运行配置格式无效');
  const result = {};
  for (const k of ['i18n', 'settingsGuard', 'lite']) if (value[k] !== undefined) {
    if (typeof value[k] !== 'boolean') throw new Error('配置必须为布尔值：' + k);
    result[k] = value[k];
  }
  if (value.flavor !== undefined) {
    result.flavor = normalizePreset(value.flavor);
    if (![...PRESETS, 'Default Light'].includes(result.flavor)) throw new Error('未知预设：' + value.flavor);
  }
  return result;
}
function saveOptions(value) {
  const opts = validate(value);
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  const tmp = CONFIG_FILE + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(opts, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, CONFIG_FILE);
}
module.exports = { CONFIG_FILE, readOptions, saveOptions, validate };
