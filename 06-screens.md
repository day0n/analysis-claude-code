# 06 - screens 模块源码分析

> 路径: `src/screens/`
> 文件数: 3 个
> 功能: 主要 UI 屏幕 — REPL、会话恢复、诊断

---

## 模块概述

`screens/` 包含 Claude Code 的三个主要用户界面屏幕。其中 `REPL.tsx` 是整个应用最核心、最庞大的组件。

---

## 1. REPL.tsx — 主交互屏幕（应用心脏）

**行数**: 5005 行（整个项目最大的单文件）

### 功能概述
REPL（Read-Eval-Print Loop）是 Claude Code 的核心交互界面，管理整个对话流程、工具执行、权限处理和用户交互。

### 架构分层

```
┌─────────────────────────────────────────────────┐
│                   REPL 组件                       │
├─────────────────────────────────────────────────┤
│  输入层: PromptInput 组件                         │
│  ├── 用户文本输入                                 │
│  ├── 命令解析 (/help, /commit 等)                │
│  └── 附件处理（图片、文件）                        │
├─────────────────────────────────────────────────┤
│  处理层: 消息处理 & 查询执行                       │
│  ├── 消息队列管理                                 │
│  ├── query() 调用 → Claude API                   │
│  ├── 流式响应处理                                 │
│  ├── 工具调用分发                                 │
│  └── 权限请求处理                                 │
├─────────────────────────────────────────────────┤
│  状态层: 会话 & 文件状态                           │
│  ├── 对话消息数组                                 │
│  ├── 文件状态缓存                                 │
│  ├── 归因状态（用于 commit）                       │
│  ├── 后台任务状态                                 │
│  └── Swarm/团队成员状态                           │
├─────────────────────────────────────────────────┤
│  渲染层: UI 输出                                  │
│  ├── 消息列表（虚拟滚动）                          │
│  ├── 任务列表 (TaskListV2)                        │
│  ├── 权限对话框                                   │
│  ├── 费用摘要                                     │
│  ├── 处理中 Spinner                               │
│  └── 全屏布局模式                                 │
└─────────────────────────────────────────────────┘
```

### 核心状态

```typescript
// 主要 useState 状态
const [messages, setMessages] = useState<Message[]>([])        // 对话消息
const [isProcessing, setIsProcessing] = useState(false)        // 是否处理中
const [permissionRequest, setPermissionRequest] = useState()    // 权限请求
const [fileStateCache, setFileStateCache] = useState()          // 文件状态
const [attribution, setAttribution] = useState()                // 归因信息
const [backgroundTasks, setBackgroundTasks] = useState()        // 后台任务
```

### 消息处理流程

```
用户输入
  ↓
解析命令 (/ 开头?)
  ├── 是 → 执行命令处理器
  └── 否 → 构建用户消息
           ↓
         添加到消息数组
           ↓
         调用 query(messages, tools, config)
           ↓
         流式接收响应
           ├── 文本块 → 追加到助手消息
           ├── 工具调用 → 检查权限 → 执行工具 → 返回结果
           └── 停止信号 → 执行停止钩子 → 完成回合
```

### 工具执行流程

```
AI 请求工具调用
  ↓
权限检查
  ├── 自动允许 → 直接执行
  ├── 需要确认 → 显示权限对话框
  │   ├── 用户允许 → 执行
  │   └── 用户拒绝 → 返回拒绝结果
  └── 沙箱权限 → 沙箱权限管理
           ↓
         执行工具
           ↓
         收集结果
           ↓
         更新文件状态缓存
           ↓
         追踪执行指标
```

### 高级功能

| 功能 | 说明 |
|------|------|
| 语音集成 | 条件加载的语音输入/输出 |
| IDE Diff 同步 | 与 IDE 的文件差异同步 |
| 远程会话 | 支持远程 SSH 会话 |
| 主动建议 | 条件启用的主动提示建议 |
| 定时任务/触发器 | 条件启用的计划任务 |
| Web 浏览器工具 | 条件启用的浏览器自动化 |
| 消息编辑 | 支持编辑和重新提交消息 |
| 压缩操作 | 手动/自动消息压缩 |
| 会话分叉 | 从任意点分叉会话 |

### 会话管理

```typescript
// 自动保存
useEffect(() => {
  const interval = setInterval(() => {
    saveSessionState(messages, metadata)
  }, AUTO_SAVE_INTERVAL)
  return () => clearInterval(interval)
}, [messages])

// 会话标题生成
useEffect(() => {
  if (messages.length > 2 && !sessionTitle) {
    generateSessionTitle(messages).then(setSessionTitle)
  }
}, [messages.length])
```

---

## 2. ResumeConversation.tsx — 会话恢复屏幕

**行数**: 398 行

### 功能概述
允许用户浏览和恢复之前的对话会话，支持同仓库和跨项目的会话查找。

### 核心流程

```
加载会话列表（渐进式）
  ↓
显示会话选择器
  ├── 按仓库过滤
  ├── 按 PR 编号过滤
  └── 跨项目搜索
  ↓
用户选择会话
  ↓
检查跨项目情况
  ├── 同项目 → 直接恢复
  └── 跨项目 → 显示切换命令
  ↓
恢复会话数据
  ├── restoreSessionMetadata() — 恢复会话元数据
  ├── restoreWorktreeForResume() — 恢复 Worktree 状态
  ├── adoptResumedSessionFile() — 接管会话文件指针
  ├── restoreAgentFromSession() — 恢复 Agent 上下文
  └── recordContentReplacement() — 记录内容替换
  ↓
渲染 REPL 组件（带恢复的消息）
```

### 关键函数

```typescript
// 渐进式加载会话日志
loadSameRepoMessageLogsProgressive()   // 同仓库会话
loadAllProjectsMessageLogsProgressive() // 所有项目会话

// PR 过滤
parsePrIdentifier(input: string)  // 解析 PR 标识符

// 跨项目检测
checkCrossProjectResume(session, currentProject)

// 会话分叉
forkSession(originalSession)  // 创建会话副本
```

### 会话恢复（真实函数）
```typescript
// 源码 src/screens/ResumeConversation.tsx:254-261
restoreSessionMetadata(...)       // 恢复会话元数据
restoreWorktreeForResume(...)     // 恢复 Worktree 状态
adoptResumedSessionFile()         // 接管会话文件指针
```

注意：之前文档中写的 `adoptSession()` 抽象函数**不存在**。

---

## 3. Doctor.tsx — 诊断屏幕

**行数**: 574 行

### 功能概述
系统诊断和健康检查屏幕，显示系统信息、配置状态、验证错误和版本信息。

### 诊断内容

```
Doctor 诊断报告
├── 系统信息
│   ├── Claude Code 版本
│   ├── 操作系统版本
│   ├── Node/Bun 运行时版本
│   └── Shell 类型
│
├── Agent 信息
│   ├── 活跃 Agent 列表（按来源分组）
│   │   ├── built-in (内置)
│   │   ├── user (用户级)
│   │   ├── project (项目级)
│   │   └── plugin (插件)
│   ├── Agent 目录路径
│   └── 加载失败的 Agent 文件
│
├── 配置验证
│   ├── settings.json 验证错误
│   ├── MCP 解析警告
│   ├── 环境变量验证
│   │   ├── BASH_MAX_OUTPUT_LENGTH
│   │   ├── TASK_MAX_OUTPUT_LENGTH
│   │   └── CLAUDE_CODE_MAX_OUTPUT_TOKENS
│   └── 快捷键冲突
│
├── 版本信息
│   ├── 当前版本
│   ├── 可用版本（stable/latest）
│   ├── 自动更新渠道
│   └── npm/GCS dist tags
│
├── 锁管理
│   ├── PID 版本锁状态
│   ├── 活跃锁列表
│   └── 已清理的过期锁
│
└── 沙箱诊断
    └── 沙箱环境状态
```

### 导出
- `Doctor` — 主组件
- `DistTagsDisplay` — 版本标签显示辅助组件

### UI 结构
```typescript
<Pane title="Claude Code Doctor">
  <SystemInfo />
  <AgentInfo />
  <ValidationErrors />
  <VersionInfo />
  <LockStatus />
  <SandboxDiagnostic />
  <Text>"Press Enter to continue"</Text>
</Pane>
```

---

## 模块间关系

```
screens/
├── REPL.tsx
│   ├── ← components/ (UI 组件)
│   ├── ← query/ (查询执行)
│   ├── ← tools/ (工具注册)
│   ├── ← hooks/ (钩子系统)
│   ├── ← services/ (API/分析)
│   ├── ← state/ (状态管理)
│   └── ← keybindings/ (快捷键)
│
├── ResumeConversation.tsx
│   ├── ← utils/sessionStorage (会话存储)
│   ├── ← utils/fileHistory (文件历史)
│   └── → REPL.tsx (恢复后渲染)
│r.tsx
    ├── ← services/analytics (诊断数据)
    ├── ← schemas/ (配置验证)
    └── ← cli/update (版本检查)
```
