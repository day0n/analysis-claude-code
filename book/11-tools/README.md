# 11 - tools 模块源码分析

> 路径: `src/tools/`
> 功能: AI 工具实现 — Claude 可调用的所有工具

---

## 模块概述

`tools/` 包含 Claude Code 中 AI 可以调用的所有工具实现。每个工具通过 `buildTool(def)` 工厂函数构建（不是类继承），接收 `ToolDef` 对象定义，返回 `BuiltTool`。

---

## 工具清单

### 文件操作工具

| 工具 | 功能 | 只读 | 破坏性 |
|------|------|------|--------|
| `Read` | 读取文件内容 | ✅ | ❌ |
| `Write` | 创建/覆写文件 | ❌ | ✅ |
| `Edit` | 精确字符串替换编辑 | ❌ | ❌ |
| `NotebookEdit` | Jupyter Notebook 编辑 | ❌ | ❌ |
| `Glob` | 文件模式匹配搜索 | ✅ | ❌ |
| `Grep` | 文件内容正则搜索 | ✅ | ❌ |

### 系统操作工具

| 工具 | 功能 | 只读 | 破坏性 |
|------|------|------|--------|
| `Bash` | 执行 Shell 命令 | ❌ | ✅ |
| `Agent` | 启动子 Agent | ❌ | ❌ |

### 网络工具

| 工具 | 功能 | 只读 | 破坏性 |
|------|------|------|--------|
| `WebFetch` | 获取网页内容 | ✅ | ❌ |
| `WebSearch` | 网页搜索 | ✅ | ❌ |

### 任务管理工具

| 工具 | 功能 | 只读 | 破坏性 |
|------|------|------|--------|
| `TodoWrite` | 写入任务列表 | ❌ | ❌ |

注意：`TodoReadTool` 目录**不存在**，只有 `TodoWriteTool`。

### 特殊工具

| 工具 | 功能 |
|------|------|
| `AskUser` | 向用户提问 |
| `EnterPlanMode` | 进入计划模式 |
| `ExitPlanMode` | 退出计划模式 |
| `Skill` | 调用技能 |
| `CronCreate` | 创建定时任务 |
| `CronDelete` | 删除定时任务 |
| `CronList` | 列出定时任务 |
| `EnterWorktree` | 进入 Git Worktree |
| `ExitWorktree` | 退出 Git Worktree |
| `RemoteTrigger` | 远程触发器 |

---

## 核心工具详解

### 1. Bash — Shell 命令执行

#### 权限检查
```typescript
needsPermission: (input) => {
  const { command } = input
  // 检查是否匹配自动允许规则
  if (matchesAllowRule(command)) return false
  // 检查是否是只读命令
  if (isReadOnlyCommand(command)) return false
  // 默认需要权限
  return true
}
```

#### 执行逻辑
```typescript
execute: async (input, context) => {
  const { command, timeout } = input
  // 1. 创建子进程
  const proc = spawn('sh', ['-c', command], {
    cwd: context.cwd,
    timeout: timeout || 120000,  // 默认 2 分钟超时
    env: { ...process.env, ...context.env },
  })
  // 2. 收集输出
  let stdout = '', stderr = ''
  proc.stdout.on('data', (d) => stdout += d)
  proc.stderr.on('data', (d) => stderr += d)
  // 3. 等待完成
  const exitCode = await waitForExit(proc)
  // 4. 截断过长输出
  return { stdout: truncate(stdout), stderr: truncate(stderr), exitCode }
}
```

#### 安全特性
- 命令白名单/黑名单
- 超时控制（默认 120 秒）
- 输出长度限制
- 沙箱环境支持
- 网络访问控制

---

### 2. Read — 文件读取

#### 功能特性
- 支持文本文件、图片、PDF、Jupyter Notebook
- 行号显示（cat -n 格式）
- 支持 offset/limit 分页读取
- 支持 PDF 页码范围
- 图片以多模态内容返回

```typescript
execute: async (input) => {
  const { file_path, offset, limit, pages } = input

  // 检测文件类型
  if (isImage(file_path)) {
    return { type: 'image',ait readFileAsBase64(file_path) }
  }
  if (isPDF(file_path)) {
    return { type: 'text', content: await extractPDFText(file_path, pages) }
  }
  if (isNotebook(file_path)) {
    return { type: 'text', content: await renderNotebook(file_path) }
  }

  // 文本文件
  const content = await readFileWithLineNumbers(file_path, offset, limit)
  return { type: 'text', content }
}
```

---

### 3. Edit — 精确编辑

#### 核心逻辑
```typescript
execute: async (input) => {
  const { file_path, old_string, new_string, replace_all } = input

  // 1. 读取文件
  const content = await readFile(file_path, 'utf-8')

  // 2. 查找 old_string
  if (!content.includes(old_string)) {
    throw new Error('old_string not found in file')
  }

  // 3. 检查唯一性（除非 replace_all）
  if (!replace_all) {
    const count = countOccurrences(content, old_string)
    if (count > 1) {
      throw new Error('old_string is not unique, provide more context')
    }
  }

  // 4. 执行替换
  const newContent = replace_all
    ? content.replaceAll(old_string, new_string)
    : content.replace(old_string, new_string)

  // 5. 写入文件
  await writeFile(file_path, newContent)

  return { success: true }
}
```

#### 安全特性
- 要求先 Read 再 Edit（防止盲改）
- old_string 唯一性检查
- 保留原始缩进

---

### 4. Agent — 子 Agent 启动

```typescript
execute: async (input, context) => {
  const { prompt, subagent_type, model, isolation } = input

  // 1. 选择 Agent 类型
  const agentConfig = resolveAgentType(subagent_type)

  // 2. 创建隔离环境（可选）
  let workDir = context.cwd
  if (isolation === 'worktree') {
    workDir = await createGitWorktree()
  }

  // 3. 启动子 Agent
  const agent = await spawnAgent({
    prompt,
    model: model || agentConfig.model,
    tools: agentConfig.tools,
    cwd: workDir,
    parentSessionId: context.sessionId,
  })

  // 4. 等待完成
  const result = await agent.waitForCompletion()

sult
}
```

#### Agent 类型
- `general-purpose` — 通用 Agent
- `Explore` — 代码探索 Agent（只读）
- `Plan` — 计划 Agent（只读）
- `claude-code-guide` — 使用指南 Agent

---

### 5. Glob — 文件模式匹配

```typescript
execute: async (input) => {
  const { pattern, path } = input
  // 使用 fast-glob 进行文件搜索
  const files = await glob(pattern, {
    cwd: path || process.cwd(),
    ignore: ['node_modules/**', '.git/**'],
    onlyFiles: true,
  })
  // 按修改时间排序
  return files.sort((a, b) => b.mtime - a.mtime)
}
```

---

### 6. Grep — 内容搜索

```typescript
exee: async (input) => {
  const { pattern, path, glob: fileGlob, output_mode } = input
  // 使用 ripgrep 进行搜索
  const results = await ripgrep(pattern, {
    path: path || process.cwd(),
    glob: fileGlob,
    maxResults: input.head_limit || 250,
  })

  switch (output_mode) {
    case 'content': return formatContentResults(results)
    case 'files_with_matches': return formatFileResults(results)
    case 'count': return formatCountResults(results)
  }
}
```

---

## 工具注册流程

```typescript
// tools.ts — 工具注册入口
function registerAllTools(): Tool[] {
  return [
    buildBashTool(),
    buildReadTool(),
    buildWriteTool(),
    buiol(),
    buildGlobTool(),
    buildGrepTool(),
    buildAgentTool(),
    buildWebFetchTool(),
    buildWebSearchTool(),
    buildTodoReadTool(),
    buildTodoWriteTool(),
    buildAskUserTool(),
    // ... 更多工具
    // MCP 工具动态注册
    ...await discoverMCPTools(),
  ]
}
```

---

## 设计亮点

1. **Builder 模式**: 统一的工具构建接口，安全默认值
2. **权限分层**: 只读/非破坏性/破坏性三级权限
3. **MCP 扩展**: 通过 MCP 协议动态发现和注册第三方工具
4. **输出控制**: 所有工具输出都有长度限制，防止上下文溢出
5. **沙箱支持**: 工具可在沙箱环境中受限执行
