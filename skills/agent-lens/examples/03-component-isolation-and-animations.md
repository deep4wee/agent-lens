# Example 3: Component Isolation & Animation Bursts

Inspect single UI components without background clutter and capture frame-by-frame sequences of CSS/JS animations.

## Use Cases
- Verifying UI cards, tooltips, dropdown menus, and modal dialogs.
- Inspecting micro-interactions, fade-ins, and spring animations.
- Ensuring popups and dropdowns do not clip outside viewport bounds.

## Writing the Scenario (`scenarios/components.scenario.ts`)

```typescript
import { defineVisualTest, VIEWPORT_PRESETS } from 'agent-lens';

export default defineVisualTest({
  id: 'component-inspection',
  title: 'Component Isolation & Micro-Interactions',
  route: '/components',
  run: async (ctx) => {
    // 1. Dynamic Auto-Resize to Fit a Specific Component
    ctx.log('Focusing strictly on the navigation navbar');
    await ctx.resizeToFit('header.navbar', 10);
    await ctx.capture('01_navbar_isolated');

    // 2. Return to standard desktop dimensions
    await ctx.setPreset(VIEWPORT_PRESETS.DEFAULT);

    // 3. Hover Micro-Interaction with Burst Animation
    ctx.log('Triggering dropdown menu hover animation');
    await ctx.hover('.dropdown-trigger');
    
    // Captures multiple consecutive frames over a 300ms duration at 50ms intervals
    await ctx.captureBurst('02_dropdown_opening_animation', {
      durationMs: 300,
      intervalMs: 50,
      selector: '.dropdown-menu'
    });

    // 4. Final Stabilized State
    await ctx.capture('03_dropdown_open_final', { selector: '.dropdown-menu' });

    // 5. Scroll Interaction
    ctx.log('Scrolling table down by 400px');
    await ctx.scroll('.data-table-container', 400);
    await ctx.capture('04_data_table_scrolled');
  }
});
```

## Running the Scenario
```bash
npx agent-lens --scenario=component-inspection --url=http://localhost:5173
```
