import path from 'path';
import fs from 'fs';

export function initScenarioTemplate(): void {
  const targetDir = path.resolve(process.cwd(), 'scenarios');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Generate template.scenario.ts
  const templatePath = path.join(targetDir, 'template.scenario.ts');
  if (!fs.existsSync(templatePath)) {
    const templateContent = `import { defineVisualTest, VIEWPORT_PRESETS } from 'agent-lens';

export default defineVisualTest({
  id: 'template-check',
  title: 'Basic UI Smoke & Responsiveness Check',
  route: '/',
  // Optional setup hook before test runs
  setup: async () => {
    // prepare test files or folders
  },
  run: async (ctx) => {
    ctx.log('Initial page render');
    await ctx.capture('01_initial_state');

    // Test adaptive layout
    await ctx.setPreset(VIEWPORT_PRESETS.MIN_SUPPORTED);
    await ctx.capture('02_compact_view');

    // Check for JavaScript / React runtime errors
    const errors = ctx.getConsoleErrors();
    if (errors.length > 0) {
      ctx.log(\`⚠️ Warning: Caught \${errors.length} console errors!\`);
    }
  },
  // Optional teardown hook guaranteed to run on exit
  teardown: async () => {
    // clean up temporary test files or state
  }
});
`;
    fs.writeFileSync(templatePath, templateContent, 'utf8');
    console.log(`✅ Starter scenario generated at: ${templatePath}`);
  } else {
    console.log(`ℹ️ Template already exists at: ${templatePath}`);
  }

  // 2. Generate starter mocks.ts to satisfy root app state on boot
  const mocksPath = path.join(targetDir, 'mocks.ts');
  if (!fs.existsSync(mocksPath)) {
    const mocksContent = `/**
 * Global IPC & API Mocks
 * 
 * Export an array of base mocks to satisfy root application state on boot.
 */
export default [
  { action: 'GET_PREFS', data: { theme: 'dark', language: 'en' } },
  { action: 'GET_USER_PROFILE', data: { id: 1, name: 'Agent', role: 'admin' } }
];
`;
    fs.writeFileSync(mocksPath, mocksContent, 'utf8');
    console.log(`✅ Base global mocks generated at: ${mocksPath}`);
  }

  console.log(`👉 Run tests with: npx agent-lens --scenario=template --mode=preview`);
}
