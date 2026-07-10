# 最终 API 请求与源码索引

这一章回答最具体的问题：Claude Code 最后到底把什么发给模型，Plan Mode 和工具回合在请求中长什么样，以及这条边界在源码哪里。

## 先区分三种形状

| 形状 | 用途 | 是否直接出网 |
|---|---|---|
| 内部 transcript | UI、恢复、进度、附件和 sidechain 的完整事件账本 | 否 |
| 归一化消息 | 已过滤、重排、合并并修复工具配对的 `messages[]` | 作为请求的一部分 |
| Messages API payload | `system`、`messages`、`tools`、模型与控制字段的最终快照 | 是 |

权限规则、Sandbox、读取缓存、任务表、取消器和 UI 状态不会因为影响 Agent 行为，就自动成为 API 顶层字段。

## 最终出网边界在哪里

主查询循环在 `src/query.ts` 维护一次 agentic turn；`src/utils/messages.ts` 投影内部消息，`src/utils/api.ts` 投影 system 与工具；最终请求在 `src/services/api/claude.ts` 汇合。

该文件先形成请求参数，再在流式主路径调用 Anthropic Beta Messages API，并在最后一层加入 `stream: true`。因此：

> **`src/services/api/claude.ts` 中的 `anthropic.beta.messages.create(...)` 是本教程所说的最终 API 调用位置。**

它是逻辑出网边界，不等于永远直连固定域名；Bedrock、Vertex、第一方或其他兼容提供方仍可由客户端配置决定物理传输路径。

## 一份完整请求大致长这样

下面是架构等价的脱敏示意。实际文本、模型名、工具数量、缓存标记和可选字段会随入口、Agent、功能开关和提供方变化。

```json
{
  "model": "当前迭代使用的模型标识",
  "max_tokens": 32000,
  "system": [
    {
      "type": "text",
      "text": "相对稳定的身份、原则与工具使用规则",
      "cache_control": {
        "type": "ephemeral"
      }
    },
    {
      "type": "text",
      "text": "当前工作目录、平台、风格、记忆机制等动态系统上下文"
    }
  ],
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "<system-reminder>当前项目适用的 CLAUDE.md 与日期</system-reminder>"
        },
        {
          "type": "text",
          "text": "用户的真实需求"
        }
      ]
    }
  ],
  "tools": [
    {
      "name": "Read",
      "description": "读取文件",
      "input_schema": {
        "type": "object",
        "properties": {
          "file_path": {
            "type": "string"
          }
        },
        "required": [
          "file_path"
        ]
      }
    },
    {
      "name": "ToolSearch",
      "description": "发现延迟加载的可调用工具",
      "input_schema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string"
          }
        },
        "required": [
          "query"
        ]
      }
    }
  ],
  "thinking": {
    "type": "adaptive"
  },
  "metadata": {
    "user_id": "包含脱敏设备、账户与会话关联信息的序列化字符串"
  },
  "stream": true
}
```

这份示意最重要的不是示例数字，而是四条通道同时存在：`system[]` 放基础与系统上下文，`messages[]` 放时序化对话，`tools[]` 放结构化能力，其他顶层字段控制本次推理与传输。

## 已处于 Plan Mode 时，请求尾部是什么样

如果用户回合开始时已经处于 Plan Mode，运行时会收集 Plan 附件，转成 `<system-reminder>`，再与相邻 `user` 内容归一化。忽略更早历史后，请求尾部大致是：

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "用户的真实需求"
    },
    {
      "type": "text",
      "text": "<system-reminder>Plan Mode 已激活：除计划文件外只读；按理解、设计、复核、定稿、ExitPlanMode 五阶段完成规划</system-reminder>"
    }
  ]
}
```

这正是最容易误解的地方：五阶段 Plan 指令没有替换顶层 `system`，也没有成为一个新的 API role；它仍是 `user.content[]` 中由运行时追加的文本块。

完整提醒不会在每个工具回合重复。后续会按人类回合节流，并在完整与稀疏提醒之间切换；压缩后仍会重建有效的 Plan 状态。

## 模型先调用 EnterPlanMode 时，会多一个工具回合

若当前并不在 Plan Mode，模型先从 `tools[]` 中调用 EnterPlanMode。用户同意后，下一次 API 请求的消息尾部大致如下：

```json
{
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "请先设计一个可靠方案，不要开始实现"
        }
      ]
    },
    {
      "role": "assistant",
      "content": [
        {
          "type": "tool_use",
          "id": "toolu_enter_plan",
          "name": "EnterPlanMode",
          "input": {}
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_enter_plan",
          "content": [
            {
              "type": "text",
              "text": "用户已同意进入 Plan Mode"
            },
            {
              "type": "text",
              "text": "<system-reminder>Plan Mode 已激活及五阶段规划指令</system-reminder>"
            }
          ]
        }
      ]
    }
  ]
}
```

Plan 附件在工具批次完成后出现。消息归一化可以把 reminder 折入最后一个 `tool_result.content`，也可以在保持合法配对的前提下作为同一 `user` 消息的相邻文本块；具体表示取决于当时消息形状，语义边界相同。

## 普通工具调用如何形成下一次请求

以 Read 为例，模型先产生结构化意图，本地读取文件，再把结果作为 `user` 角色的 `tool_result` 回填：

```json
{
  "messages": [
    {
      "role": "assistant",
      "content": [
        {
          "type": "text",
          "text": "我先读取架构入口。"
        },
        {
          "type": "tool_use",
          "id": "toolu_read_arch",
          "name": "Read",
          "input": {
            "file_path": "/项目/ARCHITECTURE.md"
          }
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "tool_result",
          "tool_use_id": "toolu_read_arch",
          "content": "文件内容或经过预算处理后的读取结果"
        }
      ]
    }
  ]
}
```

下一轮是否继续不靠“看起来像工具调用”的文本，而是靠真实 `tool_use` 内容块。权限拒绝、输入错误、取消和执行异常也应形成对应的错误 `tool_result`，以保持协议闭环。

## 哪些顶层字段是条件出现的

| 字段 | 何时出现或变化 |
|---|---|
| `tool_choice` | 宿主需要限制或指定工具选择时 |
| `betas` | 当前提供方和功能需要相应实验能力时 |
| `temperature` | 思考关闭时可显式设置；思考开启时遵循 API 约束 |
| `context_management` | 上下文管理能力、beta 和当前策略同时满足时 |
| `output_config` | 推理力度、任务 Token 预算或结构化输出启用时 |
| `speed` | 快速模式当前可用、受支持且未处于冷却时 |

请求级重试可以重新计算模型、最大输出、快速模式等动态字段，但不会因此丢弃上层 Agent 回合状态。

## 全书源码证据索引

| 章节 | 核心证据 |
|---|---|
| 01 总体架构 | `src/main.tsx`、`src/screens/REPL.tsx`、`src/query.ts` |
| 02 Agent 生命周期 | `src/bootstrap/`、`src/query.ts`、`src/services/tools/` |
| 03 Agent 构造 | `src/tools/AgentTool/runAgent.ts`、`src/utils/forkedAgent.ts` |
| 04 系统 Prompt | `src/utils/systemPrompt.ts`、`src/constants/prompts.ts`、`src/utils/api.ts` |
| 05 上下文编译 | `src/context.ts`、`src/utils/attachments.ts`、`src/utils/messages.ts` |
| 06 工具能力图 | `src/tools.ts`、`src/tools/AgentTool/agentToolUtils.ts`、`src/utils/toolSearch.ts` |
| 07 状态模型 | `src/bootstrap/state.ts`、`src/utils/agentContext.ts`、`src/utils/cwd.ts` |
| 08 主查询循环 | `src/query.ts`、`src/QueryEngine.ts` |
| 09 API 请求编译 | `src/services/api/claude.ts`、`src/utils/api.ts` |
| 10 工具回合 | `src/services/tools/toolExecution.ts`、`src/services/tools/StreamingToolExecutor.ts` |
| 11 并行与取消 | `src/services/tools/toolOrchestration.ts`、`src/utils/abortController.ts` |
| 12 错误恢复 | `src/services/api/withRetry.ts`、`src/services/api/errors.ts`、`src/query.ts` |
| 13 压缩 | `src/services/compact/`、`src/utils/messages.ts` |
| 14 内置工具 | `src/tools.ts`、`src/tools/`、`src/constants/tools.ts` |
| 15 搜索体系 | `src/tools/GlobTool/`、`src/tools/GrepTool/`、`src/tools/ToolSearchTool/`、`src/services/mcp/` |
| 16 扩展系统 | `src/commands/`、`src/skills/`、`src/plugins/`、`src/services/mcp/`、`src/hooks/` |
| 17 Memory | `src/utils/claudemd.ts`、`src/memdir/`、`src/services/SessionMemory/` |
| 18 安全边界 | `src/utils/permissions/`、`src/utils/sandbox/`、`src/utils/worktree.ts` |
| 19 Subagent 构造 | `src/tools/AgentTool/`、`src/tasks/LocalAgentTask/` |
| 20 多代理协作 | `src/utils/swarm/`、`src/utils/tasks.ts`、`src/utils/teammateMailbox.ts` |
| 21 共享与隔离 | `src/utils/forkedAgent.ts`、`src/utils/cwd.ts`、`src/utils/sessionStorage.ts` |
| 22 精妙设计 | `src/query.ts`、`src/services/api/claude.ts`、`src/tools/AgentTool/` |
| 23 最终 API | `src/services/api/claude.ts`、`src/utils/messages.ts`、`src/utils/api.ts` |

## 最后用一句话收束

Claude Code 每轮真正发出的不是“用户问题 + 一段大 Prompt”，而是：

> **经过当前 Agent 身份、上下文编译、能力裁剪、缓存策略和恢复状态共同生成的一份 Messages API 请求快照。**

模型返回结构化意图，本地运行时执行并观察，再把结果编译进下一份请求；Agent 就在这个闭环中持续运行。

## 源码定位

- 请求状态来源：`src/query.ts`
- 消息归一化：`src/utils/messages.ts`
- system 与工具投影：`src/utils/api.ts`
- 最终参数与 Messages API 调用：`src/services/api/claude.ts`
- Plan Mode 附件和五阶段提醒：`src/utils/attachments.ts`、`src/utils/messages.ts`
