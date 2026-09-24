# 🔌 Reference: Authoring AgentLens Plugins On-The-Fly

This reference guide is designed for **AI coding agents** working with AgentLens. When you encounter a project constraint that cannot be met with default flags or DSL actions, **do not attempt fragile workarounds**. Instead, write a 1-file AgentLens plugin.

---

## ⚡ When Should You (The Agent) Write a Plugin?

Write a custom plugin when:
1. **Authentication / Session Gate**: The application requires pre-set `localStorage`, cookies, or headers to access pages without going through an interactive OAuth/login flow.
2. **Custom Assertions**: You need to verify custom DOM states, Canvas/WebGL rendering, CSS animations, or WebWorker states.
3. **Database / File Seeding**: You need to initialize a mock database, seed test files, or clear temporary caches in `setup()`, and guarantee cleanup in `teardown()`.
4. **Third-Party Service Mocking**: You need to intercept WebSockets, Server-Sent Events, or specific IPC bridge protocols.
5. **Specialized Reporting**: You want to compute custom metrics (bundle size, accessibility score, custom element count) and output them directly into `report.md`.

---

## 📁 Where to Put Your Plugin

AgentLens automatically discovers plugins placed in:
- `.agent-lens/plugins/<name>.ts`
- `plugins/<name>.ts`

Because AgentLens uses `jiti`, you can write modern TypeScript directly without compiling to JavaScript!

---

## 🧩 The 1-File Plugin Template

Create `.agent-lens/plugins/my-feature.ts`:

```typescript
import { definePlugin, type AgentLensPlugin } from 'agent-lens';

export const myFeaturePlugin: AgentLensPlugin = definePlugin({
  name: 'my-feature',
  version: '1.0.0',

  // 1. Setup: Prepare environment or seed files before browser launch
  setup: async (hookContext) => {
    hookContext.state.set('startTime', Date.now());
  },

  // 2. Injected into browser before any scripts run (localStorage, cookies, headers)
  onContextCreated: async (context, hookContext) => {
    await context.addInitScript(() => {
      // Runs in browser window context
      window.localStorage.setItem('AUTH_TOKEN', 'mock-token-xyz');
    });
  },

  // 3. Extend ctx: Add custom helper methods accessible inside scenario run(ctx)
  extendContext: (_ctx, page, hookContext) => {
    return {
      myCustomAction: async (value: string) => {
        await page.evaluate((v) => console.log('Action triggered:', v), value);
      }
    };
  },

  // 4. Enrich report.md: Add custom markdown tables or checklists
  onAfterRun: async (reportData, hookContext) => {
    if (!reportData.customSections) return;
    const elapsed = Date.now() - ((hookContext.state.get('startTime') as number) || Date.now());

    reportData.customSections.push({
      title: '🎯 My Custom Verification',
      content: `Total plugin execution time: **${elapsed}ms**\n\n- [x] Custom assertion passed successfully`
    });
  },

  // 5. Teardown: Always executes in finally block
  teardown: async (hookContext) => {
    // Clean up temporary files, reset state
  }
});

export default myFeaturePlugin;
```

---

## 🚀 How to Execute Your Plugin

### Option A: Via Quick Snap CLI
```bash
npx agent-lens snap --plugin=my-feature --url=http://localhost:5173
```

### Option B: In a Scripted Scenario
```typescript
import { defineVisualTest } from 'agent-lens';
import myFeaturePlugin from '../.agent-lens/plugins/my-feature';

export default defineVisualTest({
  id: 'custom-check',
  plugins: [myFeaturePlugin], // Pass plugin instance or string name
  run: async (ctx) => {
    // Call custom method added by extendContext:
    await (ctx as any).myCustomAction('Hello from Agent!');
    await ctx.capture('01_verified');
  }
});
```

---

## 🛠️ Common Plugin Recipes for Agents

### Recipe 1: Pre-Populating LocalStorage / Redux / Zustand State
```typescript
// .agent-lens/plugins/seed-store.ts
import { definePlugin } from 'agent-lens';

export default definePlugin({
  name: 'seed-store',
  onContextCreated: async (context) => {
    await context.addInitScript(() => {
      window.localStorage.setItem('user-settings', JSON.stringify({
        theme: 'dark',
        onboardingCompleted: true,
        features: { betaAccess: true }
      }));
    });
  }
});
```

### Recipe 2: Intercepting WebSocket or GraphQL Subscriptions
```typescript
// .agent-lens/plugins/mock-ws.ts
import { definePlugin } from 'agent-lens';

export default definePlugin({
  name: 'mock-ws',
  onContextCreated: async (context) => {
    await context.addInitScript(() => {
      // Mock global WebSocket if needed
      (window as any).__MOCK_WS_CONNECTED = true;
    });
  }
});
```

### Recipe 3: Checking Element Visual Dimensions (No Layout Overflow)
```typescript
// .agent-lens/plugins/layout-checker.ts
import { definePlugin } from 'agent-lens';

export default definePlugin({
  name: 'layout-checker',
  extendContext: (_ctx, page) => {
    return {
      assertNoHorizontalScroll: async () => {
        const hasScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });
        if (hasScroll) {
          throw new Error('❌ Detected unwanted horizontal scrolling! CSS layout overflow.');
        }
      }
    };
  }
});
```
