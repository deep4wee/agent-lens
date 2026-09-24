# 🚀 Example 07: Live Controller Interactive Loop

The **Live Controller** plugin turns AgentLens into an interactive command-line browser remote. Instead of restarting the browser on every single change, an agent can keep a background session alive, execute actions step-by-step with sub-50ms latency, and inspect the state in real-time.

---

## 🎯 Use Case

You are debugging a multi-step user flow (e.g. multi-page signup, complex drawer, or modal wizard) and want to:
1. Open the page once.
2. Click specific buttons or coordinates.
3. Fill in form values.
4. Capture full-page screenshots (`--full`).
5. Close the session when done.

---

## 🛠️ Step-by-Step CLI Walkthrough

### 1. Start the Live Background Session
```bash
npx agent-lens live start --url=http://localhost:5173
```
*Output:*
```text
🚀 [Live] Starting background browser for http://localhost:5173 on CDP port 9223...
📸 [LiveController] Snapshot saved: artifacts/live/current.png
✅ [Live] Session active! You can now send live commands:
```

The browser is now running in the background. The initial screen is saved to `artifacts/live/current.png`.

---

### 2. Click Elements (Coordinates or CSS Selectors)

#### Vision-Based Coordinate Click (for Multimodal LLMs)
If your vision model identified a button at physical coordinates `(450, 210)`:
```bash
npx agent-lens live click 450 210
```

#### Semantic Selector Click
```bash
npx agent-lens live click "button[type='submit']"
```

AgentLens immediately executes the click and updates `artifacts/live/current.png`.

---

### 3. Type into Form Fields
```bash
npx agent-lens live type "input[name='search']" "AgentLens Microkernel"
```

---

### 4. Capture Full Scrollable Page (`--full`)
To capture the entire scrollable height of the page (beyond the 1200x800 viewport):
```bash
npx agent-lens live snap dashboard_full --full
```
*Output:*
```text
📸 [LiveController] Snapshot saved: artifacts/live/dashboard_full.png (Full Page)
```

---

### 5. Terminate the Session
When your test flow is complete, stop the live browser:
```bash
npx agent-lens live stop
```
*Output:*
```text
🛑 [Live] Session stopped and browser closed.
```

---

## 💡 Using `live-controller` Inside Scenarios

You can also use Live Controller methods directly inside scripted scenarios:

```typescript
import { defineVisualTest } from 'agent-lens';
import liveControllerPlugin from '@_deep4wee/agent-lens/plugins/live-controller';

export default defineVisualTest({
  id: 'canvas-drawing-test',
  plugins: [liveControllerPlugin],
  run: async (ctx) => {
    // 1. Precise coordinate click
    await (ctx as any).clickCoords(350, 420);

    // 2. Drag-and-drop simulation
    await (ctx as any).dragAndDrop(100, 100, 300, 300, 15);

    // 3. Smooth percentage scroll
    await (ctx as any).scrollPercent(50);

    // 4. Live snapshot with full page capture
    await (ctx as any).snapLive({ name: 'canvas_final', fullPage: true });
  }
});
```
