# Claude Code Agent Architecture Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Claude Code 架构速览重塑为 23 章、可系统学习的 Agent 架构教程。

**Architecture:** 教程使用“Agent 如何被构造”和“Agent 如何运行”两条主线，再将能力、安全、记忆和多代理放回主线中解释。每个结论都以 `/Users/niuzj/Desktop/claude-code-src/src` 为证据，正文只讲架构、协议、状态、生命周期和设计取舍。

**Tech Stack:** mdBook、Markdown、Mermaid、JSON、ripgrep、jq

## Global Constraints

- 全文使用中文；英文只保留源码中的正式概念名和 API 字段名。
- 只讲架构、协议、生命周期、状态和边界，不展开函数、类、分支逻辑或 TypeScript 实现。
- JSON 仅用于展示最终 API 协议；Mermaid 仅用于展示层次、时序和状态转换。
- 存在功能开关、平台限制、模型差异或内部构建限制时，必须标记“条件启用”。
- 必须区分模型实际看到的 API 请求、Claude Code 内部消息与本地执行状态。
- 每章至少说清解决的问题、架构位置、输入输出、生命周期、精妙设计与边界误解中的相关项。
- 正文不做源码目录导览；源码路径只作为章末证据。

---

### Task 1: 重建目录与教学约定

**Files:**
- Modify: `README.md`
- Modify: `book/SUMMARY.md`
- Modify: `book/00-导读.md`
- Delete: 被新目录替代且不再复用的现有短章

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-07-10-claude-code-agent-architecture-tutorial-design.md`
- Produces: 23 章的唯一目录、统一阅读方法和后续任务使用的文件名

- [ ] **Step 1: 写出 23 章完整 SUMMARY**

  文件名固定为 `01-总体架构.md`、`02-Agent生命周期.md`、`03-Agent构造.md`、`04-系统Prompt.md`、`05-上下文编译.md`、`06-工具能力图.md`、`07-状态模型.md`、`08-主查询循环.md`、`09-API请求编译.md`、`10-流式响应与工具回合.md`、`11-并行取消与终止.md`、`12-错误恢复.md`、`13-上下文预算与压缩.md`、`14-内置工具.md`、`15-搜索与ToolSearch.md`、`16-扩展系统.md`、`17-Memory.md`、`18-安全边界.md`、`19-Subagent构造.md`、`20-多代理协作.md`、`21-共享与隔离.md`、`22-精妙设计.md`、`23-最终API与源码索引.md`。

- [ ] **Step 2: 重写导读和 README**

  明确“构造主线 + 运行主线”、阅读顺序、不讲代码实现的边界，以及“源码存在 ≠ 每次运行启用”。

- [ ] **Step 3: 验证目录完整性**

  Run: `test "$(rg -c '^- \\[' book/SUMMARY.md)" -eq 24`
  Expected: exit 0，包含导读和 23 章。

- [ ] **Step 4: 提交目录和旧结构清理**

  Run: `git add -u && git add README.md book.toml book/SUMMARY.md book/00-导读.md && git commit -m "docs: establish agent architecture learning path"`
  Expected: 提交只包含入口文件和被新结构取代的旧页面。

### Task 2: 写作“系统模型”与“Agent 构造”

**Files:**
- Create/Modify: `book/01-总体架构.md`
- Create: `book/02-Agent生命周期.md`
- Create: `book/03-Agent构造.md`
- Create: `book/04-系统Prompt.md`
- Create: `book/05-上下文编译.md`
- Create: `book/06-工具能力图.md`
- Create: `book/07-状态模型.md`

**Interfaces:**
- Consumes: `src/constants/prompts.ts`、`src/utils/systemPrompt.ts`、`src/context.ts`、`src/utils/attachments.ts`、`src/utils/messages.ts`、`src/tools.ts`、`src/state/`
- Produces: 后续主循环、安全和多代理章节共用的 Agent 构造模型

- [ ] **Step 1: 写四个运行平面和 Agent 生命周期**

  四个平面为控制面、模型面、执行面、持久化面；生命周期覆盖启动、构造、回合、工具、恢复、结束。

- [ ] **Step 2: 写 Agent 构造公式和 Prompt 分层**

  明确 Agent = 身份 + 指令 + 上下文 + 能力 + 模型策略 + 权限 + 可变状态；解释 system 选择优先级和稳定／动态缓存边界。

- [ ] **Step 3: 写上下文编译管线**

  从用户原话、CLAUDE.md、日期、Git、Plan、Skill、Memory、Hook 附件，到归一化后的 `user.content[]`；区分顶层 `system` 和 `<system-reminder>`。

- [ ] **Step 4: 写工具能力图和状态分类**

  工具池覆盖内置、MCP、功能开关、权限否决、Agent 类型和延迟加载六层；状态区分会话、持久、回合、Agent 局部和执行器状态。

- [ ] **Step 5: 验证构造主线**

  Run: `rg -l '精妙|取舍|为什么' book/{01-总体架构,02-Agent生命周期,03-Agent构造,04-系统Prompt,05-上下文编译,06-工具能力图,07-状态模型}.md | wc -l`
  Expected: `7`

- [ ] **Step 6: 提交 Agent 构造主线**

  Run: `git add book/{01-总体架构,02-Agent生命周期,03-Agent构造,04-系统Prompt,05-上下文编译,06-工具能力图,07-状态模型}.md && git commit -m "docs: explain how Claude Code constructs an agent"`
  Expected: 提交包含第 1–7 章。

### Task 3: 写作 Agent 主循环、错误恢复和上下文管理

**Files:**
- Create: `book/08-主查询循环.md`
- Create: `book/09-API请求编译.md`
- Create: `book/10-流式响应与工具回合.md`
- Create: `book/11-并行取消与终止.md`
- Create: `book/12-错误恢复.md`
- Create: `book/13-上下文预算与压缩.md`

**Interfaces:**
- Consumes: `src/query.ts`、`src/services/api/claude.ts`、`src/services/tools/`、`src/services/compact/`、`src/utils/messages.ts`
- Produces: 完整的回合状态机、工具协议和恢复模型

- [ ] **Step 1: 写主查询循环状态图**

  覆盖上下文准备、预压缩、请求编译、流式接收、工具执行、附件追加、继续／终止。

- [ ] **Step 2: 写 API 编译边界**

  说明 `system`、`messages`、`tools`、模型控制字段和本地状态的去向，指向 `src/services/api/claude.ts` 的流式 Messages API 出口。

- [ ] **Step 3: 写工具回合与并行语义**

  区分文本增量、`tool_use`、`tool_result`、进度消息和最终消息；说清工具标识配对、并行运行与有副作用工具的边界。

- [ ] **Step 4: 写中断、错误分类与恢复**

  分开用户中断、输入过长、媒体过大、限流、传输失败、模型不可用、Hook 阻止和工具失败，说明哪些重试、压缩、降级或终止。

- [ ] **Step 5: 写分层上下文管理**

  包含读取／搜索结果清理、微压缩、自动完整压缩、响应式压缩、压缩后指令／Skill／Plan 重建，以及 Prompt 缓存与压缩的关系。

- [ ] **Step 6: 验证运行主线关键词**

  Run: `rg -q 'tool_use.*tool_result|tool_result.*tool_use' book/10-流式响应与工具回合.md && rg -q '微压缩' book/13-上下文预算与压缩.md && rg -q '模型降级' book/12-错误恢复.md`
  Expected: exit 0.

- [ ] **Step 7: 提交 Agent 运行主线**

  Run: `git add book/{08-主查询循环,09-API请求编译,10-流式响应与工具回合,11-并行取消与终止,12-错误恢复,13-上下文预算与压缩}.md && git commit -m "docs: explain the agent runtime loop"`
  Expected: 提交包含第 8–13 章。

### Task 4: 写作能力、搜索、扩展、记忆与安全

**Files:**
- Create/Modify: `book/14-内置工具.md`
- Create: `book/15-搜索与ToolSearch.md`
- Create: `book/16-扩展系统.md`
- Create: `book/17-Memory.md`
- Create: `book/18-安全边界.md`

**Interfaces:**
- Consumes: `src/tools.ts`、`src/tools/*`、`src/skills/`、`src/plugins/`、`src/services/mcp/`、`src/memdir/`、`src/services/SessionMemory/`、`src/utils/permissions/`、`src/utils/sandbox/`
- Produces: 完整的能力分类、扩展链和安全决策链

- [ ] **Step 1: 核对并逐个介绍所有内置工具**

  表格必须包含文件、Shell、搜索、网络、对话、计划、Skill、任务、多代理、调度、MCP、Worktree、结构化输出、条件工具和测试工具。

- [ ] **Step 2: 写五类搜索的不同目标**

  Glob 找路径，Grep 找内容，WebSearch 找外部网页，ToolSearch 找可调用能力，MCP Resources 找服务器暴露的资源。

- [ ] **Step 3: 写扩展系统的职责边界**

  比较命令入口、Skill 工作流 Prompt、Tool 结构化动作、Plugin 分发单元、MCP 远程能力协议、Hook 本地生命周期拦截器。

- [ ] **Step 4: 写四类 Memory 和压缩关系**

  区分 CLAUDE.md、自动 Memory、Agent Memory、Session Memory 以及原始会话记录，明确它们的写入者、读取时机、作用域与生命周期。

- [ ] **Step 5: 写安全四层链路**

  工具是否可见 → 参数是否被权限允许 → 命令是否被操作系统沙盒限制 → 文件进入主工作区还是 Worktree。

- [ ] **Step 6: 验证工具和安全覆盖**

  Run: `tools=(Agent AskUserQuestion Bash SendUserMessage Config EnterPlanMode EnterWorktree ExitPlanMode ExitWorktree Edit Read Write Glob Grep LSP ListMcpResourcesTool NotebookEdit PowerShell REPL ReadMcpResourceTool RemoteTrigger CronCreate CronDelete CronList SendMessage Skill Sleep StructuredOutput TaskCreate TaskGet TaskList TaskOutput TaskStop TaskUpdate TeamCreate TeamDelete TodoWrite ToolSearch WebFetch WebSearch); for tool in "${tools[@]}"; do rg -q "$tool" book/14-内置工具.md; done; for boundary in '工具可见' '权限' 'Sandbox' 'Worktree'; do rg -q "$boundary" book/18-安全边界.md; done`
  Expected: 所有检查 exit 0.

- [ ] **Step 7: 提交能力、扩展、记忆与安全章节**

  Run: `git add book/{14-内置工具,15-搜索与ToolSearch,16-扩展系统,17-Memory,18-安全边界}.md && git commit -m "docs: explain capabilities memory and safety"`
  Expected: 提交包含第 14–18 章。

### Task 5: 写作 Subagent 与多代理拓扑

**Files:**
- Create: `book/19-Subagent构造.md`
- Create: `book/20-多代理协作.md`
- Create: `book/21-共享与隔离.md`

**Interfaces:**
- Consumes: `src/tools/AgentTool/`、`src/tasks/`、`src/tools/SendMessageTool/`、`src/tools/TeamCreateTool/`、`src/tools/EnterWorktreeTool/`、`src/utils/forkedAgent.ts`
- Produces: 普通 Subagent、同步／后台、Fork、Team 和 Worktree 的统一比较模型

- [ ] **Step 1: 写普通 Subagent 构造过程**

  从 Agent 类型选择、委派 Prompt、独立 system、工具重新裁剪、独立查询链、结果回传到清理 Agent 局部状态。

- [ ] **Step 2: 写多代理模式的不同问题域**

  同步 Subagent 解决当前回合委派，后台 Agent 解决时间解耦，Fork 解决请求前缀复用，Team 解决任务和消息协作，Worktree 解决文件冲突。

- [ ] **Step 3: 写完整共享／隔离矩阵**

  行包含文件系统、工作目录、环境变量、API 配置、系统 Prompt、主对话、工具池、权限硬约束、可变状态、取消信号、Skill 状态、读取缓存、任务列表、邮箱和会话记录；列包含主 Agent、普通同步 Subagent、后台 Subagent、Fork、Team 队友和 Worktree Agent。

- [ ] **Step 4: 验证隔离结论**

  Run: `rg -q '不共享主对话' book/19-Subagent构造.md && rg -q '可变状态' book/21-共享与隔离.md && rg -q 'Worktree' book/20-多代理协作.md`
  Expected: exit 0.

- [ ] **Step 5: 提交多代理章节**

  Run: `git add book/{19-Subagent构造,20-多代理协作,21-共享与隔离}.md && git commit -m "docs: explain subagents and multi-agent boundaries"`
  Expected: 提交包含第 19–21 章。

### Task 6: 归纳精妙设计并重建最终 API 案例

**Files:**
- Create: `book/22-精妙设计.md`
- Create/Modify: `book/23-最终API与源码索引.md`

**Interfaces:**
- Consumes: Tasks 2–5 的架构结论，`src/services/api/claude.ts`、`src/query.ts`、`src/utils/messages.ts`
- Produces: 可迁移设计清单、最终 API 请求和全书源码证据索引

- [ ] **Step 1: 归纳至少十个可迁移设计**

  必须包含稳定／动态 Prompt 分离、上下文编译、能力裁剪、渐进式工具发现、本地策略硬边界、工具协议回路、分层压缩、错误分流、最小共享多代理和源码能力／运行时能力区分。

- [ ] **Step 2: 写完整顶层 API 请求**

  JSON 包含 `model`、`max_tokens`、`system`、`messages`、`tools`、`thinking`、`metadata`、`stream`；文字说明可选 `tool_choice`、`betas`、`temperature`、`context_management`、`output_config`、`speed`。

- [ ] **Step 3: 写 Plan Mode 与普通工具的消息回合**

  分别展示已处于 Plan Mode、模型调用 EnterPlanMode、普通 `tool_use` 后回填 `tool_result` 三种形态。

- [ ] **Step 4: 建立全书证据索引**

  每章至少对应一组源码路径；路径必须在 `/Users/niuzj/Desktop/claude-code-src/src` 中存在。

- [ ] **Step 5: 校验全部 JSON**

  Run: `tmp=$(mktemp -d); awk -v out="$tmp" '/^```json$/{inside=1;n++;file=sprintf("%s/%d.json",out,n);next} /^```$/{if(inside){inside=0;close(file)};next} inside{print > file}' book/23-最终API与源码索引.md; test "$(find "$tmp" -name '*.json' | wc -l | tr -d ' ')" -ge 3; for file in "$tmp"/*.json; do jq empty "$file"; done; rm -rf "$tmp"`
  Expected: 每个 JSON exit 0.

- [ ] **Step 6: 提交归纳和 API 章节**

  Run: `git add book/{22-精妙设计,23-最终API与源码索引}.md && git commit -m "docs: synthesize architecture and API boundaries"`
  Expected: 提交包含第 22–23 章。

### Task 7: 全书整合、源码复核与构建验收

**Files:**
- Modify: `book/*.md`
- Modify if needed: `book.toml`
- Generated: `docs/*.html`

**Interfaces:**
- Consumes: Tasks 1–6 的所有章节
- Produces: 统一术语、无重复矛盾、可构建的最终教程

- [ ] **Step 1: 逐章对照设计和源码证据**

  检查 23 章都有明确责任，没有把内部构建、功能开关或平台限制写成普遍事实。

- [ ] **Step 2: 统一术语与交叉引用**

  固定使用“主 Agent”、“普通 Subagent”、“Fork”、“后台 Agent”、“Agent Team”、“Worktree”；去掉跨章重复的长段落。

- [ ] **Step 3: 运行静态验收**

  Run: `test "$(rg -c '^- \\[' book/SUMMARY.md)" -eq 24; while IFS= read -r page; do test -f "book/${page#./}"; done < <(rg -o '\\./[^)]*\\.md' book/SUMMARY.md); ! rg -n '^```(ts|typescript|js|javascript|tsx|jsx|bash|shell)$' README.md book --glob '*.md'; rg -q '普通 Subagent' book/21-共享与隔离.md; rg -q 'Fork' book/21-共享与隔离.md; git diff --check`
  Expected: 所有检查 exit 0.

- [ ] **Step 4: 运行 mdBook 构建**

  Run: `/opt/homebrew/bin/mdbook build`
  Expected: exit 0，`docs/index.html` 和 `docs/23-最终API与源码索引.html` 存在。

- [ ] **Step 5: 检查生成结果**

  Run: `rg -q '<pre class="mermaid">' docs/01-总体架构.html; rg -q 'Agent 构造' docs/03-Agent构造.html; rg -q 'ToolSearch' docs/15-搜索与ToolSearch.html; rg -q '共享与隔离' docs/21-共享与隔离.html; rg -q '最终 API' docs/23-最终API与源码索引.html`
  Expected: 所有关键内容均能在构建产物中找到。

- [ ] **Step 6: 提交整合修正**

  Run: `git add README.md book.toml book && git commit -m "docs: finalize Claude Code agent architecture tutorial"`
  Expected: 若整合审校有修正则生成提交；若无修正则 Git 明确报告无可提交内容。
