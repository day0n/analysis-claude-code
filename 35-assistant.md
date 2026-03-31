# 35 - assistant 模块源码分析

> 路径: `src/assistant/`
> 文件数: 1 个
> 功能: 会话历史 API — 从远程 API 分页获取会话事件

---

## sessionHistory.ts

**行数**: 88 行

### 导出
- `HISTORY_PAGE_SIZE = 100` — 分页大小
- `HistoryPage` 类型 — `{ events: SDKMessage[], firstId: string, hasMore: boolean }`
- `HistoryAuthCtx` 类型 — `{ baseUrl: string, headers: Record<string, string> }`
- `createHistoryAuthCtx(sessionId)` — 创建认证上下文
- `fetchLatestEvents(ctx, limit?)` — 获取最新事件页
- `fetchOlderEvents(ctx, beforeId, limit?)` — 获取更早事件页

### 关键依赖
- `axios` — HTTP 客户端
- `getOauthConfig` — OAuth 配置
- `SDKMessage` — 事件消息类型
- `getOAuthHeaders`, `prepareApiRequest` — API 认证

### 认证上下文创建

```typescript
async function createHistoryAuthCtx(sessionId: string): Promise<HistoryAuthCtx> {
  const headers = await getOAuthHeaders()
  const { baseUrl } = await prepareApiRequest()

  return {
    baseUrl: `${baseUrl}/v1/sessions/${sessionId}/events`,
    headers: {
      ...headers,
      'anthropic-beta': 'ccr-byoc-2025-07-29',
      'x-organization-uuid': orgUuid,
    }
  }
}
```

### 分页策略

```
获取最新页:
  GET /v1/sessions/{id}/events?anchor_to_latest=true&limit=100
  → { events: [...], firstId: "cursor_abc", hasMore: true }

获取更早页（游标分页）:
  GET /v1/sessions/{id}/events?before_id=cursor_abc&limit=100
  → { events: [...], firstId: "cursor_xyz", hasMore: false }
```

### 错误处理

```typescript
// HTTP 错误或网络故障返回 null（不抛异常）
// 用 logForDebugging 记录状态码
// 15 秒请求超时
try {
  const response = await axios.get(url, { headers, timeout: 15000 })
  return mapToHistoryPage(response.data)
} catch (error) {
  logForDebugging('Failed to fetch events', error.response?.status)
  return null
}
```

### 使用场景

主要被 `screens/ResumeConversation.tsx` 使用，在恢复远程会话时获取历史事件。

```
用户选择恢复远程会话
    ↓
createHistoryAuthCtx(sessionId)
    ↓
fetchLatestEvents(ctx, 100)
    ↓
显示会话内容
    ↓
用户滚动加载更多 → fetchOlderEvents(ctx, cursor, 100)
```
