# Example 2: Live Dev Server Workflow

Test complex user flows and route transitions on an active Vite, Next.js, Webpack, or Full-Stack dev server.

## Use Cases
- Testing forms, multi-step wizards, and client-side navigation.
- Verifying client-server interactions against real endpoints.
- Running scripted tests against Hot Module Replacement (HMR) during agent development.

## 1. Writing the Scenario (`scenarios/user-flow.scenario.ts`)

```typescript
import { defineVisualTest, VIEWPORT_PRESETS } from 'agent-lens';

export default defineVisualTest({
  id: 'user-registration-flow',
  title: 'User Registration & Onboarding Flow',
  route: '/register',
  viewports: [VIEWPORT_PRESETS.DEFAULT, VIEWPORT_PRESETS.WIDE],
  run: async (ctx) => {
    // 1. Initial State
    ctx.log('Checking registration form initial render');
    await ctx.capture('01_register_empty');

    // 2. Form Interaction
    ctx.log('Filling registration inputs');
    await ctx.type('input[name="email"]', 'agent@example.com');
    await ctx.type('input[name="password"]', 'SecureP@ssw0rd!');
    await ctx.click('input[type="checkbox"]');
    await ctx.capture('02_register_filled');

    // 3. Form Submission
    await ctx.click('button[type="submit"]');
    await ctx.waitForSelector('.welcome-banner', 5000);
    await ctx.capture('03_onboarding_welcome');

    // 4. Assertions
    const welcomeText = await ctx.readText('.welcome-banner h1');
    ctx.log(`Welcome banner title: "${welcomeText}"`);
    
    const errors = ctx.getConsoleErrors();
    if (errors.length > 0) {
      ctx.log(`⚠️ Warning: Detected ${errors.length} console errors!`);
    }
  }
});
```

## 2. Running Against an Already Running Server
```bash
npx agent-lens --scenario=user-registration-flow --url=http://localhost:5173
```

## 3. Running with Managed Process Lifecycle
AgentLens launches `npm run dev`, waits for `http://localhost:5173` to be healthy, executes the scenario, and reliably shuts down the dev server process tree:
```bash
npx agent-lens \
  --scenario=user-registration-flow \
  --start="npm run dev" \
  --url=http://localhost:5173 \
  --folder=visual-reports
```
