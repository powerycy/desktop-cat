# 拦屏小可爱

> 一个常驻桌面的健康提醒小可爱：陪你专注，到点提醒你休息，必要时拦屏让你离开电脑。

English name: **Lanping Xiaokeai**

本项目基于 `powerycy/desktop-cat` 改造。本分支用于新增 **AI iOS 生产版交付包**，保留上一次 Windows 本地版本的内容和历史，不作为现有网站入口的替换。

完整交付说明见 [`documentation/architecture.md`](documentation/architecture.md)。

## 当前能力

- 本地生成「拦屏小可爱」配置，不请求真实 API
- 支持 Google AI Studio / Gemini 图片生成桌宠动作帧
- 中文/英文/日文/韩文/西语界面切换
- 专注结束后先软提醒，可跳过一次或立即休息
- 连续跳过 2 次后，下次自动进入强制休息
- 健康统计本地保存：专注次数、完成休息、跳过休息、强制休息、最长专注、总休息时长
- 支持内置皮肤和自定义 PNG 动作帧皮肤

## 页面

- `/#/`：桌面小可爱窗口
- `/#/settings`：设置
- `/#/xiaokeai`：拦屏小可爱设置页
- `/#/report`：健康报告
- `/#/rest`：全屏休息遮罩

## 预设皮肤

项目内仍保留原来的预设皮肤：

- `暴躁喵`
- `爱坤`

Tauri 桌面版会从 `src-tauri/resources/sprites` 扫描这些皮肤。

## 自定义皮肤

上传透明 PNG 动作帧，必需动作：

- 行走：`walk_01.png` 或 `行走_01.png` ...
- 坐姿：`sit_01.png` 或 `坐姿_01.png` ...
- 睡觉：`sleep_01.png` 或 `睡觉_01.png` ...
- 休息：`rest_01.png` 或 `休息_01.png` ...

可以在设置页一张一张选择素材，文件会累计到已选列表，最后统一导入。

## 开发运行

```bash
npm install
npm run dev
```

浏览器预览只能看页面，不会出现真正悬浮桌宠。

要运行桌面宠物，需要本机安装 Rust/Cargo，然后运行：

```bash
npm run tauri dev
```

## 技术栈

- Vue 3 + TypeScript + Vite
- Pinia
- Tauri v2 / Rust
- 本地 localStorage 统计与配置

## 版本说明

这次上传定位为 `ios-ai-production` 版本线，用来承载 AI 形象生成、健康提醒和生产包交付文档。当前仓库仍保留 Windows/Tauri 本地版能力；如果后续要发布 iOS 原生包，需要继续补齐 iOS 打包配置。

## License

非商用许可证，详见 [LICENSE](LICENSE)。
