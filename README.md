# 🐱 Desktop Cat — 桌面健康守护宠物

> 一只常驻桌面的像素宠物，陪你工作，到点强制让你起来活动。

![demo](docs/demo.gif)

---

## 版本选择

这个仓库现在保留两条版本线，用户可以按自己的设备和用途下载：

| 版本 | 适合谁 | 下载入口 | 状态 |
|---|---|---|---|
| **Windows 本地版 v0.1.0** | Windows 10 / 11 用户，需要本地桌面宠物和强制休息提醒 | [下载 Windows 安装包](https://github.com/powerycy/desktop-cat/releases/tag/v0.1.0) | 已发布 |
| **拦屏小可爱 AI iOS 版** | 想体验 AI 形象生成和 iOS 版本线的用户/开发者 | [下载 AI iOS 源码包](https://github.com/powerycy/desktop-cat/archive/refs/tags/ai-ios-v0.1.0.zip) · [查看分支](https://github.com/powerycy/desktop-cat/tree/codex/ios-ai-production) | 生产包版本线准备中 |

更详细的选择说明见 [DOWNLOADS.md](DOWNLOADS.md)。

### 两个版本有什么区别？

| 对比项 | Windows 本地版 v0.1.0 | 拦屏小可爱 AI iOS 版 |
|---|---|---|
| 主要平台 | Windows 10 / 11 | iOS 版本线 |
| 产品形态 | Tauri 桌面宠物，本地安装包 | AI 版本源码与交付文档 |
| 核心能力 | 桌宠、托盘、开机自启、全屏休息遮罩、自定义 PNG 皮肤 | 在保留健康提醒能力基础上，新增 AI 形象生成和生产交付文档 |
| 下载方式 | GitHub Releases 下载 `.exe` | 下载源码包或切换到 `codex/ios-ai-production` 分支 |
| 是否影响旧版 | 保留为 `v0.1.0` 标签和 Release | 独立分支，不覆盖 Win 版 |

## 为什么选 Desktop Cat？

市面上的桌面宠物软件大多是摆设，Desktop Cat 有三点真正不同：

| | Desktop Cat | 其他桌面宠物 |
|---|---|---|
| **资源占用** | Rust 原生，内存 < 30MB | Electron，动辄 200MB+ |
| **休息提醒** | 全屏强制遮罩，无法绕过 | 弹窗提醒，一键关掉 |
| **自定义皮肤** | 上传 PNG 帧集即可，完全自制 | 固定皮肤或付费解锁 |

**Rust + Tauri 架构**：安装包 < 5MB，长期后台常驻几乎无感知，不像 Electron 应用那样吃内存、拖慢电脑。

**强制休息，不是提醒**：工作 40 分钟后，宠物从屏幕边缘潜行入场，全屏遮罩无法操作其他应用，倒计时结束才自动恢复——真正杜绝久坐，而不是让你点"稍后提醒"。

**手搓皮肤**：按照帧集规范自己画，上传 PNG 文件夹即可替换形象，详见 [SPRITE_GUIDE.md](SPRITE_GUIDE.md)。

---

## ✨ 功能特性

- 透明无边框窗口，像素猫常驻桌面最上层
- 行走 / 坐着 / 打瞌睡自然行为循环
- 点击穿透：非宠物像素区域不阻挡正常操作
- 工作时长 / 休息时长可自由配置
- 内置爱坤、暴躁喵两款皮肤
- 开机自启、系统托盘常驻

---

## 📥 下载安装

如果你要安装 Windows 本地版，前往 [Windows 本地版 v0.1.0 Release](https://github.com/powerycy/desktop-cat/releases/tag/v0.1.0) 下载 `.exe` 安装包，双击安装即可。

如果你要查看 AI iOS 版本线，前往 [DOWNLOADS.md](DOWNLOADS.md) 选择源码包或分支。

**系统要求：** Windows 10 / 11

---

## 🎨 自定义皮肤

支持上传自己的像素动画替换宠物形象，详见 [SPRITE_GUIDE.md](SPRITE_GUIDE.md)。

---

## 🛠️ 开发者构建

**环境要求：**
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) + Cargo
- [Tauri CLI](https://tauri.app/start/prerequisites/)

```bash
npm install
npm run tauri dev    # 开发模式
npm run tauri build  # 打包构建
```

安装包输出在 `src-tauri/target/release/bundle/nsis/`。

---

## 🏗️ 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vue 3 + TypeScript + Vite |
| 桌面框架 | Tauri v2 (Rust) |
| 动画系统 | 逐帧 PNG + Canvas |
| 状态管理 | Pinia |

---

## 联系作者

- 邮箱：247133278@qq.com
- 微信：loonges
- QQ：247133278
- 小红书 / B站：好奇的小逸

---

## 📄 License

当前版本采用非商用许可证，详见 [LICENSE](LICENSE)。历史 Windows v0.1.0 Release 保留其发布时的许可证文件。
