# 16 - context 模块源码分析

> 路径: `src/context/`
> 文件数: 9 个
> 功能: React Context Provider 集合 — 为 UI 组件提供全局状态注入

---

## 重要说明

`src/context/` 目录包含的是 **React Context Provider**，不是上下文收集系统。上下文收集逻辑在根级文件 `src/context.ts`（189 行）中实现。

---

## 文件清单

| 文件 | 说明 |
|------|------|
| `QueuedMessageContext.tsx` | 排队消息上下文（消息队列管理） |
| `fpsMetrics.tsx` | FPS 指标上下文（帧率追踪） |
| `mailbox.tsx` | 邮箱上下文（Agent 间消息传递） |
| `modalContext.tsx` | 模态框上下文（对话框状态管理） |
| `notifications.tsx` | 通知上下文（系统通知管理） |
| `overlayContext.tsx` | 覆盖层上下文（全屏覆盖状态） |
| `promptOverlayContext.tsx` | 提示覆盖层上下文（输入区域覆盖） |
| `stats.tsx` | 统计上下文（使用统计数据） |
| `voice.tsx` | 语音上下文（语音模式状态） |

---

## 与 src/context.ts 的区别

| | `src/context/` 目录 | `src/context.ts` 根级文件 |
|---|---|---|
| 内容 | React Context Provider | 上下文收集函数 |
| 用途 | UI 组件状态注入 | 收集 git 状态、CLAUDE.md、环境信息 |
| 导出 | React Context + Provider 组件 | `getGitStatus()`, `getSystemContext()`, `getUserContext()` |
| 行数 | 9 个文件 | 189 行 |

---

## src/context.ts — 上下文收集（189 行）

根级文件 `src/context.ts` 负责收集对话所需的上下文信息：

### 导出
- `getGitStatus()` — 收集 git 状态（memoized）
- `getSystemContext()` — 收集系统上下文（memoized）
- `getUserContext()` — 收集用户上下文（memoized）
- `setSystemPromptInjection()` — 设置缓存破坏注入（调试用）

### 收集内容
1. **Git 状态**: 分支名、工作区状态（截断到 2000 字符）、最近提交、用户信息
2. **CLAUDE.md 文件**: 从项目目录树中发现并加载所有 CLAUDE.md 文件
3. **环境信息**: 平台、Shell、OS 版本、工作目录

### 特性
- Memoized 缓存，避免重复收集
- 支持 bare mode（最小上下文）
- 支持显式添加额外目录
- 诊断日志带 PII 过滤
