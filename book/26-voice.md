# 26 - voice 模块源码分析

> 路径: `src/voice/`
> 文件数: 1 个
> 功能: 语音模式 — 语音输入/输出支持

---

## voiceModeEnabled.ts

**行数**: 55 行

### 导出
- `isVoiceGrowthBookEnabled()` — GrowthBook kill-switch 检查
- `hasVoiceAuth()` — OAuth 认证检查（需要 claude.ai 账户）
- `isVoiceModeEnabled()` — 综合启用检查

### 启用条件

```typescript
function isVoiceModeEnabled(): boolean {
  // 两个条件都必须满足
  return isVoiceGrowthBookEnabled()  // 1. GrowthBook 特性标志开启
    && hasVoiceAuth()                // 2. 有 claude.ai OAuth 认证
}
```

### 语音流连接
- 端点: claude.ai 的 `voice_stream`
- 认证: OAuth Bearer Token
- 协议: WebSocket 双向流
- Kill-switch: GrowthBook 可随时关闭

### 与 REPL 的集成

语音模式在 `screens/REPL.tsx` 中条件加载：

```typescript
// REPL.tsx 中
if (isVoiceModeEnabled()) {
  const { VoiceInput } = await import('../voice/VoiceInput')
  // 渲染语音输入组件
}
```

语音输入转换为文本后，走和键盘输入相同的消息处理流程。
