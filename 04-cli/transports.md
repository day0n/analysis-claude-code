# cli 模块 — transports 子目录

> 路径: `src/cli/transports/`
> 功能: 网络传输层 — WebSocket/SSE/HTTP 传输协议实现

---

## 文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `HybridTransport.ts` | 283 | 混合传输（WS 读 + HTTP POST 写） |
| `WebSocketTransport.ts` | ~200 | WebSocket 传输基类 |
| `SSETransport.ts` | ~200 | Server-Sent Events 传输 |
| `SerialBatchEventUploader.ts` | ~150 | 批量事件上传器 |
| `WorkerStateUploader.ts` | ~100 | Worker 状态上传 |
| `ccrClient.ts` | ~200 | CCR v2 客户端 |
| `transportUtils.ts` | ~100 | 传输工具函数 |

---

## HybridTransport — 核心传输

```
┌─────────────────────────────────────┐
│          HybridTransport            │
├─────────────────────────────────────┤
│  读取: WebSocket (实时推送，低延迟)   │
│  写入: HTTP POST (批量上传，可靠)     │
├─────────────────────────────────────┤
│  SerialBatchEventUploader           │
│  ├── 100ms 缓冲窗口                 │
│  ├── 合并 stream_event              │
│  └── 指数退避重试                    │
├─────────────────────────────────────┤
│  超时: POST 15s / 关闭优雅期 3s      │
└─────────────────────────────────────┘
```

### 设计原因
- WebSocket 适合实时读取（低延迟推送）
- HTTP POST 适合可靠写入（自动重试、批量合并）
- 混合模式兼顾实时性和可靠性

---

## ccrClient.ts — CCR v2 协议

CCR（Claude Code Remote）v2 客户端，处理远程会话的创建、令牌刷新和消息传输。
