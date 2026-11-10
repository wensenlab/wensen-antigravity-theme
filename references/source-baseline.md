# 作者方案基准

来源：[chuanban Antigravity theme patch](https://bustling-politician-00f.notion.site/chuanban-antigravity-theme-patch-db7c5846f37546be9481cd791aed0554)。核对日期：2026-10-19；版本：Solid Ink consolidated v2；作者探针：20261019-solid-consolidated-v2；Antigravity 2.x 界面升级：2026-11-11。主题和排版按原作者 Noel／Anarcadia 方案，WenSenLab_ ©文森策负责技能封装与工程适配。原文更新后需重新核对，本文不宣称追踪未来版本。

## 配色与字体单源

可执行数值保存在 ../assets/themes.css；此处记录核对索引和分歧，避免另一份完整 CSS 副本漂移。

- 高对比：background #FCFCFB，foreground #1F1E1D，sidebar #F7F5F0，sidebar-secondary #ECE9E1，sidebar-border 黑色 .35，border 黑色 .38，card #F9F7F2，card-border 黑色 .35，secondary-foreground #0A0A0A。bg-border 黑色 .28，胶囊边框黑色 .32。不向侧栏添加 border-right。
- ClaudeDesktop 净白：background #FCFCFB，sidebar #FBFBF9，sidebar-muted #F3F2EF，sidebar-secondary #EDECE9，sidebar-border／bg-border #F0F0EE。
- 复古深色：background #FBF9F5，foreground #2C2B29，primary #D97757，sidebar #F1E8DC，sidebar-secondary #E6DCCE，sidebar-border／bg-border #E0D4C3。它属于浅色主题，不是官方 Dark。
- Solid Ink 必须覆盖原文的常规、项目、项目子 span、会话选中、小字、按钮字距、底部输入区七组选择器。常规 450／#262422／.2px 阴影；项目 450／#383533／.15px；项目子 span 450／#2C2B29／-.01em／.15px；选中 520／#0A0A0A／.25px；小字 500／#7A7670／-.005em；按钮字距 -.012em；底部输入区 500／-.012em／.25px。阴影颜色按 CSS 保留原文 rgba 数值。
- §3 A 的四层字体链顺序保持原文。UI 的 system-ui 位于 Sarasa UI SC 之前；正文与 h1–h6 同用 Anthropic Serif → Tiempos Text → Georgia → Cambria → Sarasa Mono Slab SC → 等距更纱黑体 Slab SC → Sarasa Gothic SC → 更纱黑体 SC → serif，行高 1.62、字距 -.003em。代码使用 Anthropic Mono 后接 Sarasa Mono Slab SC；输入框更纱 Mono Slab 优先。没有额外 PingFang、独立标题 600、引用块装饰或行内代码着色。
- aliases：chuanban-warm-white／高对比版 → high-contrast；claude-desktop-official／ClaudeDesktop 净白 → claude-desktop-purewhite；absoulutely-chuanban／复古深色 → vintage-deep。

## 原文内部冲突的处理

1. §3 默认 A 明写 Sarasa Mono Slab SC，§6 验收出现 UI Slab。实现采用 §3 A，不擅自换成 B；真实验收记录具体渲染家族。
2. 原代码空 flavor 回退 high-contrast，但恢复官方的语义要求显式 Default Light 解除样式。保留空值回退；用户明确选官方时写入显式官方 flavor，不采用可能覆盖官方选择的暖背景推断。
3. 视觉作用域统一收紧为自定义预设且 body.theme-light，以满足原文官方 Dark／默认样式隔离要求。保持作者各组数值与选择器目标。

## 执行工程适配（不冒称作者逐字实现）

scripts/patch-core.js 使用可撤销 Storage 原型包装，仅作用于 localStorage；同一实现重复注入复用实例，切换不被旧闭包锁定。document_start 先装护栏，等 head／body 就绪再挂样式。汉化以原字典为准，观察文本更新；撤销时只还原仍等于本补丁译文的节点。设置路由守卫保留 history.state。

scripts/cdp.js 校验本机端点、按消息 id 匹配响应、检测页面异常、超时和断线。针对 Antigravity 2.x WebContentsView 架构优化：目标过滤匹配 Antigravity/Jetski 标题或 127.0.0.1 语言服务端点，杜绝冷启动或未选定会话时因标题未同步而丢失主页面。daemon 为每个 CDP 会话各注册一次新文档脚本，心跳补回丢失样式；停止时移除注册。cli 管理 `com.wensenlab.antigravity-theme` LaunchAgent 并自动清理迁移旧版 `com.vstart.antigravity-theme` 服务，检查加载状态并如实传播错误，不以“100%恢复”代替重启验收。

assets/themes.css 针对 Antigravity 2.x 升级：底部输入框精准覆盖新版 `[data-testid="agent-input-box"]`，字体族注入 Antigravity 原生 `--editor-font-family` 变量，UI 字体范围扩展至新版 Auxiliary Pane（辅助面板）、Swarm Board 蜂群看板与分栏组件。

这些属于可靠性与界面演进适配。若实际 Antigravity 的标题、DOM、存储键或 CDP 行为变更，应先诊断并对照作者更新，不能悄悄扩大注入目标或自行重设计主题。
