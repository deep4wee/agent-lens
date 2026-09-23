# Example 6: State Testing with Mock Routes & Mock IPC

Simulate different application states (empty list, loading spinners, network errors, populated data) without running a real backend.

## Use Cases
- Verifying HTTP REST / GraphQL states (Empty state, Populated state, 500 Internal Error).
- Testing React Error Boundaries and error banners when an API endpoint fails.
- Testing data table pagination and high volume data without database seeding.

## Writing the Scenario (`scenarios/states.scenario.ts`)

```typescript
import { defineVisualTest, VIEWPORT_PRESETS } from 'agent-lens';

export default defineVisualTest({
  id: 'ui-state-verification',
  title: 'Empty State vs Populated State Verification',
  route: '/users',
  
  // 1. Initial HTTP Network Mocks (Works with fetch/axios in React, Vue, Next.js)
  mockRoutes: [
    {
      url: '**/api/users',
      body: [
        { id: 1, name: 'Alice Cooper', role: 'Administrator' },
        { id: 2, name: 'Bob Marley', role: 'Editor' }
      ]
    }
  ],

  run: async (ctx) => {
    // Check populated table
    ctx.log('1. Checking populated users table');
    await ctx.capture('01_users_populated');

    // 2. Dynamically swap mock data to Empty State during the test
    ctx.log('2. Updating mock to empty list');
    await ctx.setMockRoute('**/api/users', []);
    
    // Re-navigate or trigger refresh
    await ctx.navigate('/users');
    await ctx.wait(300);
    await ctx.capture('02_users_empty_state');

    // Verify empty state message in DOM
    const hasEmptyMessage = await ctx.isVisible('text="No users found"');
    ctx.log(`Empty state text visible: ${hasEmptyMessage}`);

    // 3. Dynamically simulate HTTP 500 Backend Failure
    ctx.log('3. Simulating backend 500 failure');
    await ctx.setMockRoute('**/api/users', { error: 'Internal Server Error' }, { status: 500 });
    await ctx.navigate('/users');
    await ctx.wait(300);
    await ctx.capture('03_users_error_state');
  }
});
```
        

## Running the Scenario
```bash
npx agent-lens --scenario=ui-state-verification --mode=preview
```
