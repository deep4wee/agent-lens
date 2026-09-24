# 🛠️ Example 10: Authoring Custom Agent Plugins

When testing real-world applications, AI coding agents frequently hit barriers that standard testing tools cannot handle out of the box — such as bypassing mock single-sign-on (SSO), pre-populating browser IndexedDB databases, or simulating unstable network throttles.

This example shows how an agent can solve this autonomously by creating a 1-file plugin.

---

## 🎯 Use Case

Your application checks for an active tenant ID in `window.__TENANT_CONFIG__` and crashes if it is missing:
```javascript
// App code (main.tsx)
const tenant = window.__TENANT_CONFIG__.activeId; // Crashes if undefined!
```

Instead of modifying production code or struggling with complex setup scripts, the agent authors a custom plugin to inject this state before React hydrates.

---

## 🛠️ Step-by-Step Walkthrough

### 1. Agent Creates the 1-File Plugin
Create `.agent-lens/plugins/tenant-seeder.ts`:

```typescript
import { definePlugin } from 'agent-lens';

export default definePlugin({
  name: 'tenant-seeder',
  version: '1.0.0',

  onContextCreated: async (context) => {
    // Inject global tenant configuration before page scripts execute
    await context.addInitScript(() => {
      (window as any).__TENANT_CONFIG__ = {
        activeId: 'tenant-enterprise-99',
        name: 'Acme Global Corp',
        tier: 'ENTERPRISE',
        features: {
          analyticsDashboard: true,
          auditLogs: true
        }
      };
    });
  },

  onAfterRun: (reportData) => {
    if (!reportData.customSections) return;
    reportData.customSections.push({
      title: '🏢 Tenant Seeder Status',
      content: 'Successfully injected enterprise tenant mock: `tenant-enterprise-99`.'
    });
  }
});
```

---

### 2. Run with Quick Snap or Scenarios

#### Quick Snap
```bash
npx agent-lens snap --url=http://localhost:5173 --plugin=tenant-seeder
```

#### Scripted Scenario
```typescript
import { defineVisualTest } from 'agent-lens';

export default defineVisualTest({
  id: 'enterprise-dashboard',
  plugins: ['tenant-seeder'], // Auto-resolved from .agent-lens/plugins/tenant-seeder.ts!
  run: async (ctx) => {
    await ctx.capture('01_enterprise_dashboard');
    const headerText = await ctx.readText('.tenant-banner');
    ctx.log(`Banner verified: ${headerText}`);
  }
});
```

---

### 3. Verification & Cleanup
The agent reviews `artifacts/latest/report.md`. If the custom plugin was only needed for temporary testing, the agent can delete `.agent-lens/plugins/tenant-seeder.ts` or keep it committed in the repository for future test runs.
