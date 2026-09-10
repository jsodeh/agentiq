# Mac App Crash - Root Cause Analysis

## Confirmed Facts

### ✅ What Works:
1. **Empty state loads fine** - No crash until message is sent
2. **Tauri command exists** - `prepare_task` IS implemented in `src-tauri/src/main.rs`
3. **Web version works** - Same code, no crash
4. **First fix applied** - Removed "use client" directive from `tool-calls-section.tsx`

### ❌ What Still Fails:
- Sending a message in Mac app → Crash → "Your workspace needs a refresh"

---

## Root Cause: Production Build Strictness

The crash is likely happening due to **production build optimizations** that are stricter than development mode.

### Potential Issues:

### 1. **ReactMarkdown in Production** ⚠️

**File**: `src/components/ChatMessage.tsx`

The component uses `react-markdown` with `remarkGfm`:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Later in render:
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {displayContent}
</ReactMarkdown>
```

**Problem**:
- `react-markdown` has heavy dependencies
- `remarkGfm` (GitHub Flavored Markdown) has complex parsing
- Production builds tree-shake and optimize differently
- Tauri production builds are MORE strict than Vite dev

### 2. **Error Boundary Catches Render Errors**

**File**: `src/screens/Workspace.tsx`

```tsx
componentDidCatch(error: Error, info: ErrorInfo) {
  console.error('Workspace failed to render', error, info);
}
```

The error is being logged to console but we can't see it in the screenshot. The error is caught during **render phase**, not during data fetching.

### 3. **Missing Timestamp Validation**

When converting WorkspaceMessage → Message:

```tsx
const convertedMessage: Message = {
  id: message.id,
  role: message.role,
  content: message.content,
  timestamp: new Date(),  // ← Always creates new Date
  toolCalls: message.meta ? [{
    tool_name: 'prepare_task',
    tool_category: 'orchestrator',
    message: message.meta,
    inputs: {},
    output: message.meta
  }] : undefined,
};
```

`new Date()` should always work, but there might be edge cases in production builds.

---

## Why Web Works But Mac Doesn't

### Development Mode (Web):
- Vite dev server (`npm run dev`)
- Hot module replacement
- Source maps
- Lenient error handling
- Non-minified code

### Production Mode (Mac App):
- Production build (`npm run build`)
- Minified and tree-shaken
- No source maps in bundle
- Strict optimizations
- Tauri-specific webview engine

---

## Solution: Add Defensive Checks

The crash is happening when React tries to render the ChatMessage component. We need to:

1. **Add null checks**
2. **Add fallback for react-markdown errors**
3. **Add better error boundaries**
4. **Log the actual error**

---

## Recommended Fix

### Option 1: Simplify ChatMessage for Workspace

Create a simpler message component specifically for workspace that doesn't use react-markdown:

```tsx
// In bolt-style-chat.tsx - simple message rendering
{messages.map((message) => (
  <div key={message.id} className="border-b border-white/[0.05] px-3 py-3">
    <div className="text-[9px] uppercase font-bold text-primary/70">
      {message.role === 'user' ? 'YOU' : 'AGENTIQ'}
    </div>
    <div className="text-[12px] text-white whitespace-pre-wrap">
      {message.content}
    </div>
    {message.meta && (
      <div className="mt-2 text-[11px] text-accent">
        {message.meta}
      </div>
    )}
  </div>
))}
```

### Option 2: Wrap ReactMarkdown in Error Boundary

Add try-catch around react-markdown rendering in ChatMessage.

### Option 3: Use Simpler Markdown Library

Replace `react-markdown` with a simpler library or plain text rendering for production builds.

---

## Investigation Steps (Without Rebuild)

Since you can't see Tauri logs easily, here's what's likely happening:

### Crash Timeline:
```
1. User sends "Hi"
   ↓
2. submitTask() called
   ↓  
3. invoke('prepare_task') succeeds (Rust command works)
   ↓
4. Response received:
   {
     task_id: "task-1234567890",
     agent_id: "assistant",
     agent_name: "Executive Assistant",
     activated_tools: ["Task orchestration", "Approval safeguards"]
   }
   ↓
5. setMessages() updates state
   ↓
6. React re-renders BoltStyleChat
   ↓
7. ChatMessage component renders
   ↓
8. ❌ ReactMarkdown fails in production build
   ↓
9. Error boundary catches error
   ↓
10. Shows "Your workspace needs a refresh"
```

---

## Next Steps

1. **Simplify the render** - Don't use ChatMessage component for workspace
2. **Use plain text rendering** - Remove react-markdown dependency for workspace messages
3. **Add explicit error logging** - Make error visible in a way we can see it

The fix should focus on **simplifying the message rendering** specifically for the workspace, avoiding complex dependencies like react-markdown that might not work well in Tauri production builds.
