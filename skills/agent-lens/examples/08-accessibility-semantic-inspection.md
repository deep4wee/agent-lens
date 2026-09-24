# ♿ Example 08: Semantic Accessibility Tree Inspection

Not every AI agent operates with multimodal vision tools enabled, and even vision models can miss subtle details like whether an element is marked `disabled`, `required`, or properly focused.

The **`a11y-tree`** plugin extracts the live semantic accessibility tree of the page and outputs a clean, indented Markdown outline.

---

## 🎯 Use Case

1. **Text-Only LLMs**: The agent lacks vision/image tools but needs to know what is rendered on screen.
2. **Form Validation**: Checking whether the submit button is `[disabled]` or input is `[required]`.
3. **Hierarchy Verification**: Verifying heading levels (`h1`, `h2`), navigation landmarks, and dialog focus.

---

## 🛠️ Step-by-Step Walkthrough

### 1. Enabling `a11y-tree` via CLI
You can enable the plugin directly on quick snap checks:
```bash
npx agent-lens snap --url=http://localhost:5173 --plugin=a11y-tree
```

---

### 2. Inspecting the Generated Tree
AgentLens outputs:
1. `artifacts/latest/a11y-tree.md`
2. An embedded section in `artifacts/latest/report.md`

#### Example Output (`a11y-tree.md`):
```markdown
- [banner]
  - [heading] "AgentLens Dashboard" (level 1)
  - [navigation]
    - [link] "Overview"
    - [link] "Settings"
- [main]
  - [heading] "Active Sessions" (level 2)
  - [textbox] "Search scenarios..." (focused)
  - [button] "Run All"
  - [button] "Cancel" (disabled)
  - [list]
    - [listitem] "checkout-flow.scenario.ts"
    - [listitem] "auth-smoke.scenario.ts"
```

---

### 3. Using `a11y-tree` Inside a Scenario

```typescript
import { defineVisualTest } from 'agent-lens';
import a11yTreePlugin from '@_deep4wee/agent-lens/plugins/a11y-tree';

export default defineVisualTest({
  id: 'a11y-inspection-flow',
  title: 'Accessibility Hierarchy Check',
  plugins: [a11yTreePlugin],
  run: async (ctx) => {
    // Navigate and interact
    await ctx.click('button.open-dialog');
    await ctx.wait(300);

    // Capture semantic tree of entire page or isolated modal
    const tree = await (ctx as any).dumpAccessibilityTree({
      selector: '.dialog-content',
      compact: true
    });

    // Custom assertion in scenario
    if (!tree.includes('[button] "Confirm"')) {
      throw new Error('Expected Confirm button in accessibility tree!');
    }

    ctx.log('Accessibility tree verified successfully!');
  }
});
```
