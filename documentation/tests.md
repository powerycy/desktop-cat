# 测试覆盖地图

## Existing Coverage

| Use case | Rule | Expected behavior | Evidence | Status |
| --- | --- | --- | --- | --- |
| 本地化 | 默认中文标题 | `guardian.title` 返回「拦屏小可爱」 | `src/i18n/index.test.ts` | existing |
| 守护文案本地化 | 默认守护名称 | 中文显示名保持「拦屏小可爱」 | `src/services/guardianLocalizationService.test.ts` | existing |
| Gemini mock | 本地生成守护配置 | mock 不请求真实 API，并返回可用配置 | `src/services/geminiMockService.test.ts` | existing |
| 休息结果 | 完成、跳过、中断 | 正确解析休息结束原因 | `src/utils/restOutcome.test.ts` | existing |
| 休息动画 | 移动与阶段切换 | 休息窗口运动参数稳定 | `src/utils/restAnimation.test.ts`、`src/utils/restMotion.test.ts` | existing |
| 皮肤动作 | 必需动作识别 | 上传皮肤缺动作时能识别 | `src/utils/spriteActions.test.ts` | existing |
| 健康统计 | 专注、休息、跳过、强制休息 | 统计 reducer 按动作累加 | `src/stores/healthStats.test.ts` | existing |

## Proposed Tests

| Use case | Rule | Expected behavior | Test type | Status |
| --- | --- | --- | --- | --- |
| AI 皮肤生成 | 空 API Key 或空 prompt 不应请求 Gemini | 返回用户可理解错误 | automated unit/integration | proposed |
| AI 皮肤生成 | 非法皮肤名称不能写入文件 | 拒绝路径穿越和空名称 | automated Rust unit | proposed |
| AI 皮肤生成 | Gemini 返回非图片或错误 | 不生成半成品目录 | guarded live/manual | proposed |
| iOS 生产包 | iOS 打包配置存在并可构建 | 产物能在目标设备安装 | guarded live/manual | proposed |
| 非商用许可证 | README 不展开完整协议 | 首页只链接 LICENSE | manual review | proposed |

## Gaps

| Gap | Risk |
| --- | --- |
| 没有 Rust 命令级自动测试覆盖 `generate_ai_sprite_set` | AI 生成失败、文件写入失败或 API 变更可能到发版时才发现 |
| 没有真实 Gemini 受控集成测试 | 无法提前发现模型名、返回结构或配额错误 |
| 没有 iOS 原生打包验证 | 当前不能证明这个仓库已经能产出 iOS 安装包 |
| 没有端到端 UI 测试 | 设置保存、AI 生成、休息遮罩联动仍主要依赖手动验收 |
