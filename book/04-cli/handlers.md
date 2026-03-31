# cli 模块 — handlers 子目录

> 路径: `src/cli/handlers/`
> 功能: CLI 子命令处理器

---

## 文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `auth.ts` | 331 | OAuth 2.0 认证流程（登录/登出/状态） |
| `plugins.ts` | 879 | 插件完整生命周期（安装/卸载/启用/禁用/更新/市场） |
| `autoMode.ts` | 171 | 自动模式分类器规则管理（allow/soft_deny/environment） |
| `agents.ts` | 71 | Agent 列表显示（按来源分组） |
| `util.tsx` | 110 | 杂项子命令（setupToken/doctor/install） |
| `mcp.tsx` | ~1500+ | MCP 服务器管理（最大的 handler） |

---

## auth.ts 详解

### 导出
- `installOAuthTokens()` — 安装 OAuth 令牌
- `authLogin()` — 登录流程
- `authStatus()` — 认证状态查询
- `authLogout()` — 登出

### 登录流程
```
authLogin()
  ├── 快速路径: CLAUDE_CODE_OAUTH_REFRESH_TOKEN 环境变量
  └── 标准 OAuth 流程
      ├── 启动本地 HTTP 服务器（回调接收）
      ├── 打开浏览器到授权页面
      ├── 等待用户授权 → 接收授权码
      ├── 交换 access_token + refresh_token
      ├── 获取用户 profile
      └── 存储令牌到 ~/.claude/
```

---

## plugins.ts 详解

### 支持的操作

| 操作 | 说明 |
|------|------|
| install | 从市场或本地路径安装 |
| uninstall | 卸载插件 |
| enable | 启用已安装的插件 |
| disable | 禁用（保留安装） |
| update | 更新到最新版本 |
| list | 列出已安装插件 |
| search | 搜索市场 |

### 三种作用域
- `user`: `~/.claude/plugins/` — 全局
- `project`: `.claude/plugins/` — 项目级
- `local`: 本地路径引用

---

## autoMode.ts 详解

### 三种规则类别
- `allow` — 自动允许（如读取文件）
- `soft_deny` — 软拒绝（提示用户确认）
- `environment` — 环境限制（如网络访问）

### LLM 审查
`autoModeCritiqueHandler` 使用 LLM 审查用户编写的规则，确保合理性和安全性。
