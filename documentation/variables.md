# 配置与密钥

## 变量清单

| Name | Used by | Scope | Source | Rotation | Risk |
| --- | --- | --- | --- | --- | --- |
| Gemini API Key | `generate_ai_sprite_set` | 用户输入，运行时传入 | 设置页输入框 | 用户在 Google AI Studio 轮换 | 可用于消耗 API 配额；不要提交到仓库 |
| `work_interval_minutes` | Tauri store、计时器 | 本机 | 设置页 | 用户可改 | 错误值会影响提醒节奏 |
| `rest_duration_minutes` | Tauri store、休息窗口 | 本机 | 设置页 | 用户可改 | 错误值会影响休息体验 |
| `active_sprite_set` | Tauri store、皮肤加载 | 本机 | 设置页、导入、AI 生成 | 用户可改 | 不存在时需要回退到可用皮肤 |
| `tiny-guardian-config` | `guardianStore` | localStorage | 本机页面 | 用户清除浏览器数据 | 包含守护配置文案 |
| `tiny-guardian-health-stats` | `healthStore` | localStorage | 本机页面 | 用户清除浏览器数据 | 包含专注和休息统计 |

## 密钥处理

- 仓库不应包含 Gemini API Key。
- README 不写密钥示例。
- 生产包发版前应确认日志和错误提示不会输出完整 API Key。
- 当前代码把 API Key 从设置页传给 Tauri 命令后直接请求 Gemini；没有显式持久化 API Key。

## Pre-Go-Live Checklist

- 确认 `LICENSE` 是非商用许可证。
- 确认没有 `.env`、API Key、真实用户数据进入 Git。
- 确认 iOS 打包配置已经补齐后再声明为可安装 iOS 包。
- 对 Gemini 真实请求做一次受控验证。
- 对休息窗口中断、强制休息、统计记录做一次手动验收。
