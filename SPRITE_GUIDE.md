# 自定义桌宠形象指南

## 素材规格

| 项目 | 要求 |
|------|------|
| 格式 | PNG（必须透明背景） |
| 尺寸 | 建议 256×256 像素 |
| 命名 | 见下方命名规范 |

## 文件命名规范

```
idle_01.png  idle_02.png  idle_03.png  idle_04.png   ← 待机动画（至少2帧）
walk_01.png  walk_02.png  walk_03.png  walk_04.png   ← 行走动画（至少2帧）
sleep_01.png sleep_02.png                            ← 睡觉动画（至少2帧）
```

数字部分从 `01` 开始，最多支持 99 帧。

## 用 AI 生成素材

### ChatGPT / DALL-E
提示词示例：
```
pixel art cat sprite, transparent background, idle animation frame 1,
cute, simple, 256x256, white cat with orange spots
```

### Midjourney
```
pixel art cat sprite sheet, transparent background, idle pose, cute chibi --no background --ar 1:1
```

生成后：
1. 用 **remove.bg** 去除背景（如果 AI 没有生成透明背景）
2. 用 **EZGIF** 或 PS 拆分帧，命名为 `idle_01.png` 等

### 其他工具
- **Aseprite**（付费）：专业像素画软件，可直接导出带透明度的 PNG 序列
- **LibreSprite**（免费）：Aseprite 的开源分支
- **Piskel**（免费网页版）：https://www.piskelapp.com/

## 如何安装自定义形象

1. 准备好所有 PNG 文件
2. 在应用设置 → 桌宠外观 → 上传自定义形象
3. 选择包含你素材文件的文件夹
4. 在"当前形象"下拉框选择你的形象名称
5. 点击"保存设置"

## 可选：manifest.json

在素材文件夹中放置 `manifest.json` 可精确控制帧列表：

```json
{
  "name": "My Cat",
  "idle":     ["idle_01.png", "idle_02.png", "idle_03.png"],
  "walk":     ["walk_01.png", "walk_02.png"],
  "sleep":    ["sleep_01.png", "sleep_02.png"],
  "interact": ["idle_01.png"]
}
```

如果没有 `manifest.json`，应用会自动按 `idle_0X.png` 等命名规律加载。
