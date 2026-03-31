# 31 - migrations 模块源码分析

> 路径: `src/migrations/`
> 文件数: 11 个
> 功能: 配置迁移 — 跨版本的配置格式升级，确保向后兼容

---

## 模块概述

`migrations/` 处理 Claude Code 跨版本升级时的配置格式迁移。每个迁移文件是一个幂等函数，在应用启动时按需执行。迁移覆盖了从权限配置、模型别名到 MCP 服务器审批等多个领域。

---

## 迁移文件详解

### 1. migrateAutoUpdatesToSettings.ts

**行数**: 62 行

#### 功能
将自动更新偏好从全局配置迁移到 settings.json 环境变量。

#### 迁移逻辑
```
旧: globalConfig.autoUpdates = false
新: settings.json → env.DISABLE_AUTOUPDATER = '1'
```

#### 步骤
1. 检查 `autoUpdates` 是否显式为 false
2. 读取用户设置，添加 `DISABLE_AUTOUPDATER: '1'` 到 env
3. 立即设置 `process.env` 使其即时生效
4. 从全局配置中删除 `autoUpdates` 和 `autoUpdatesProtectedForNative`
5. 记录分析事件

---

### 2. migrateBypassPermissionsAcceptedToSettings.ts

**行数**: 41 行

#### 功能
将权限绕过接受标志从全局配置迁移到 settings.json。

```
旧: globalConfig.bypassPermissionsModeAccepted = true
新: settings.json → skipDangerousModePermissionPrompt: true
```

---

### 3. migrateEnableAllProjectMcpServersToSettings.ts

**行数**: 119 行

#### 功能
将 MCP 服务器审批字段从项目配置迁移到本地设置。

#### 迁移字段
| 旧字段 | 新位置 |
|--------|--------|
| `enableAllProjectMcpServers` | local settings |
| `enabledMcpjsonServers` | local settings（数组合并去重） |
| `disabledMcpjsonServers` | local settings（数组合并去重） |

#### 特殊处理
- 数组字段使用合并去重策略，避免覆盖已有配置
- 记录迁移数量到分析事件

---

### 4. migrateFennecToOpus.ts

**行数**: 46 行

#### 功能
将已移除的 fennec 模型别名迁移到 Opus 4.6 别名（仅内部用户）。

#### 映射规则
```
fennec-latest[1m]     → opus[1m]
fennec-latest         → opus
fennec-fast-latest    → opus[1m] + fastMode: true
opus-4-5-fast         → opus[1m] + fastMode: true
```

#### 条件
- 仅 `USER_TYPE === 'ant'`（Anthropic 内部用户）

---

### 5. migrateLegacyOpusToCurrent.ts

**行数**: 58 行

#### 功能
将第一方用户从显式 Opus 4.0/4.1 版本字符串迁移到 'opus' 别名（解析为 4.6）。

#### 匹配的旧值
```
claude-opus-4-20250514
claude-opus-4-1-20250805
claude-opus-4-0
claude-opus-4-1
```

#### 迁移结果
```
所有上述值 → model: 'opus'
```

#### 条件
- 仅 firstParty API 提供者
- 仅启用了 legacy remap 的用户

---

### 6. migrateOpusToOpus1m.ts

**行数**: 44 行

#### 功能
将符合条件的用户（Max/Team Premium）从 'opus' 迁移到 'opus[1m]'，用于合并的 Opus 1M 体验。

#### 条件
- Opus 1M 合并已启用
- 用户设置的模型恰好是 'opus'
- Pro 订阅者和第三方用户跳过

---

### 7. migrateReplBridgeEnabledToRemoteControlAtStartup.ts

**行数**: 23 行（最小的迁移）

#### 功能
重命名配置键。

```
旧: globalConfig.replBridgeEnabled
新: globalConfig.remoteControlAtStartup
```

#### 特殊处理
- 使用 untyped cast 访问旧键（已从类型定义中移除）
- 仅在旧键存在且新键不存在时迁移

---

### 8. migrateSonnet1mToSonnet45.ts

**行数**: 49 行

#### 功能
将 'sonnet[1m]' 用户固定到显式版本 'sonnet-4-5-20250929[1m]'（因为 'sonnet' 现在解析为 4.6）。

#### 迁移逻辑
```
sonnet[1m] → sonnet-4-5-20250929[1m]
```

#### 特殊处理
- 同时迁移内存中的模型覆盖（`getMainLoopModelOverride`）
- 使用完成标志 `sonnet1m45MigrationComplete` 防止重复执行

---

### 9. migrateSonnet45ToSonnet46.ts

**行数**: 68 行

#### 功能
将 Pro/Max/Team Premium 用户从显式 Sonnet 4.5 字符串迁移到 'sonnet' 别名（现在是 4.6）。

#### 匹配的旧值
```
claude-sonnet-4-5-20250929      → sonnet
claude-sonnet-4-5-20250929[1m]  → sonnet[1m]
sonnet-4-5-20250929             → sonnet
sonnet-4-5-20250929[1m]         → sonnet[1m]
```

#### 条件
- 仅 firstParty Pro/Max/Team Premium 订阅者
- 新用户（numStartups ≤ 1）跳过通知

---

### 10. resetAutoModeOptInForDefaultOffer.ts

**行数**: 52 行

#### 功能
一次性迁移：为接受了旧对话框但默认模式不是 'auto' 的用户清除 `skipAutoPermissionPrompt`。

#### 条件
- `TRANSCRIPT_CLASSIFIER` 特性已启用
- 自动模式状态为 'enabled'
- 用户有 `skipAutoPermissionPrompt` 但默认模式不是 'auto'

---

### 11. resetProToOpusDefault.ts

**行数**: 52 行

#### 功能
自动将 Pro 用户迁移到 Opus 4.5 默认模型。

#### 逻辑
- 无自定义模型设置 → 保存 `opusProMigrationTimestamp`（用于通知）
- 有自定义模型设置 → 仅标记迁移完成

---

## 通用模式

### 1. 幂等性保证

```typescript
// 大多数迁移使用完成标志
const config = getGlobalConfig()
if (config.migrationXComplete) return  // 已执行过，跳过

// ... 执行迁移 ...

saveGlobalConfig({ ...config, migrationXComplete: true })
```

### 2. 条件执行

```typescript
// 按用户类型、订阅、API 提供者过滤
if (getAPIProvider() !== 'firstParty') return
if (!isProSubscriber()) return
```

### 3. 分析追踪

```typescript
// 所有迁移记录分析事件
logEvent('migration_x_completed', { originalModel, newModel })
logEvent('migration_x_error', { error: e.message })
```

### 4. 错误处理

```typescript
try {
  // 迁移逻辑
} catch (e) {
  logError('Migration failed', e)
  // 不抛出 — 迁移失败不应阻止应用启动
}
```

---

## 迁移执行时机

```
应用启动 (setup.ts)
    ↓
按顺序检查每个迁移
    ├── 检查完成标志
    ├── 检查前置条件（用户类型、订阅等）
    └── 执行迁移（如需要）
    ↓
所有迁移完成
    ↓
继续正常启动流程
```
