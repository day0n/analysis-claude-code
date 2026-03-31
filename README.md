# Claude Code 源码深度解析

> 基于 Claude Code CLI 泄露源码的逆向分析，覆盖全部 1884 个 TypeScript 文件、35+ 模块的完整架构解读。

## 在线阅读

📖 **[点击在线阅读](https://day0n.github.io/analysis-claude-code/)**

## 项目背景

2025 年 6 月，Claude Code CLI 的完整源码被泄露。本项目对其进行了系统性的逆向分析，逐模块拆解架构设计、核心算法和实现细节。

所有功能描述均经过与真实源码的逐行核对，确保准确性。

## 项目结构

```
├── 00-项目总览        总体架构 & 模块索引
├── 01-根级文件        src/ 根级核心文件 (main.tsx, Tool.ts, Task.ts 等)
├── 02-entrypoints    入口点 (CLI, SDK, MCP Server)
├── 03-bootstrap      启动引导 & 全局状态
├── 04-cli/           CLI 框架 (结构化IO, handlers, transports)
├── 05-commands/      86 个命令完整清单
├── 06-screens        三大屏幕 (REPL, 会话恢复, 诊断)
├── 07-components/    389 UI 组件文件
├── 08-ink/           深度定制的 Ink 终端渲染引擎
├── 09-query          查询主循环 & Token 预算
├── 10-services/      API, 分析, MCP 等 20 个服务子目录
├── 11-tools/         40 个 AI 工具实现
├── 12-skills         技能系统 (bundled + custom)
├── 13-plugins        插件系统
├── 14-hooks          双钩子系统 (React UI hooks + 执行引擎)
├── 15-state          状态管理
├── 16-context        上下文构建
├── 17-constants      常量定义
├── 18-types          类型系统
├── 19-schemas        Zod Schema 验证
├── 20-bridge         IDE 桥接协议
├── 21-coordinator    多实例协调
├── 22-remote         远程会话
├── 23-server         HTTP/WebSocket 服务
├── 24-keybindings    快捷键系统 (17 上下文)
├── 25-vim            Vim 模式
├── 26-voice          语音交互
├── 27-buddy          Buddy 彩蛋
├── 28-utils/         564 工具文件 & 31 子目录
├── 29-native-ts      原生 TS 移植 (yoga-layout, file-index)
├── 30-memdir         记忆目录系统
├── 31-migrations     数据迁移
├── 32-tasks/         5 种任务类型
├── 33-upstreamproxy  上游代理
├── 34-outputStyles   输出样式
└── 35-assistant      会话历史管理
```

## 核心发现

- **自研终端引擎**: Fork 了 Ink 框架，用纯 TS 重写 Yoga 布局，添加完整终端协议栈
- **工具工厂模式**: `buildTool(def)` 工厂函数构建所有 40 个工具，非类继承
- **双钩子架构**: `src/hooks/` (104 React hooks) vs `src/utils/hooks/` (执行引擎，28 种事件)
- **Token 预算**: 收益递减检测 — 连续 2 次 delta < 500 tokens 且续传 ≥ 3 次自动停止
- **5005 行 REPL**: 整个项目最大单文件，管理对话、工具执行、权限、会话全生命周期

## 声明

本项目仅用于技术研究和学习目的。所有分析基于公开泄露的源码，不包含任何非公开信息。
