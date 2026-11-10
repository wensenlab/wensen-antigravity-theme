### 🌐 直击痛点：全界面智能无感汉化重磅上线

Google Antigravity 官方原生仅提供英文，针对复杂的多智能体面板、审查机制（Review Modes）与偏好设置，本项目现已正式推出**零篡改动态本地化引擎**：
- **深度词典覆盖**：中文化导航栏、系统偏好设置、审查授权模式、会话列表、后台任务等 120+ 核心界面元素；
- **排他白名单保护**：严密保护正文 Markdown、代码块、终端与工作文稿，绝不误伤技术内容；
- **自由开关**：默认开启，可通过 `--no-i18n` 随时切换回原版英文。

---

### 🎨 核心特性与亮点

1. **三套经典人文排版预设**：
   - `high-contrast` *(默认推荐)*：暖燕麦侧栏 + 微暖净白主区 + 暖米棕悬浮输入框 + 立体深色框线；
   - `claude-desktop-purewhite`：净白背景 + 纯粹、克制的现代数字排版；
   - `vintage-deep`：暖纸色底 + 墨褐正文 + 暖棕侧栏。
2. **Anthropic + 更纱精细排版**：四层字体链优雅降级，带来如纸质书刊般的温润阅读体验。
3. **纯无侵入 CDP 注入**：不修改 App 二进制包、不解包 asar、不破坏 macOS 签名，安全无损。
4. **macOS LaunchAgent 常驻守护**：开机自动同步、客户端重启无感重新注入。
5. **工程防护机制**：内置 Storage 护栏与路由守卫，杜绝预设名冲突导致的白屏与遮罩锁死。

---

### 🚀 快速上手

```bash
# 1. 启动客户端本地调试端口
/Applications/Antigravity.app/Contents/MacOS/Antigravity --remote-debugging-port=9222 &

# 2. 一键应用高对比版 + 开启汉化 + 安装 LaunchAgent 常驻守护
node scripts/cli.js apply --preset high-contrast --daemon
```

---

### 🤝 致谢
- **排版方案源自**：Noel / Anarcadia 的 [chuanban Antigravity theme patch](https://bustling-politician-00f.notion.site/chuanban-antigravity-theme-patch-db7c5846f37546be9481cd791aed0554)
- **开源工程化封装**：[WenSenLab · 文森策](https://github.com/wensenlab)
