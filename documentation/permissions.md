# 权限说明

## 角色

| 角色 | 说明 |
| --- | --- |
| 本机用户 | 唯一使用者，可以修改设置、生成皮肤、导入皮肤、启动休息 |
| 应用进程 | 代表用户执行 Tauri 命令、窗口控制、文件读写和外部 API 请求 |

当前没有账号系统、后台管理角色、服务端 session 或多租户权限。

## 操作矩阵

| 资源 | 操作 | 本机用户 | 应用进程 | 控制点 |
| --- | --- | --- | --- | --- |
| 休息配置 | 读取、保存 | 允许 | 允许 | `get_config`、`save_config` |
| 桌宠窗口 | 移动、置顶、点击穿透 | 允许 | 允许 | Tauri window permissions |
| 休息窗口 | 创建、关闭、全屏 | 允许 | 允许 | `create_rest_window`、`close_rest_window` |
| 自定义皮肤 | 读取、写入 | 允许 | 允许 | 文件选择器、`import_sprite_set` |
| AI 生成皮肤 | 创建 | 允许 | 允许 | `generate_ai_sprite_set` |
| 健康统计 | 本地读写 | 允许 | 页面执行 | localStorage |
| Gemini API | 图片生成请求 | 用户触发 | 应用代发 | API Key + prompt |

## Tauri 权限

`src-tauri/capabilities/default.json` 当前允许：

- 窗口控制：创建、关闭、显示、隐藏、置顶、大小、位置、全屏、点击穿透。
- 事件：emit/listen。
- Store：load/get/set/save/delete。
- Autostart：enable/disable/is-enabled。
- Dialog：open。
- File system：读写文件、读目录、创建目录、复制文件、exists。
- 文件范围：应用数据目录递归、资源目录递归。

## 数据边界

- 没有数据库和 RLS。
- 没有服务端权限校验。
- 权限主要依赖 Tauri capability、命令参数校验和本机文件作用域。
