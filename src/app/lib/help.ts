export function printHelp(): void {
  console.log(`
👁️ AgentLens - Visual UI Self-Verification for AI Agents

Usage:
  npx agent-lens snap [options]      Instant one-shot visual & console check (no test files needed)
  npx agent-lens live [action]       Interactive live session (start, click, type, snap, stop)
  npx agent-lens [options]           Run scripted scenario tests from scenarios/
  npx agent-lens init                Generate starter scenario template & mocks

Commands:
  snap                 Take immediate multi-viewport screenshots of a URL & check console errors
  live                 Interactive control: click coordinates/selectors, type text, snap --full
  init                 Generate starter template in scenarios/template.scenario.ts and mocks.ts

Options:
  --url=<url>          Target URL to test (e.g. http://localhost:5173 or http://localhost:3000)
  --start="<cmd>"      Launch dev server or backend process before testing (e.g. --start="npm run dev")
  --start-cwd=<path>   Directory to execute --start command in (e.g. --start-cwd=./Frontend)
  --clean-artifacts    Purge previous test artifacts to prevent folder bloat
  --full               Capture full scrollable page instead of only the viewport
  --selector=<css>     Target a specific element to focus on / resize-to-fit
  --viewports=<list>   Comma-separated viewport presets (default: desktop,mobile; or 1200x800,375x667)
  --wait=<ms>          Wait time in milliseconds after loading before snapshotting [default: 1000]
  --name=<prefix>      Custom name prefix for captured snapshots [default: quick_snap]
  --scenario=<name>    Run specific scenario by name (e.g. --scenario=smoke)
  --all                Run all discovered scenarios
  --mode=<mode>        Engine mode: 'preview' (Web/Vite/Live) or 'desktop' (WebView2/CDP) [default: preview]
  --exe=<path>         Path to native executable for desktop mode (e.g. --exe=bin/MyApp.exe)
  --port=<port>        CDP remote debugging port [default: 9222]
  --build[=<cmd>]      Run build command before testing (e.g. --build="dotnet build" or npm run build)
  --clean=<paths>      Comma-separated paths to safely delete upon test exit (e.g. --clean="./temp,./cache")
  --plugin=<names>     Comma-separated plugins (e.g. --plugin=desktop-webview2,mock-ipc)
  --headed             Show Chromium browser window
  --detach             Keep browser/app open after finishing
  --dir=<path>         Custom scenarios directory [default: scenarios]
  --wwwroot=<path>     Custom directory for static fallback mode [default: dist]
  --folder=<path>      Directory to save visual artifacts/reports (also --outDir)
  --help, -h           Show this help message
  `);
}
