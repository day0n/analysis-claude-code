# 05 - commands 模块源码分析

> 路径: `src/commands/`
> 功能: 斜杠命令实现 — 内置命令的具体逻辑

---

## 模块概述

`commands/` 包含所有内置斜杠命令的具体实现。这些命令通过 `/命令名` 在 REPL 中调用，涵盖会话管理、配置、调试、模型切换等功能。

## 典型命令列表

| 命令 | 功能 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空对话 |
| `/compact` | 压缩对话历史 |
| `/model` | 切换模型 |
| `/config` | 配置管理 |
| `/cost` | 显示费用 |
| `/doctor` | 运行诊断 |
| `/login` | 登录认证 |
| `/logout` | 登出 |
| `/permissions` | 权限管理 |
| `/mcp` | MCP 服务器管理 |
| `/vim` | 切换 Vim 模式 |
| `/theme` | 切换主题 |
| `/fast` | 切换快速模式 |
| `/bug` | 报告 Bug |
| `/init` | 初始化项目配置 |
| `/memory` | 记忆管理 |
| `/tasks` | 任务管理 |
| `/hooks` | 钩子管理 |
| `/listen` | 语音模式 |

## 命令注册模式

每个命令文件导出一个 `Command` 对象：

```typescript
// 典型命令结构
export const helpCommand: Command = {
  name: 'help',
  description: '显示帮助信息',
  isEnabled: () => true,
  isHidden: false,
  userFacing: true,
  execute: async (args, context) => {
    // 命令逻辑
  },
  render: (props) => {
    // React 组件渲染
    return <HelpScreen />
  }
}
```

## 命令分类

### 会话管理命令
- `/clear` — 清空当前对话，重新开始
- `/compact` — 压缩对话历史，减少 token 使用
- `/resume` — 恢复之前的会话

### 配置命令
- `/config` — 查看/修改配置
- `/permissions` — 管理权限规则
- `/model` — 切换 AI 模型
- `/theme` — 切换 UI 主题
- `/vim` — 切换 Vim 编辑模式
- `/fast` — 切换快速模式

### 诊断命令
- `/doctor` — 运行系统诊断
- `/cost` — 显示当前会话费用
- `/bug` — 生成 Bug 报告

### 认证命令
- `/login` — OAuth 登录
- `/logout` — 登出

### 扩展命令
- `/mcp` — MCP 服务器管理
- `/hooks` — 钩子配置
- `/tasks` — 后台任务管理
- `/memory` — 自动记忆管理

---

## 命令安全分类

```typescript
// 注意：这两个集合存放的是 Command 对象，不是字符串
const REMOTE_SAFE_COMMANDS: Set<Command> = new Set([...])
const BRIDGE_SAFE_COMMANDS: Set<Command> = new Set([...])

// 内部命令 — 对 AI 隐藏
const INTERNAL_ONLY_COMMANDS = new Set([...])
```
```
