---
name: wensen-antigravity-theme
description: 为 macOS Google Antigravity 应用、切换或撤销作者文档中的界面皮肤、字体与可选汉化，通过本机 CDP 注入并支持 LaunchAgent 常驻。
metadata:
  author: 文森策
  brand: WenSenLab
---

# WenSen Antigravity Theme

WenSenLab_ ©文森策。主题与排版依据原作者方案，WenSenLab 负责技能封装和执行工具。适用于 Google Antigravity 桌面客户端，不是网页配色或 IDE 通用主题。

## 来源与维护边界

唯一视觉基准：[作者文档](https://bustling-politician-00f.notion.site/chuanban-antigravity-theme-patch-db7c5846f37546be9481cd791aed0554)，核对版本为 2026-10-19 Solid Ink v2，探针 `20261019-solid-consolidated-v2`；适配 Antigravity 2.x 新界面（辅助面板 Auxiliary Pane、Swarm 看板与新版输入框）。

修改配色、字体、选择器或更新作者方案时，先读 [来源基准与冲突处理](references/source-baseline.md)，再对照原文。保持三套预设的数值、字体顺序和作用范围；不凭截图新增滚动条隐藏、引用块或行内代码装饰。常规应用无需重写 CSS。

## 应用流程

1. 先确认请求是安装、热切换、排错还是撤销；已有明确选择和授权直接沿用。首次应用时一次确认预设、是否汉化／启用设置路由守卫、是否轻量免守护。推荐默认：高对比、汉化和路由守卫开启、完整常驻；用户选择轻量则只注入样式与预设同步，不启用 Storage 护栏、汉化、路由守卫或后台服务。
2. 确认 macOS、Node 18+，以及 Node 内置 WebSocket 或当前环境已有的 `ws`（建议 Node 22+）。使用本技能目录中的 `scripts/cli.js`，先运行 `help` 和 `status`。下列命令均从技能物理目录执行，或换成实际解析出的绝对脚本路径，避免调用同名副本。
3. 按作者 §3 默认 A 方案安装并验证字体，无需另问字体分支。Anthropic 字体资源见 [作者字体目录](https://drive.google.com/drive/folders/1NX92SgVUqtSjWg6bt6sIJXy-cn7J_boC)；先检查可访问性与实际字体文件，不承诺资源永久可用或第三方许可。更纱可在用户授权安装后运行 `brew install --cask font-sarasa-gothic`。用系统字体清单核实家族名，并在真实应用开发者工具检查实际渲染字体；仅有 CSS 或 `document.fonts.check` 不能证明指定字体实际被使用。字体缺失时说明回退状况。
4. 确认 Antigravity 的本机调试接口。端口读取 `~/Library/Application Support/Antigravity/DevToolsActivePort`，只连接 `127.0.0.1`，注入经 Antigravity / Jetski 标题或本机语言服务识别的主页面。缺文件时检查调试启动参数和应用版本，不能直接断言应用没运行。必要时确认完全退出应用后，以实际应用路径附加 `--remote-debugging-port=9222` 启动；未经授权不关闭正在工作的应用。不修改 App 包、asar 或系统签名，不开放外网调试。
5. 检测到旧匿名补丁钩子时，先停止旧守护，完全退出并重开应用，再应用新版。脚本会拒绝叠加旧运行时。完整模式保留 Storage 白屏护栏，路由守卫和汉化可独立关闭。

```bash
node scripts/cli.js apply --preset high-contrast --daemon
node scripts/cli.js apply --preset claude-desktop-purewhite --no-i18n --no-settings-guard
node scripts/cli.js apply --preset vintage-deep --lite
node scripts/cli.js switch high-contrast
node scripts/cli.js status
```

三套名称：`high-contrast`、`claude-desktop-purewhite`、`vintage-deep`。兼容别名和中文名称见来源基准。复古深色属于暖纸浅色预设，官方 Dark 保持隔离。空 flavor 按作者代码回退高对比；显式官方选择释放自定义样式。

`apply` 首次默认高对比，后续沿用已保存选项。`--i18n`、`--settings-guard` 可重新开启功能，`--full` 从轻量切回完整模式。`--daemon` 明确安装常驻；无此参数时仅保留原本已加载的守护状态，不隐式新增常驻。更换配置会先停止既有守护，成功应用后按需重载，防止旧新文档脚本并存。失败时报告各窗口结果和守护状态，不把服务加载等同注入成功。

LaunchAgent 使用 `com.wensenlab.antigravity-theme`，`RunAtLoad`、`KeepAlive`，自动无缝迁移旧版 `com.vstart.antigravity-theme`，日志在本技能 `logs/`。运行选项保存到 `~/.config/wensen-antigravity-theme/options.json`（自动回退兼容旧配置）。守护尊重页面最近的预设选择，心跳不强制写回初始配色。安装单独常驻可执行 `node scripts/cli.js install-daemon`。

## 暂停、恢复与卸载

```bash
node scripts/cli.js pause
node scripts/cli.js resume
node scripts/cli.js switch "Default Light"
node scripts/cli.js uninstall
```

`pause` 停止本技能 LaunchAgent，撤销新运行时可移除的观察器、事件、Storage 包装、样式和已记录译文，写入 Default Light。`resume` 恢复上次保存的预设及功能，不自动新增常驻；需要常驻时显式加 `--daemon`。`switch "Default Light"` 等同暂停。

`uninstall` 顺序为：停止并删除本技能 LaunchAgent → 确认 daemon 退出 → 请求恢复 Default Light → 完全退出并重开应用后验收。它保留中央库技能和运行选项，不删除技能自身。只控制精确的本技能服务；若仍有手动／nohup 守护，报告 PID，不能使用广泛 `pkill`。旧运行时或页面不可连接时明确报告恢复未验证，重启是完成恢复的必要步骤。

## 验收与交付

实际应用后按作者 §6 验收：四层字体实际命中、三套配色、设置页正常打开、热切换、官方 Dark 隔离、汉化不进入正文／代码／终端／输入／文件路径、路由修复保留 `history.state`、退出重开后的常驻。轻量模式按其关闭功能验收，不能承诺常驻或白屏护栏。轻量模式通过本 CLI 切换或撤销；它不拦截同窗口的页面存储写入，因此不承诺应用内预设菜单实时接管，切回官方请用 `pause` 或 `switch "Default Light"`。

开发验证执行 `node --test scripts/theme.test.js`，并对脚本运行 `node --check`。隔离测试不能替代真实应用验收；分别报告已验证、未验证、字体回退及版本适配风险。成功消息必须以 CDP 返回值和运行时探针为依据。
