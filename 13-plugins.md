# 13 - plugins 模块源码分析

> 路径: `src/plugins/`
> 文件数: 2 个
> 功能: 插件系统 — 内置插件注册与管理

---

## 模块概述

`plugins/` 是一个相对精简的模块，提供内置插件的注册表和初始化入口。插件的安装/卸载等生命周期管理在 `cli/handlers/plugins.ts` 中实现。

---

## 1. builtinPlugins.ts — 内置插件注册表

**行数**: 160 行

### 导出
- `registerBuiltinPlugin(def)` — 注册内置插件
- `getBuiltinPlugins()` — 获取所有内置插件（按用户设置过滤）
- `getBuiltinPluginSkillCommands()` — 获取插件提供的技能命令
- `isBuiltinPluginId(id)` — 检查是否为内置插件 ID
- `clearBuiltinPlugins()` — 清空注册表（测试用）
- `BuiltinPluginDefinition` 类型

### 核心逻辑

```typescript
// 返回 enabled/disabled 两个数组，不是单个过滤后的数组
export function getBuiltinPlugins(): {
  enabled: LoadedPlugin[]
  disabled: LoadedPlugin[]
}
```

内置插件可以携带 `skills`、`hooks`、`mcpServers`，ID 采用 `{name}@builtin` 格式。

---

## 2. bundled/index.ts — 初始化入口

**行数**: 24 行

### 功能
空的初始化函数，作为未来插件系统扩展的占位符。

```typescript
export function initBuiltinPlugins(): void {
  // 未来在此注册内置插件
  // 当前为空实现
}
```

---

## 插件系统全景

虽然 `plugins/` 模块本身很小，但插件系统涉及多个模块的协作：

```
插件系统全景
├── plugins/                    ← 插件注册表（本模块）
│   ├── builtinPlugins.ts       ← 内置插件定义
│   └── bundled/index.ts        ← 初始化入口
│
├── cli/handlers/plugins.ts     ← 插件生命周期管理
│   ├── install / uninstall
│   ├── enable / disable
│   ├── update
│   └── marketplace 操作
│
├── schemas/                    ← 插件配置 Schema
│   └── plugins.ts              ← Zod 验证
│
├── skills/                     ← 插件提供的技能
│   └── loadSkillsDir.ts        ← 从插件目录加载技能
│
└── settings.json               ← 插件启用/禁用配置
    └── disabledPlugins: []
```

### 插件作用域

```
~/.claude/plugins/          ← 用户级插件（全局）
.claude/plugins/            ← 项目级插件
本地路径引用                 ← 本地插件
```
