# 🚀 Demo Quick Start

## Access the Demo

```bash
npm run dev
```

Then navigate to: **http://localhost:5173/demo**

## What You'll See

### 1. Empty State
- Welcome message
- 4 colorful suggestion cards
- Input box at bottom

### 2. Try These Workflows

#### 📅 Daily Overview
**Click:** "What's my day like?"
- ✅ 4 automated steps
- ✅ Calendar, emails, tasks
- ✅ ~12 seconds
- ❌ No approval needed

#### 📊 Sales Report
**Click:** "Sales performance"  
- ✅ 5 automated steps
- ✅ Database, analytics, PDF
- ⚠️ **APPROVAL REQUIRED** before sending
- ✅ ~15 seconds + approval

#### 📧 Email Catch-up
**Click:** "Catch up on emails"
- ✅ 4 automated steps
- ✅ Fetch, analyze, draft
- ❌ No approval needed
- ✅ ~12 seconds

#### 🗓️ Meeting Scheduler
**Click:** "Schedule meeting"
- ✅ 4 automated steps
- ✅ Check availability, create event
- ⚠️ **APPROVAL REQUIRED** before invites
- ✅ ~10 seconds + approval

## What to Look For

### ✨ Key Features Demonstrated

1. **Empty State** - Beautiful welcome screen
2. **Suggestion Cards** - Click to trigger workflows
3. **Message Thread** - Linear, clean layout
4. **Workflow Planning** - See the plan before execution
5. **Live Progress** - Watch steps execute in real-time
6. **Tool Calls** - Expand to see inputs/outputs
7. **Approval Gates** - Human-in-the-loop for sensitive actions
8. **Status Indicators** - Pending → Running → Completed
9. **Theme Toggle** - Switch dark/light mode
10. **Auto-scroll** - Messages scroll automatically

## Interactive Elements

### Click to Expand
- Tool call headers (see all tools)
- Individual tools (see inputs/outputs)
- Approval parameters (see JSON details)

### Buttons to Try
- **Approve** - Execute final step
- **Reject** - Cancel workflow
- **Theme Toggle** - Switch themes
- **Send** - Submit custom message

### Keyboard Shortcuts
- **Enter** - Send message
- **Shift+Enter** - New line in input

## Demo Flow Examples

### Quick Demo (30 seconds)
1. Click "What's my day like?"
2. Watch workflow execute
3. See tool calls expand
4. Read final summary
5. Click another suggestion

### Full Demo (2 minutes)
1. Start with "Daily Overview"
2. Try "Sales performance"
3. Click "Approve" when prompted
4. Watch final step execute
5. Try "Schedule meeting"
6. Click "Reject" this time
7. Toggle theme to light mode
8. Type a custom message

### Show Off Features (5 minutes)
1. Point out empty state design
2. Explain suggestion cards
3. Click "Sales performance"
4. Highlight workflow plan
5. Show tool calls expanding
6. Watch progress indicators
7. Demonstrate approval gate
8. Expand parameters JSON
9. Approve and complete
10. Show final result formatting

## Timing Reference

- **Message delay**: ~800ms
- **Acknowledgment**: +1200ms
- **Plan creation**: +1500ms
- **Per step**: ~1500-1800ms
- **Tool display**: +400ms
- **Approval wait**: User decision
- **Final result**: +1000ms

**Total for simple workflow**: ~12 seconds  
**Total with approval**: ~15 seconds + user time

## Troubleshooting

### Demo not loading?
```bash
# Restart dev server
npm run dev
```

### Styles look wrong?
- Enable dark mode in your browser
- Check browser console for errors

### Build fails?
```bash
npm install
npm run build
```

### Want to customize?
Edit: `src/components/ui/full-experience-demo.tsx`

## Tips for Best Experience

1. **Use dark mode** - Default and looks best
2. **Full screen** - Hide browser chrome
3. **Try all suggestions** - Each is different
4. **Approve and reject** - See both flows
5. **Expand tool calls** - See the details
6. **Watch animations** - Smooth transitions
7. **Check status updates** - Live progress
8. **Read final summaries** - Well formatted

## Comparison Test

Try both these demos to see the difference:

### Old Demo (bubble UI)
```typescript
import MessageThreadDemo from '@/components/ui/message-thread-demo';
```

### New Demo (full experience)
```typescript
import FullExperienceDemo from '@/components/ui/full-experience-demo';
// Or visit: /demo
```

## Share the Demo

### For Stakeholders
"Check out our new AI workflow system at localhost:5173/demo. Click 'Sales performance' to see automated reporting with human approval."

### For Developers
"Full demo with empty state, suggestion cards, workflow execution, tool visualization, and HITL approval gates. Source: src/components/ui/full-experience-demo.tsx"

### For Users
"Try the demo - just click any suggestion card and watch your AI assistant work!"

## Next Steps After Demo

1. ✅ Review source code
2. ✅ Read full documentation
3. ✅ Plan your integration
4. ✅ Customize for your needs
5. ✅ Connect to real backend

## Documentation Links

- **Full Guide**: `docs/DEMO_GUIDE.md`
- **Component Docs**: `docs/MESSAGE_THREAD_UI.md`
- **Integration**: `docs/INTEGRATION_QUICKSTART.md`
- **Visual Reference**: `docs/VISUAL_STRUCTURE.md`

---

**🎉 Enjoy the demo!**

**URL**: http://localhost:5173/demo  
**Route**: `/demo`  
**Component**: `FullExperienceDemo`
