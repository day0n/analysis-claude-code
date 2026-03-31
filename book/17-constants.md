# 17 - constants 模块源码分析

> 路径: `src/constants/`
> 功能: 常量定义 — 产品信息、OAuth 配置、模型列表、UI 常量

---

## 核心常量文件

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

### models.ts — 模型配置

```typescript
export const MODEL_ALIASES = {
  'opus': 'claude-opus-4-6',
  'sonnet': 'claude-sonnet-4-6',
  'haiku': 'claude-haiku-4-5',
  'opus[1m]': 'claude-opus-4-6[1m]',
  'sonnet[1m]': 'claude-sonnet-4-6[1m]',
}
```

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
