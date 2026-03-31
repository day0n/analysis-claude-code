# 28 - utils 模块源码分析

> 路径: `src/utils/`
> 根级文件数: 280+ 个 `.ts/.tsx` 文件
> 子目录数: 31 个
> 功能: 工具函数库 — 覆盖项目所有基础设施需求

---

## 模块概述

`utils/` 是 Claude Code 中文件数量最多的模块，包含 280+ 个根级工具文件和 31 个子目录。

---

## 根级核心文件（按功能分类，仅列出已验证存在的文件）

### Shell 与进程

| 文件 | 说明 |
|------|------|
| `Shell.ts` | Shell 抽象层（exec/execStream/which） |
| `ShellCommand.ts` | Shell 命令封装 |
| `execFileNoThrow.ts` | 不抛异常的 execFile |
| `process.ts` | 进程工具 |
| `genericProcessUtils.ts` | 通用进程工具 |
| `gracefulShutdown.ts` | 优雅关闭 |
| `cleanupRegistry.ts` | 清理注册表（进程退出时资源释放） |

### Git 操作

| 文件 | 说明 |
|------|------|
| `git.ts` | Git 核心操作（status/branch/commit 等） |
| `gitDiff.ts` | Git Diff 处理 |
| `gitSettings.ts` | Git 配置 |
| `worktree.ts` | Git Worktree 管理 |
| `getWorktreePaths.ts` | Worktree 路径获取 |
| `detectRepository.ts` | 仓库检测 |
| `ghPrStatus.ts` | GitHub PR 状态 |
| `commitAttribution.ts` | 提交归因 |

### 认证与安全

| 文件 | 说明 |
|------|------|
| `auth.ts` | 认证核心 |
| `authFileDescriptor.ts` | 认证文件描述符 |
| `authPortable.ts` | 可移植认证 |
| `aws.ts` | AWS 集成 |
| `awsAuthStatusManager.ts` | AWS 认证状态 |
| `crypto.ts` | 加密工具 |
| `mtls.ts` | mTLS 配置 |

### 文件操作

| 文件 | 说明 |
|------|------|
| `file.ts` | 文件基础操作 |
| `fileRead.ts` | 文件读取（多格式支持） |
| `fileReadCache.ts` | 文件读取缓存 |
| `fileHistory.ts` | 文件历史追踪 |
| `fileStateCache.ts` | 文件状态缓存 |
| `fileOperationAnalytics.ts` | 文件操作分析 |
| `readFileInRange.ts` | 范围读取 |
| `diff.ts` | 差异计算 |
| `pdf.ts` / `pdfUtils.ts` | PDF 处理 |
| `notebook.ts` | Jupyter Notebook 处理 |

### 会话管理

| 文件 | 说明 |
|------|------|
| `sessionStorage.ts` | 会话持久化 |
| `sessionRestore.ts` | 会话恢复 |
| `sessionState.ts` | 会话状态 |
| `sessionTitle.ts` | 会话标题生成 |
| `sessionStart.ts` | 会话启动 |
| `sessionActivity.ts` | 会话活动追踪 |
| `sessionUrl.ts` | 会话 URL |
| `listSessionsImpl.ts` | 会话列表实现 |
| `crossProjectResume.ts` | 跨项目恢复 |

### Agent 与 AI

| 文件 | 说明 |
|------|------|
| `agentContext.ts` | Agent 上下文 |
| `agentId.ts` | Agent ID 管理 |
| `agenticSessionSearch.ts` | Agent 会话搜索 |
| `teammate.ts` | 队友管理 |
| `teammateContext.ts` | 队友上下文 |
| `teammateMailbox.ts` | 队友邮箱 |
| `sideQuery.ts` | 侧查询（轻量级 LLM 调用） |
| `sideQuestion.ts` | 侧问题 |
| `advisor.ts` | 顾问 |
| `effort.ts` | 推理努力级别 |
| `fastMode.ts` | 快速模式 |

### 消息处理

| 文件 | 说明 |
|------|------|
| `messages.ts` | 消息构建工具 |
| `messagePredicates.ts` | 消息谓词（类型判断） |
| `messageQueueManager.ts` | 消息队列管理 |
| `contentArray.ts` | 内容数组工具 |

### 配置与设置

| 文件 | 说明 |
|------|------|
| `config.ts` | 配置管理 |
| `configConstants.ts` | 配置常量 |
| `envUtils.ts` | 环境变量工具 |
| `claudemd.ts` | CLAUDE.md 处理 |
| `cliArgs.ts` | CLI 参数解析 |

### 钩子系统

| 文件 | 说明 |
|------|------|
| `hooks.ts` | 钩子顶层工具（注意：执行引擎在 `utils/hooks/` 子目录） |

### 格式化与显示

| 文件 | 说明 |
|------|------|
| `format.ts` | 通用格式化 |
| `intl.ts` | 国际化 |
| `markdown.ts` | Markdown 处理 |
| `truncate.ts` | 文本截断 |
| `sliceAnsi.ts` | ANSI 切片 |
| `stringUtils.ts` | 字符串工具 |
| `hyperlink.ts` | 终端超链接 |

### 调试与日志

| 文件 | 说明 |
|------|------|
| `debug.ts` | 调试日志 |
| `debugFilter.ts` | 调试过滤 |
| `diagLogs.ts` | 诊断日志 |
| `log.ts` | 日志 |
| `errors.ts` | 错误处理 |
| `errorLogSink.ts` | 错误日志接收器 |

### Token 与预算

| 文件 | 说明 |
|------|------|
| `tokenBudget.ts` | Token 预算管理 |
| `tokens.ts` | Token 工具 |
| `modelCost.ts` | 模型费用计算 |

### 网络

| 文件 | 说明 |
|------|------|
| `http.ts` | HTTP 请求 |
| `proxy.ts` | 代理配置 |
| `caCerts.ts` | CA 证书 |
| `peerAddress.ts` | 对端地址 |

### 其他重要文件

| 文件 | 说明 |
|------|------|
| `lazySchema.ts` | 懒加载 Schema（打破循环依赖） |
| `memoize.ts` | 缓存/记忆化 |
| `frontmatterParser.ts` | Frontmatter 解析 |
| `uuid.ts` | UUID 生成 |
| `hash.ts` | 哈希计算 |
| `json.ts` | JSON 工具 |
| `sleep.ts` | 延时 |
| `cron.ts` / `cronScheduler.ts` / `cronTasks.ts` | 定时任务 |
| `glob.ts` | Glob 匹配 |
| `ripgrep.ts` | Ripgrep 搜索 |
| `platform.ts` | 平台检测 |
| `terminal.ts` | 终端工具 |
| `theme.ts` | 主题 |
| `zodToJsonSchema.ts` | Zod→JSON Schema 转换 |
| `xml.ts` / `yaml.ts` | XML/YAML 工具 |

---

## 子目录（31 个）

| 目录 | 说明 |
|------|------|
| `hooks/` | **钩子执行引擎**（17 文件：execPromptHook、execHttpHook、execAgentHook 等） |
| `permissions/` | 权限规则引擎 |
| `settings/` | 设置读写（三层合并：user/project/local） |
| `shell/` | Shell 提供者（bash/zsh/fish/powershell） |
| `bash/` | Bash 特定工具 |
| `powershell/` | PowerShell 特定工具 |
| `git/` | Git 扩展操作 |
| `github/` | GitHub API 集成 |
| `model/` | 模型工具（别名解析、能力查询） |
| `mcp/` | MCP 工具 |
| `memory/` | 记忆工具 |
| `messages/` | 消息工具 |
| `skills/` | 技能工具 |
| `plugins/` | 插件工具 |
| `todo/` | 待办列表工具 |
| `task/` | 任务管理工具 |
| `swarm/` | Swarm 模式（多 Agent 协作） |
| `suggestions/` | 提示建议 |
| `ultraplan/` | Ultraplan 工具 |
| `sandbox/` | 沙箱工具 |
| `computerUse/` | 计算机使用工具 |
| `claudeInChrome/` | Chrome 中的 Claude |
| `teleport/` | Teleport API 集成 |
| `secureStorage/` | 安全存储 |
| `filePersistence/` | 文件持久化 |
| `background/` | 后台任务（含 remote/ 子目录） |
| `deepLink/` | 深度链接 |
| `telemetry/` | 遥测工具 |
| `nativeInstaller/` | 原生安装器 |
| `dxt/` | 桌面扩展工具 |
| `processUserInput/` | 用户输入处理 |

---

## 之前文档中不存在的文件（已删除）

以下文件在 `src/utils/` 中**不存在**，之前文档错误列出：
- ~~processManager.ts~~、~~killProcess.ts~~
- ~~gitWorktreeworktree.ts`）、~~gitBlame.ts~~、~~gitLog.ts~~
- ~~fileWrite.ts~~、~~fileDiff.ts~~（实际是 `diff.ts`）
- ~~messageFormat.ts~~、~~messageSearch.ts~~
- ~~permissionRules.ts~~、~~permissionMode.ts~~（在 `utils/permissions/` 子目录中）
- ~~hookRunner.ts~~、~~hookContext.ts~~（在 `utils/hooks/` 子目录中）
- ~~logForDebugging.ts~~（实际是 `debug.ts`）、~~profiling.ts~~
- ~~tokenCount.ts~~、~~tokenEstimate.ts~~（实际是 `tokens.ts`）
- ~~websocket.ts~~、~~retry.ts~~（API 重试在 `services/api/withRetry.ts`）
