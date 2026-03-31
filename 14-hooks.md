# 14 - hooks 模块源码分析

> 路径: `src/hooks/`（React UI hooks）+ `src/utils/hooks/`（钩子执行引擎）
> 功能: 钩子系统 — 工具生命周期事件的拦截与扩展

---

## 重要说明：两个目录的区别

| 目录 | 内容 | 文件数 |
|------|------|--------|
| `src/hooks/` | **React UI hooks**（useArrowKeyHistory、useCanUseTool、useGlobalKeybindings 等） | 85+ |
| `src/utils/hooks/` | **钩子执行引擎**（execPromptHook、execHttpHook、execAgentHook 等） | 17 |

文档以下内容描述的是 `src/utils/hooks/` 中的钩子执行系统，不是 `src/hooks/` 中的 React hooks。

---

## src/hooks/ — React UI Hooks（85+ 文件）

这些是标准的 React hooks，用于 UI 状态管理，与钩子执行系统无关：

```
src/hooks/
├── useArrowKeyHistory.tsx      # 箭头键历史导航
├── useCanUseTool.tsx           # 工具可用性检查
├── useGlobalKeybindings.tsx    # 全局快捷键
├── useReplBridge.tsx           # REPL 桥接
├── useVoice.ts                 # 语音模式
├── useCommandQueue.ts          # 命令队列
├── useDiffData.ts              # Diff 数据
├── useExitOnCtrlCD.ts          # Ctrl+C/D 退出
├── useDynamicConfig.ts         # 动态配置
├── notifs/                     # 通知相关 hooks
├── toolPermission/             # 工具权限相关 hooks
└── ... 80+ 其他 React hooks
```

---

## src/utils/hooks/ — 钩子执行引擎（17 文件）

这才是真正的钩子配置与执行系统：

```
src/utils/hooks/
├── AsyncHookRegistry.ts        # 异步钩子注册表与生命周期管理
├── sessionHooks.ts             # 会话级钩子注册
├── hookEvents.ts               # 钩子事件发射系统
├── hookHelpers.ts              # 钩子辅助函数
├── hooksConfigManager.ts       # 钩子配置管理
├── hooksConfigSnapshot.ts      # 钩子配置快照
├── hooksSettings.ts            # 钩子设置验证
├── execAgentHook.ts            # Agent 钩子执行器
├── execHttpHook.ts             # HTTP Webhook 执行器
├── execPromptHook.ts           # LLM 提示钩子执行器
├── apiQueryHookHelper.ts       # API 查询钩子辅助
├── postSamplingHooks.ts        # 采样后钩子
├── registerFrontmatterHooks.ts # Frontmatter 钩子注册
├── registerSkillHooks.ts       # 技能钩子注册
├── skillImprovement.ts         # 技能改进
├── fileChangedWatcher.ts       # 文件变更监听
└── ssrfGuard.ts                # SSRF 防护（HTTP 钩子安全）
```

---

## 钩子事件类型（28 个）

源码 `src/entrypoints/sdk/coreTypes.ts:25-53`：

| 事件 | 说明 |
|------|------|
| `PreToolUse` | 工具执行前，可阻止执行 |
| `PostToolUse` | 工具执行后，可检查结果 |
| `PostToolUseFailure` | 工具执行失败后 |
| `Notification` | 通知发送时 |
| `UserPromptSubmit` | 用户提交提示时 |
| `SessionStart` | 会话开始 |
| `SessionEnd` | 会话结束 |
| `Stop` | 回合结束时，可阻止结束 |
| `StopFailure` | 停止失败时 |
| `SubagentStart` | 子 Agent 启动时 |
| `SubagentStop` | 子 Agent 停止时 |
| `PreCompact` | 消息压缩前 |
| `PostCompact` | 消息压缩后 |
| `PermissionRequest` | 权限请求时 |
| `PermissionDenied` | 权限被拒绝时 |
| `Setup` | 初始化设置时 |
| `TeammateIdle` | 队友空闲时 |
| `TaskCreated`| `TaskCompleted` | 任务完成时 |
| `Elicitation` | 引出（向用户提问）时 |
| `ElicitationResult` | 引出结果返回时 |
| `ConfigChange` | 配置变更时 |
| `WorktreeCreate` | Worktree 创建时 |
| `WorktreeRemove` | Worktree 移除时 |
| `InstructionsLoaded` | 指令加载完成时 |
| `CwdChanged` | 工作目录变更时 |
| `FileChanged` | 文件变更时 |

---

## 钩子类型（4 种）

### 1. Shell 命令钩子 (command)
```json
{
  "type": "command",
  "command": "npm test",
  "shell": "bash",
  "timeout": 30000,
  "if": "Bash(npm *)"
}
```
执行器: `src/utils/hooks/` 中通过 shell 子进程执行

### 2. LLM 提示钩子 (prompt)
```json
{
  "type": "prompt",
  "prompt": "检查这个代码变更是否安全",
  "model": "claude-haiku-4-5",
  "timeout": 60000
}
```
执行器: `src/utils/hooks/execPromptHook.ts`

### 3. HTTP Webhook 钩子 (http)
```json
{
  "type": "http",
  "url": "https://api.example.com/hook",
  "headers": { "Authorization": "Bearer $TOKEN" },
  "timeout": 10000
}
```
执行器: `src/utils/hooks/execHttpHook.ts`（含 `ssrfGuard.ts` SSRF 防护）

### 4. Agent 验证器钩子 (agent)
```json
{
  "type": "agent",
  "prompt": "验证代码变更符合团队规范",
  "model": "claude-sonnet-4-6",
  "timeout": 120000
}
```
执行器: `src/utils/hooks/execAgentHook.ts`

---

## 钩子配置格式

```json
// settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash(*)",
        "hooks": [
          {
            "type": "command",
            "command": "echo '即将执行: $TOOL_INPUT'",
            "timeout": 5000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write(*)",
        "hooks": [
          {
            "type": "command",
            "command": "eslint --fix $FILE_PATH",
            "timeout": 30000
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
        : "prompt",
            "prompt": "总结本次对话的关键变更"
          }
        ]
      }
    ]
  }
}
```

---

## 钩子执行流程

```
工具调用请求
    ↓
PreToolUse 钩子 (src/utils/hooks/)
    ├── matcher 匹配检查
    ├── if 条件检查
    ├── 执行钩子（并行）
    ├── 收集结果
    │   ├── 阻塞错误 → 阻止工具执行
    │   └── 非阻塞 → 继续
    ↓
工具执行
    ↓
PostToolUse 钩子
    ├── 同样的匹配和执行流程
    ├── 可以检查工具结果
    └── 可以触发后续操作
    ↓
回合结束
    ↓
Stop 钩子
    ├── 执行停止钩子
    ├── 后台任务（记忆提取等）
    └── 可以阻止回合结束
```

---

## 设计亮点

1. **双目录分离**: React UI hooks (`src/hooks/`) 与钩子执行引擎 (`src/utils/hooks/`) 完全分离
2. **28 种事件**: 覆生命周期的完整事件链
3. **: HTTP 钩子内置 SSRF 安全守卫
4. **Matcher 模式**: 使用 glob 模式匹配工具名和参数
5. **条件执行**: `if` 字段支持权限规则语法过滤
6. **并行执行**: 同一事件的多个钩子并行执行
7. **超时控制**: 每个钩子独立超时
