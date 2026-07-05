# AI 与自动化说明

## AI 形象生成

| 项 | 内容 |
| --- | --- |
| Trigger | 用户在设置页点击 AI 生成 |
| Owner | 本机用户 |
| Runs automatically | 否，必须用户主动触发 |
| Inputs | Gemini API Key、皮肤名称、角色描述 |
| External API | Google Generative Language API |
| Output | 一张 PNG sprite sheet，随后裁切为动作帧 |
| Side effect | 写入本机皮肤目录并生成 `manifest.json` |

## Guardrails

- 皮肤名称校验：不能为空，不能是 `default-cat`，只能包含字母、数字、`-`、`_` 或非 ASCII 字符。
- 生成提示词由代码补充固定格式，要求透明背景、3x3 网格、固定动作顺序、无文字和水印。
- 返回图片会被解析、裁切、居中并保存为标准动作帧。
- 生成失败时返回错误，不写入不完整皮肤集。

## App-Owned Side Effects

- AI 只返回图片。
- 是否保存、如何裁切、manifest 如何生成由应用代码控制。
- 当前没有后台自动生成、自动上传、自动发布、自动收费流程。

## Not Present

- No scheduled work, so no `cron.md`.
- No transactional email, so no `emails.md`.
- No public/indexable routes or SEO workflow, so no `seo.md`.
