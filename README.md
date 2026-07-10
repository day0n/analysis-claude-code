# Claude Code Agent 架构教程

这是一份基于 Claude Code 源码整理的 Agent 架构教程。它不教你逐行阅读实现，而是帮你建立一个可迁移的 Agent 运行时模型。

全书围绕两条主线：

1. **Agent 如何被构造**：身份、Prompt、上下文、工具、模型策略、权限和可变状态怎样组成一个 Agent。
2. **Agent 如何运行**：用户输入怎样经过上下文编译、API 请求、工具回合、错误恢复和压缩，直到任务结束。

在这两条主线上，教程会继续解释 Tools、ToolSearch、Skills、MCP、Hooks、Memory、Plan Mode、Sandbox、Subagent、Fork、Agent Team 和 Worktree。

在线阅读：[Claude Code Agent 架构教程](https://day0n.github.io/analysis-claude-code/)

## 教程边界

- 讲架构位置、协议、状态、生命周期和设计取舍。
- 不讲函数、类、分支逻辑和 TypeScript 实现。
- API JSON 用来展示真正发给模型的结构，不是伪代码。
- 每个重要结论都对应 `/Users/niuzj/Desktop/claude-code-src/src` 中的源码区域。
- 对功能开关、平台、模型或内部构建限制下的能力，会明确标记“条件启用”。

请从[导读](book/00-导读.md)开始。
