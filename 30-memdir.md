# 30 - memdir 模块源码分析

> 路径: `src/memdir/`
> 文件数: 8 个
> 功能: 自动记忆系统 — 跨会话的持久化记忆，支持私有记忆和团队记忆

---

## 模块概述

`memdir/` 实现了 Claude Code 的自动记忆系统，允许 AI 在会话间保持对用户偏好、项目上下文和反馈的记忆。记忆存储在 `~/.claude/projects/<project>/memory/` 目录中。支持双作用域架构（私有 + 团队），AI 驱动的相关记忆检索，以及多层安全防护。

---

## 文件详解

### 1. paths.ts — 路径管理与特性开关

**行数**: 279 行

#### 导出
- `isAutoMemoryEnabled()` — 检查自动记忆是否启用
- `isExtractModeActive()` — 检查后台提取 Agent 是否激活
- `getMemoryBaseDir()` — 获取记忆基础目录
- `getAutoMemPath()` — 获取自动记忆目录路径（memoized）
- `getAutoMemDailyLogPath(date?)` — 获取 KAIROS 模式的每日日志路径
- `getAutoMemEntrypoint()` — 获取 MEMORY.md 路径
- `isAutoMemPath(absolutePath)` — 检查路径是否在记忆目录内
- `hasAutoMemPathOverride()` — 检查 Cowork 覆盖是否设置

#### 启用优先级链（5 级）

```
1. 环境变量 CLAUDE_CODE_DISABLE_AUTO_MEMORY
2. SIMPLE 模式检查
3. CCR 远程环境检查
4. settings.json 中的 autoMemory 设置
5. 默认值: true
```

#### 路径解析优先级

```
1. CLAUDE_COWORK_MEMORY_PATH_OVERRIDE 环境变量
2. settings.json 中的 autoMemoryDirectory 设置（支持 ~/ 展开）
3. 计算路径: baseDir + sanitized(git root)
```

#### 安全验证

```typescript
function validateMemoryPath(path: string): void {
  // 拒绝: 相对路径、根路径、UNC 路径、null 字节
  if (path.includes('\0')) throw new Error('Null byte in path')
  if (!isAbsolute(path)) throw new Error('Relative path')
  if (path === '/') throw new Error('Root path')
  // ...
}
```

#### 设计亮点
- Worktree 共享: 使用 canonical git root，所以 worktree 共享同一份记忆
- 安全边界: projectSettings 不允许设置路径覆盖（防止恶意项目配置）

---

### 2. memoryTypes.ts — 记忆类型分类学

**行数**: 272 行

#### 四种记忆类型

| 类型 | 作用域 | 说明 | 示例 |
|------|--------|------|------|
| `user` | 始终私有 | 用户角色、偏好、知识 | "用户是高级 Go 开发者，React 新手" |
| `feedback` | 默认私有 | 用户对工作方式的反馈 | "不要在回复末尾总结" |
| `project` | 偏向团队 | 项目进展、目标、截止日期 | "3月5日起冻结非关键合并" |
| `reference` | 通常团队 | 外部系统资源指针 | "Bug 追踪在 Linear INGEST 项目" |

#### 不应保存的内容
- 代码模式/架构（可从代码推导）
- Git 历史（git log 可查）
- 调试解决方案（修复在代码中）
- CLAUDE.md 中已有的内容
- 临时任务详情

#### 导出的提示词模板
- `TYPES_SECTION_COMBINED` — 带 `<scope>` 标签的双目录版本
- `TYPES_SECTION_INDIVIDUAL` — 单目录版本
- `WHAT_NOT_TO_SAVE_SECTION` — 排除指导
- `MEMORY_DRIFT_CAVEAT` — 过期警告文本
- `WHEN_TO_ACCESS_SECTION` — 访问时机指导
- `TRUSTING_RECALL_SECTION` — 召回信任指导
- `MEMORY_FRONTMATTER_EXAMPLE` — frontmatter 格式示例

---

### 3. memdir.ts — 记忆系统主编排器

**行数**: 508 行

#### 导出
- `ENTRYPOINT_NAME = 'MEMORY.md'`
- `MAX_ENTRYPOINT_LINES = 200`
- `MAX_ENTRYPOINT_BYTES = 25600` (25KB)
- `truncateEntrypointContent()` — 强制大小限制
- `ensureMemoryDirExists()` — 创建目录结构
- `buildMemoryLines()` — 构建提示词行
- `buildMemoryPrompt()` — 构建完整提示词
- `loadMemoryPrompt()` — 主入口，按特性分发

#### 特性分发逻辑

```
loadMemoryPrompt()
  ├── KAIROS 模式? → 每日追加日志模式
  ├── TEAMMEM 启用? → 双目录联合提示词
  └── 默认 → 单目录个人提示词
```

#### MEMORY.md 截断

```typescript
function truncateEntrypointContent(content: string, filePath: string) {
  // 强制 200 行 AND 25KB 上限
  // 超出时添加警告横幅
  ifth > MAX_ENTRYPOINT_LINES) {
    return {
      content: lines.slice(0, MAX_ENTRYPOINT_LINES).join('\n'),
      truncation: { originalLines: lines.length, keptLines: MAX_ENTRYPOINT_LINES }
    }
  }
}
```

#### 遥测日志
- `memory_directory_used` — 记忆目录被使用
- `memory_directory_created` — 记忆目录被创建
- `memory_entrypoint_truncated` — MEMORY.md 被截断

---

### 4. memoryScan.ts — 记忆目录扫描

**行数**: 95 行

#### 导出
- `MemoryHeader` 类型 — `{ filename, filePath, mtimeMs, description, type }`
- `scanMemoryFiles(memoryDir, signal)` — 扫描记忆文件头
- `formatMemoryManifest(memories)` — 格式化为文本清单

#### 扫描优化

```typescript
async function scanMemoryFiles(memoryDir: string): Promise<MemoryHeader[]> {
  // 递归读取目录
  const entries = await readdir(memoryDir, { recursive: true })

  // 过滤 .md 文件，排除 MEMORY.md
  const mdFiles = entries.filter(e => e.endsWith('.md') && e !== 'MEMORY.md')

  // 只读取每个文件的前 30 行（frontmatter）
  // readFileInRange 内部 stat 返回 mtimeMs，避免二次 stat
  const headers = await Promise.allSettled(
    mdFiles.map(f => readFirstLines(f, 30))
  )

  // 按修改时间降序排序，取前 200 个
  return headers
    .filter(h => h.status === 'fulfilled')
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, 200)
}
```

#### 清单格式
```
- [user] user_role.md (2026-03-15): 数据科学家，关注可观测性
- [feedback] feedback_testing.md (2026-03-10): 集成测试必须用真实数据库
```

---

### 5. findRelevantMemories.ts — AI 驱动的记忆检索

**行数**: 142 行

#### 导出
- `RelevantMemory` 类型 — `{ filePath, mtimeMs }`
- `findRelevantMemories(memoryDir, conversationText, alreadySurfaced, signal)` — 检索相关记忆

#### 核心流程

```
扫描记忆目录 (scanMemoryFiles)
    ↓
过滤已展示的记忆 + 活跃工具的参考文档
    ↓
格式化为文本清单
    ↓
调用 Sonnet 模型 (sideQuery)
    ├── 系统提示: SELECT_MEMORIES_SYSTEM_PROMPT
    ├── 用户消息: 对话文本 + 记忆清单
    └── 输出格式: JSON Schema (最多 5 个文件名)
    ↓
映射文件名回完整路径 + mtime
    ↓
返回 Rey[]
```

#### 错误处理
- 失败时返回空数组（不抛异常）
- 优雅降级，不影响主对话流程

---

### 6. memoryAge.ts — 记忆时效性

**行数**: 54 行

#### 导出
- `memoryAgeDays(mtimeMs)` — 计算天数
- `memoryAge(mtimeMs)` — 人类可读的年龄（"today"/"yesterday"/"N days ago"）
- `memoryFreshnessText(mtimeMs)` — 过期警告文本
- `memoryFreshnessNote(mtimeMs)` — 格式化的过期注释

#### 逻辑
```typescript
// ≤1 天: 无警告
// >1 天: "This memory is from [age] and may be outdated"
// 防止模型将过期的代码引用当作当前事实
```

---

### 7. teamMemPaths.ts — 团队记忆路径（安全加固）

**行数**: 293 行

#### 导出
- `PathTraversalError` — 自定义错误类
- `isTeamMemoryEnabled()` — 团队记忆是否启用
- `getTeamMemPath()` — 团队记忆目录路径
- `validateTeamMemWritePath(filePath)` — 写入路径验证
- `validateTeamMemKey(relativeKey)` — 服务器提供的 key 验证
- `isTeamMemFile(filePath)` — 综合检查

#### 多层安全防护（PSR M22186）

```
第 1 层: 字符串级别
  ├── 拒绝 null 字节
  ├── 拒绝 URL 编码遍历 (%2e%2e%2f)
  ├── 拒绝 Unicode 规范化攻击（全角字符）
  ├── 拒绝反斜杠
  └── 拒绝绝对路径

第 2 层: 符号链接解析
  ├── realpathDeepestExisting() 向上遍历解析
  ├── 检测悬空符号链接 (lstat)
  └── 真实路径包含性检查
```

#### 启用条件
```typescript
function isTeamMemoryEnabled(): boolean {
  return isAutoMemoryEnabled()                    // 自动记忆已启用
    && checkFeatureFlag('tengu_herring_clock')     // 特性标志
}
```

---

### 8. teamMemPrompts.ts — 团队记忆提示词构建

**行数**: 101 行

#### 导出
- `buildCombinedMemoryPrompt()` — 构建双目录联合提示词

#### 提示词结构

```
1. 双目录说明（私有 vs 团队）
2. 作用域指导（私有: 用户特定, 团队: 共享）
3. 类型分类（带 <scope> 标签）
4. 排除指导 + 团队记忆安全警告
5. 保存方法（两步: 写文件 + 更新 MEMORY.md 索引）
6. 访问时机
7. 记忆 vs 其他持久化（计划、任务）
8. 搜索过往上下文（grep 指导）
```

---

## 架构总结

```
memdir/
├── 配置层
│   ├── paths.ts          ← 路径解析 + 特性开关（5 级优先级）
│   └── memoryTypes.ts    ← 类型分类学 + 提示词模板
│
├── 核心层
│   ├── memdir.ts         ← 主编排器（特性分发 + 提示词构建）
│   ├── memoryScan.ts     ← 目录扫描（前 30 行 frontmatter）
│   └── findRelevantMemories.ts ← AI 驱动的相关性检索（Sonnet）
│
├── 安全层
│   ├── teamMemPaths.ts   ← 多层路径遍历防护（PSR M22│   └── memoryAge.ts      ← 时效性警告（防止过期引用）
│
└── 团队层
    └── teamMemPrompts.ts ← 双目录联合提示词构建
```

### 关键设计决策

1. **双作用域**: 私有记忆（用户偏好）和团队记忆（项目知识）分离
2. **AI 检索**: 使用 Sonnet 模型智能选择相关记忆，而非全量加载
3. **安全加固**: 多层路径遍历防护，防止恶意项目配置攻击
4. **Worktree 共享**: 使用 canonical git root，worktree 共享记忆
5. **优雅降级**: 所有错误返回空结果，不影响主流程
6. **大小限制**: MEMORY.md 强制 200 行 / 25KB 上限
