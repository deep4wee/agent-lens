# Example 1: Instant Visual Self-Check (`snap`)

The `snap` command is the fastest way for an AI agent to "see" its work immediately without writing any scenario files.

## Use Cases
- After generating or editing a component, web page, or modal.
- Quickly verifying responsiveness across desktop and mobile screens.
- Checking for silent console errors and runtime exceptions.

## Basic Usage

```bash
# Check an already-running dev server
npx agent-lens snap --url=http://localhost:5173
```

## Options & Combinations

### 1. Test Multiple Viewports (Desktop, Tablet, Mobile)
```bash
npx agent-lens snap \
  --url=http://localhost:3000/dashboard \
  --viewports=desktop,tablet,mobile
```

### 2. Auto-Start Dev Server
If your dev server is not running yet, AgentLens can start it automatically, wait until it's ready, take the snapshots, and cleanly terminate the server when finished:
```bash
npx agent-lens snap \
  --start="npm run dev" \
  --url=http://localhost:5173 \
  --wait=1500
```

### 3. Focus on a Specific Component (`--selector`)
Take responsive snapshots of the entire page AND an isolated, fitted snapshot of a single component:
```bash
npx agent-lens snap \
  --url=http://localhost:5173/settings \
  --selector=".pricing-card" \
  --name="pricing_component"
```

### 4. Custom Output Directory
Save visual reports directly to a project folder (make sure to add it to `.gitignore`):
```bash
npx agent-lens snap \
  --url=http://localhost:5173 \
  --folder=visual-reports
```

## Reading the Result
AgentLens outputs the absolute path to `report.md`. Inspect the markdown report using your file reading tool to review the images and console logs.
