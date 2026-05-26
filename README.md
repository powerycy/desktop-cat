# 🐱 Desktop Cat — 桌面健康守护宠物

> 一只常驻桌面的像素宠物，陪你工作，到点强制让你起来活动。

![demo](docs/demo.gif)

---

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

前往 [Releases](../../releases) 页面下载最新版 `.exe` 安装包，双击安装即可。

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

## 📄 License

[MIT](LICENSE)
