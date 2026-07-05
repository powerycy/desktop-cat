# 拦屏小可爱架构说明

## 产品概览

拦屏小可爱，English name: **Lanping Xiaokeai**，是基于 `powerycy/desktop-cat` 改造的健康提醒桌宠。这个版本线用于 AI iOS 生产版交付包，不删除或替换上一次 Windows 本地版本。

当前代码事实：

- 前端是 Vue 3 + TypeScript + Vite + Pinia。
- 原生层是 Tauri v2 + Rust，当前 bundle 目标仍是 Windows `nsis`。
- AI 形象生成通过用户输入的 Google AI Studio / Gemini API Key 触发一次性图片生成。
- 守护配置文案目前使用本地 mock 生成，不请求真实 LLM。
- 健康统计和守护配置保存在本机 localStorage；Tauri 配置保存在应用数据目录。

## 核心模块

| 模块 | 文件 | 作用 |
| --- | --- | --- |
| 桌宠窗口 | `src/views/PetView.vue` | 桌宠展示、拖拽、互动、专注计时入口 |
| 设置页 | `src/views/SettingsView.vue` | 休息参数、语言、皮肤上传、AI 皮肤生成 |
| 休息遮罩 | `src/views/RestView.vue` | 全屏休息倒计时、强制休息提示、结果记录 |
| 守护配置 | `src/stores/guardianStore.ts` | 默认守护形象、本地生成配置、localStorage 持久化 |
| 健康统计 | `src/stores/healthStore.ts` | 专注、休息、跳过、强制休息次数统计 |
| AI 生成 | `src-tauri/src/commands/pet.rs` | Gemini 图片请求、动作帧裁切、manifest 写入 |
| Tauri 权限 | `src-tauri/capabilities/default.json` | 窗口、事件、存储、文件、开机启动权限 |

## 信任边界

| 边界 | 数据 | 控制点 |
| --- | --- | --- |
| 用户界面到 Tauri 命令 | 设置、皮肤文件、AI 生成请求 | Tauri command 参数校验 |
| Tauri 到本机文件系统 | 自定义皮肤、AI 生成皮肤、配置文件 | 仅写入应用数据目录或开发资源目录 |
| Tauri 到 Gemini | API Key、用户提示词 | 用户手动输入后触发，不在代码中硬编码 |
| 页面到 localStorage | 守护配置、健康统计 | 浏览器本地存储，不上传服务器 |

## 已确认不会改变网站的点

- 仓库没有发现 Netlify、Vercel、Firebase、Pages 等部署配置文件。
- 本次文档改动不修改 `vite.config.ts`、`index.html` 的部署入口。
- 推荐将本次内容推送到独立分支 `codex/ios-ai-production`，不直接覆盖默认分支。

## 已知风险与假设

- iOS 原生生产包尚未在仓库中出现 Xcode/iOS 工程或 Tauri iOS 配置。
- Gemini API Key 由用户输入并传给 Tauri 命令；当前代码没有把密钥保存到仓库。
- AI 生成接口和模型名可能随 Google API 变更，需要在发版前做一次真实设备验证。
- 非商用许可证已经放在 `LICENSE`，README 只保留简短入口。

## Related Documents

- `documentation/flows.md`
- `documentation/permissions.md`
- `documentation/variables.md`
- `documentation/automation.md`
- `documentation/tests.md`
