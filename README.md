# Flow Runner

Chrome 插件，快速触发 RunFlow API，支持 SQL 执行和 JSON 参数编辑。

## 功能特性

- 🚀 一键调用 flowKey，利用浏览器登录态
- 📝 SQL 编辑器：语法高亮 + 智能补全 + 自动缩进
- 📋 JSON 参数编辑器：语法高亮
- 💾 自动保存：关闭后再打开，输入内容不丢失
- 🔍 放大编辑：独立窗口编辑长 SQL 或 JSON
- 📦 响应结果：支持复制和放大查看

## 项目结构

```
flow-runner/
├── manifest.json   # 插件配置
├── popup.html      # 主界面
├── popup.js        # 主逻辑
├── editor.html     # 独立编辑器窗口
├── editor.js       # 编辑器逻辑（高亮、补全）
├── icon.png        # 图标
└── README.md
```

## 安装使用

1. 打开 `chrome://extensions/`，开启开发者模式
2. 点击「加载已解压的扩展程序」，选择本文件夹
3. 打开目标系统并登录
4. 点击插件图标
5. 填写参数，执行请求

## 界面说明

| 字段 | 说明 |
|------|------|
| URL | 自动获取当前页面域名 + `/api/runFlow` |
| flowKey | 要调用的流程 Key |
| SQL | 可选，填写后自动合并到请求参数的 `sql` 字段 |
| 请求参数 | JSON 格式，默认 `{"action": "run_sql"}` |

## 快捷操作

| 操作 | 说明 |
|------|------|
| ⛶ 按钮 | 打开独立窗口编辑（SQL/参数/响应） |
| 重置 | 清空所有输入，恢复默认值 |
| 复制 | 复制响应结果 |

## 编辑器功能

独立编辑器窗口（点击 ⛶ 打开）支持：

- **SQL 语法高亮**：关键词、函数、字符串、数字、注释
- **智能补全**：输入时自动提示 SQL 关键词和函数
- **自动缩进**：Enter 保持缩进，`{` `(` `[` 后自动增加缩进
- **快捷键**：
  - `Ctrl+Enter` 确认并关闭
  - `Tab` 插入 2 空格
  - `ESC` 取消

## 权限说明

```json
{
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["https://*/*"]
}
```

| 权限 | 用途 |
|------|------|
| `activeTab` | 访问当前标签页 |
| `scripting` | 注入脚本执行请求 |
| `storage` | 保存输入内容 |
| `host_permissions` | 支持任意 HTTPS 域名 |

## 运行原理

```
用户点击执行 → popup.js 调用 executeScript
    → 注入代码到当前页面执行
    → 读取 Cookie 中的 Authorization
    → 发起同源 fetch 请求
    → 返回结果显示
```

核心：利用 `chrome.scripting.executeScript` 在目标页面上下文执行请求，自动携带登录态。
