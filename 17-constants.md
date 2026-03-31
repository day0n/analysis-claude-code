# 17 - constants 模块源码分析

> 路径: `src/constants/`
> 文件数: 21 个
> 功能: 常量定义 — 产品信息、OAuth 配置、API 限制、提示词、工具限制、XML 标签等

---

## 完整文件清单

| 文件 | 说明 |
|------|------|
| `product.ts` | 产品信息（名称、命令、版本、User-Agent） |
| `oauth.ts` | OAuth 配置（客户端 ID、端点、作用域） |
| `outputStyles.ts` | 输出样式类型定义 |
| `apiLimits.ts` | API 限制常量（速率限制、Token 上限） |
| `betas.ts` | Beta 功能标志 |
| `common.ts` | 通用常量 |
| `cyberRiskInstruction.ts` | 网络安全风险指令 |
| `errorIds.ts` | 错误 ID 常量 |
| `figures.ts` | 终端图形字符（Unicode 符号） |
| `files.ts` | 文件相关常量（路径、扩展名） |
| `github-app.ts` | GitHub App 配置 |
| `keys.ts` | 键盘按键常量 |
| `messages.ts` | 消息相关常量 |
| `prompts.ts` | 提示词模板常量 |
| `spinnerVerbs.ts` | 加载动画动词列表 |
| `system.ts` | 系统常量 |
| `systemPromptSections.ts` | 系统提示词分段常量 |
| `toolLimits.ts` | 工具限制常量（超时、大小上限） |
| `tools.ts` | 工具名称常量 |
| `turnCompletionVerbs.ts` | 回合完成动词列表 |
| `xml.ts` | XML 标签常量（用于结构化输出） |

---

## 核心文件详解

### product.ts — 产品信息

```typescript
export const PRODUCT_NAME = 'Claude Code'
export const PRODUCT_COMMAND = 'claude'
export const CLI_VERSION = '...'  // 从 package.json 读取
export const USER_AGENT = `claude-code/${CLI_VERSION}`
```

### oauth.ts — OAuth 配置

```typescript
export function getOauthConfig() {
  return {
    clientId: '...',
    authorizationEndpoint: 'https://claude.ai/oauth/authorize',
    tokenEndpoint: 'https://claude.ai/oauth/token',
    scopes: ['openid', 'profile', 'email'],
    redirectUri: 'http://localhost:{port}/callback',
  }
}
```

### xml.ts — XML 标签常量

定义了用于结构化输出的 XML 标签，如 `TASK_NOTIFICATION_TAG`、`STATUS_TAG`、`SUMMARY_TAG` 等，在任务系统和消息格式化中广泛使用。

### toolLimits.ts — 工具限制

定义工具执行的各种限制，如 Bash 命令超时、文件大小上限、搜索结果数量限制等。

### outputStyles.ts — 输出样式类型

```typescript
interface OutputStyleConfig {
  name: string
  description: string
  prompt: string
  source: 'user' | 'project' | 'plugin'
  keepCodingInstructions: boolean
}
```

> 注意：源码中不存在 `models.ts` 文件。模型配置相关常量分布在 `src/utils/model/` 目录中。
