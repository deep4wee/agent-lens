# Example 5: Clean Teardown & Auto-Cleanup Lifecycle

Prevent test pollution, corrupted databases, and "buggy" leftover artifacts when running end-to-end tests.

## The Problem
When testing actions like "Create Project", "Download Asset", or "Save Profile", test artifacts are created on the real filesystem. If the test crashes halfway, corrupted files remain, causing future test runs to fail mysteriously.

## The Solution
AgentLens provides two lines of defense:
1. **`teardown()` hook**: Guaranteed to execute in a `finally` block, even if the scenario throws an uncaught error.
2. **`--clean=<paths>` CLI flag**: Automatically deletes specified folders or files after the test completes.

## Writing the Scenario (`scenarios/isolated-data.scenario.ts`)

```typescript
import { defineVisualTest } from 'agent-lens';
import fs from 'fs';
import path from 'path';

const TEST_SANDBOX_DIR = path.resolve(process.cwd(), '.tmp_test_sandbox');

export default defineVisualTest({
  id: 'isolated-creation-flow',
  title: 'Data Creation with Guaranteed Cleanup',
  route: '/projects',

  // 1. Setup: Prepare a clean workspace before testing begins
  setup: async () => {
    if (fs.existsSync(TEST_SANDBOX_DIR)) {
      fs.rmSync(TEST_SANDBOX_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_SANDBOX_DIR, { recursive: true });
  },

  // 2. Main Test Run
  run: async (ctx) => {
    ctx.log('Creating a new test project');
    await ctx.click('button#new-project');
    await ctx.type('input#project-name', 'Temporary_Test_Project');
    await ctx.click('button#confirm');

    await ctx.wait(800);
    await ctx.capture('01_project_created');

    // Perform verification assertions
    const count = await ctx.getElementCount('.project-item');
    ctx.log(`Current project count: ${count}`);
  },

  // 3. Teardown: ALWAYS executes, even if run() fails!
  teardown: async () => {
    console.log('[Teardown] Purging sandbox test directory');
    if (fs.existsSync(TEST_SANDBOX_DIR)) {
      fs.rmSync(TEST_SANDBOX_DIR, { recursive: true, force: true });
    }
  }
});
```

## Running with Auto-Cleanup Flags

You can also pass additional paths to clean up directly from the CLI:
```bash
npx agent-lens \
  --scenario=isolated-creation-flow \
  --clean="./cache,./tmp_data,.tmp_test_sandbox"
```
AgentLens ensures all specified targets are purged on completion.
