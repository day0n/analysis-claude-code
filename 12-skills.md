# 12 - skills 模块源码分析

> 路径: `src/skills/`
> 文件数: 20 个
> 功能: 技能系统 — 可扩展的斜杠命令（/batch, /simplify, /debug 等）

注意：`/commit` 和 `/review` 不是 bundled skill，而是 `src/commands/` 中的独立命令。

---

## 模块概述

`skills/` 实现了 Claude Code 的技能系统，即用户通过 `/命令名` 调用的预定义工作流。技能可以来自内置捆绑、用户自定义目录、插件或 MCP 提供者。

---

## 核心基础设施

### 1. bundledSkills.ts — 内置技能注册表

**行数**: 221 行

#### 功能概述
内置技能的核心注册表，管理随 CLI 一起发布的技能。

#### 导出
- `registerBundledSkill(def)` — 注册内置技能
- `getBundledSkills()` — 获取所有内置技能
- `clearBundledSkills()` — 清空（测试用）
- `getBundledSkillExtractDir()` — 获取技能文件提取目录
- `BundledSkillDefinition` 类型

#### 注册流程

```typescript
// 源码 src/skills/bundledSkills.ts:15-40
export type BundledSkillDefinition = {
  name: string
  description: string
  aliases?: string[]
  whenToUse?: string
  argumentHint?: string
  allowedTools?: string[]
  model?: string
  disableModelInvocation?: boolean
  userInvocable?: boolean
  isEnabled?: () => boolean
  hooks?: HooksSettings
  context?: 'inline' | 'fork'
  agent?: string
  files?: Record<string, string>  // 参考文件（懒提取到磁盘）
  getPromptForCommand: (args: string, context: ToolUseContext) => Promise<ContentBlockParam[]>
}
```

#### 安全文件提取

```typescript
// 懒提取技能文件到临时目录
// 使用 O_NOFOLLOW | O_EXCL 防止符号链接攻击
// Memoize 提取 Promise 避免重复提取
async function extractSkillFile(relativePath: string): Promise<string> {
  const targetPath = join(extractDir, relativePath)
  // 验证相对路径防止目录遍历
  if (relativePath.includes('..')) throw new Error('Path traversal detected')
  const fd = await open(targetPath, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW)
  // ...
}
```

---

### 2. loadSkillsDir.ts — 技能目录发现与加载

**行数**: 1087 行（最大的技能文件）

#### 功能概述
从 `.skills/` 目录发现和加载用户自定义技能，解析 SKILL.md frontmatter，创建 Command 对象。

#### 导出
- `getSkillDirCommands()` — 获取目录技能命令
- `loadSkillsFromSkillsDir()` — 从目录加载技能
- `createSkillCommand()` — 创建技能命令
- `parseSkillFrontmatterFields()` — 解析 frontmatter
- `discoverSkillDirsForPaths()` — 发现技能目录
- `addSkillDirectories()` — 添加技能目录
- `activateConditionalSkillsForPaths()` — 激活条件技能
- `getDynamicSkills()` — 获取动态技能
- `clearSkillCaches()` — 清空缓存

#### SKILL.md 格式

```markdown
---
name: my-skill
description: 我的自定义技能
model: claude-sonnet-4-6
allowed-tools: [Bash, Read, Write]
user-invocable: true
condition: "src/**/*.ts"
---

这里是技能的提示词内容...
```

#### 发现流程

```
项目根目录
  ├── .skills/           ← 项目级技能
  │   ├── commit/
  │   │   └── SKILL.md
  │   └── review/
  │       └── SKILL.md
  │
  ├── ~/.claude/skills/  ← 用户级技能
  │   └── my-skill/
  │       └── SKILL.md
  │
  └── 插件提供的技能目录
```

#### 条件技能

```typescript
// 条件技能只在匹配的文件路径下激活
// 使用 minimatch 进行 glob 匹配
activateConditionalSkillsForPaths(paths: string[]) {
  for (const skill of conditionalSkills) {
    if (paths.some(p => minimatch(p, skill.condition))) {
      activateSkill(skill)
    }
  }
}
```

#### 去重机制
- 使用 `realpath()` 解析符号链接后去重
- 缓存已发现的技能目录
- 遵守 `.gitignore` 规则过滤

---

### 3. mcpSkillBuilders.ts — MCP 技能构建器注入

**行数**: 45 行

#### 功能概述
依赖注入注册表，打破 MCP 技能发现与技能加载之间的循环依赖。

```typescript
type MCPSkillBuilders = {
  createSkillCommand: typeof createSkillCommand
  parseSkillFrontmatterFields: typeof parseSkillFrontmatterFields
}

// 写入一次，之后只读
let builders: MCPSkillBuilders | undefined

function registerMCPSkillBuilders(b: MillBuilders): void {
  builders = b
}

function getMCPSkillBuilders(): MCPSkillBuilders {
  if (!builders) throw new Error('MCP skill builders not registered')
  return builders
}
```

---

## 内置技能详解

### 4. bundled/index.ts — 初始化入口

**行数**: 80 行

调用所有内置技能的注册函数：

```typescript
function initBundledSkills(): void {
  registerClaudeApiSkill()
  registerBatchSkill()
  registerDebugSkill()
  registerSimplifySkill()
  registerKeybindingsSkill()
  registerRememberSkill()
  registerUpdateConfigSkill()
  registerSkillifySkill()
  registerVerifySkill()
  registerStuckSkill()
  registerLoremIpsumSkill()
  registerClaudeInChromeSkill()
  // ... 受 feature flag 控制的技能
}
```

---

### 5. bundled/batch.ts — 批量并行执行

**行数**: 125 行

#### 功能
编排大规模并行代码变更，在隔离的 git worktree 中生成 5-30 个 Agent。

#### 工作流

```
/batch "将所有 console.log 替换为 logger.info"
  ↓
分析变更范围
  ↓
创建 5-30 个 git worktree
  ↓
每个 worktree 中启动独立 Agent
  ↓
Agent 并行执行变更
  ↓
收集结果，合并到主分支
```

---

### 6. bundled/claudeApi.ts — Claude API 开发辅助

**行数**: 197 行

#### 功能
帮助用户构建使用 Claude API 的应用，自动检测项目语言并提供对应示例。

```typescript
function registerClaudeApiSkill(): void {
  // 检测项目语言
  const language = detectProjectLanguage() // TypeScript | Python | other

  // 懒加载 247KB 文档包
  const docs = await loadDocBundle(language)

  registerBundledSkill({
    name: 'claude-api',
    description: 'Build apps with the Claude API',
    prompt: SKILL_PROMPT,
    referenceFiles: SKILL_FILES[language],
  })
}
```

---

### 7. bundled/simplify.ts — 代码审查与简化

**行数**: 70 行

#### 功能
三阶段代码审查工作流，启动三个并行审查 Agent。

```
/simplify
  ↓
Phase 1: git diff 识别变更
  ↓
Phase 2: 启动 3 个并行 Agent
  ├── Agent 1: 代码复用审查
  ├── Agent 2: 代码质量审查
  └── Agent 3: 效率审查
  ↓
Phase 3: 聚合发现，修复问题
```

---

### 8. bundled/updateConfig.ts — 配置管理

**行数**: 476 行

#### 功能
settings.json 配置管理技能，动态生成 JSON Schema 文档。

#### 特性
- 从 Zod SettingsSchema 动态生成 JSON Schema
- 文档化三层配置系统（user/project/local）
- 完整的 hooks 文档（所有事件类型和钩子类型）
- 强调"先读后写"模式

---

### 9. bundled/keybindings.ts — 快捷键自定义

**行数**: 340 行

#### 功能
生成快捷键系统的完整文档，包括默认绑定、保留键和自定义格式。

---

### 10. bundled/remember.ts — 记忆管理

**行数**: 83 行（仅内部用户可用）

#### 工作流

```
/remember
  ↓
Step 1: 收集记忆层
  ├── CLAUDE.md
  ├── CLAUDE.local.md
  ├── 自动记忆
  └── 团队记忆
  ↓
Step 2: 按目标分类条目
  ↓
Step 3: 识别清理机会（重复/过期/冲突）
  ↓
Step 4: 呈现结构化报告，等待用户批准
```

---

### 11. bundleskillify.ts — 工作流捕获

**行数**: 197 行（仅内部用户可用）

#### 功能
将当前会话的工作流捕获为可复用的技能文件。

```
/skillify
  ↓
提取会话中的用户消息
  ↓
四轮访谈:
  1. 高层确认
  2. 细节补充
  3. 步骤分解
  4. 最终问题
  ↓
生成 SKILL.md（含 frontmatter）
  ↓
预览 → 用户确认 → 保存
```

---

### 12. bundled/debug.ts — 调试日志

**行数**: 104 行

```typescript
// 启用调试日志
enableDebugLogging()
// 读取最后 100 行日志
const logs = await readLastLines(getDebugLogPath(), 100)
// 提供日志路径
console.log(`Debug log: ${getDebugLogPath()}`)
```

---

### 13. bundled/loremIpsum.ts — 长文本生成

**行数**: 283 行（仅内部用户可用）

#### 功能
生成填充文本用于长上下文测试。

- 使用 200 个经过验证的单 token 词汇
- 句子长度 10-20 词
- 随机段落分隔
- 上限 500k n- 输入验证

---

### 14. bundled/stuck.ts — 卡住诊断

**行数**: 80 行（仅内部用户可用）

#### 功能
诊断冻结/缓慢的 Claude Code 会话。

- 调查机器上的其他 Claude Code 进程
- 识别卡住迹象（高 CPU、D/T/Z 进程状态、高 RSS）
- 收集诊断上下文
- 仅诊断，不杀进程

---

### 15. bundled/verify.ts — 变更验证

**行数**: 31 行（仅内部用户可用）

通过运行应用来验证代码变更。

---

## 内容包文件

### claudeApiContent.ts (76 行)
在构建时内联 markdown 文档，提供模型变量、技能提示和参考文件。

### verifyContent.ts (14 行)
在构建时内联 SKILL.md 和示例文件。

---

## 架构总结

```
skills/
├── 基础设施
│   ├── bundledSkills.ts    ← 内置技能注册表
│   ├── loadSkillsDir.ts    ← 目录技能发现
│   └── mcpSkillBuilders.ts ← DI 打破循环依赖
│
├── 初始化
│   └── bundled/inde    ← 统一初始化入口
│
├── 开发工具技能
│   ├── claudeApi.ts        ← API 开发辅助
│   ├── claudeInChrome.ts   ← Chrome 自动化
│   ├── batch.ts            ← 批量并行执行
│   ├── debug.ts            ← 调试日志
│   └── simplify.ts         ← 代码审查
│
├── 配置技能
│   ├── updateConfig.ts     ← settings.json 管理
│   └── keybindings.ts      ← 快捷键自定义
│
├── 记忆/工作流技能
│   ├── remember.ts         ← 记忆管理
│   └── skillify.ts         ← 工作流捕获
│
├── 诊断技能
│   ├── stuck.ts            ← 卡住诊断
│   ├── verify.ts           ← 变更验证
│   └── loremIp       ← 长文本测试
│
└── 内容包
    ├── claudeApiContent.ts ← API 文档包
    └── verifyContent.ts    ← 验证文档包
```
