# 34 - outputStyles 模块源码分析

> 路径: `src/outputStyles/`
> 文件数: 1 个
> 功能: 输出样式加载 — 自定义 AI 响应的格式和风格

---

## loadOutputStylesDir.ts

**行数**: 99 行

### 导出
- `getOutputStyleDirStyles(cwd)` — 获取输出样式配置（memoized）
- `clearOutputStyleCaches()` — 清空缓存

### 样式文件格式

```markdown
---
name: concise
description: 简洁直接的回复风格
keep-coding-instructions: true
---

回复时请保持简洁。不要使用 emoji。
避免冗长的解释，直接给出答案。
```

### 加载流程

```
.claude/output-styles/     ← 项目级样式
~/.claude/output-styles/   ← 用户级样式
    ↓
loadMarkdownFilesForSubdir('output-styles', cwd)
    ↓
对每个 .md 文件:
  ├── 提取文件名作为默认样式名
  ├── 解析 frontmatter (name, description, keep-coding-instructions)
  ├── 使用 frontmatter name 或回退到文件名
  ├── 提取描述（frontmatter 或 markdown 内容）
  ├── 解析 keep-coding-instructions 标志
  └── 警告 force-for-plugin（仅插件样式有效）
    ↓
返回 OutputStyleConfig[]
```

### Memoization
结果按 `cwd` 缓存，避免重复文件系统访问。

### OutputStyleConfig 结构

```typescript
interface OutputStyleConfig {
  name: string                    // 样式名称
  description: string             // 样式描述
  prompt: string                  // 注入到系统提示的内容
  source: 'user' | 'project'     // 来源
  keepCodingInstructions: boolean // 是否保留默认编码指令
}
```
