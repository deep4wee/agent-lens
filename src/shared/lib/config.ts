import fs from 'fs';
import path from 'path';

export interface AgentLensConfig {
  wwwroot?: string;
  scenarios?: string;
  outDir?: string;
  autoBuild?: boolean;
  buildCommand?: string;
  executablePath?: string;
  startCommand?: string;
  startCwd?: string;
  cleanArtifacts?: boolean;
  clean?: string[] | string;
  env?: Record<string, string>;
  url?: string;
  port?: number;
  mode?: 'desktop' | 'preview';
  headed?: boolean;
  detach?: boolean;
}

/**
 * Searches and loads agent-lens configuration from:
 * 1. agent-lens.json in cwd
 * 2. "agentLens" field in package.json
 */
export function loadConfig(cwd: string = process.cwd()): AgentLensConfig {
  // 1. Check agent-lens.json
  const configPath = path.join(cwd, 'agent-lens.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`⚠️ Warning: Failed to parse agent-lens.json:`, e);
    }
  }

  // 2. Check package.json
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);
      if (pkg.agentLens && typeof pkg.agentLens === 'object') {
        return pkg.agentLens;
      }
    } catch {
      // Ignore package.json read errors
    }
  }

  return {};
}

/**
 * Automatically discovers wwwroot directories if none are provided.
 * Supports standard SPAs, full-stack monorepos, and hybrid desktop apps (Photino, WPF, Electron).
 */
export function resolveWwwrootDir(customPath?: string, cwd: string = process.cwd()): string {
  if (customPath) {
    return path.resolve(cwd, customPath);
  }

  // Common direct roots
  const standardDirs = [
    'dist',
    'build',
    'wwwroot',
    'Frontend/dist',
    'frontend/dist',
    'client/dist',
    'web/dist',
    'ui/dist'
  ];

  for (const rel of standardDirs) {
    const candidate = path.resolve(cwd, rel);
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  // Deep recursive search for **/wwwroot containing index.html (useful for .NET Photino/WebView2)
  const foundDeepWwwroot = findDeepIndexHtmlDir(cwd, 4);
  if (foundDeepWwwroot) {
    return foundDeepWwwroot;
  }

  // Fallback to first existing standard folder even if index.html is missing
  for (const rel of standardDirs) {
    const candidate = path.resolve(cwd, rel);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(cwd, 'dist');
}

/**
 * Auto-detects frontend subdirectory in monorepos (e.g. Frontend/, client/, web/)
 * when root package.json does not have dev script.
 */
export function detectStartCwd(customCwd?: string, rootCwd: string = process.cwd()): string {
  if (customCwd) {
    return path.resolve(rootCwd, customCwd);
  }

  const subdirectories = ['Frontend', 'frontend', 'client', 'web', 'ui', 'app'];
  for (const sub of subdirectories) {
    const subPkg = path.join(rootCwd, sub, 'package.json');
    if (fs.existsSync(subPkg)) {
      try {
        const json = JSON.parse(fs.readFileSync(subPkg, 'utf8'));
        if (json.scripts && (json.scripts.dev || json.scripts.start || json.scripts.build)) {
          return path.join(rootCwd, sub);
        }
      } catch {
        // ignore
      }
    }
  }

  return rootCwd;
}

function findDeepIndexHtmlDir(dir: string, maxDepth: number, currentDepth: number = 0): string | null {
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return null;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'artifacts') {
          continue;
        }

        const subDir = path.join(dir, entry.name);
        if (entry.name === 'wwwroot' && fs.existsSync(path.join(subDir, 'index.html'))) {
          return subDir;
        }

        const found = findDeepIndexHtmlDir(subDir, maxDepth, currentDepth + 1);
        if (found) return found;
      }
    }
  } catch {
    return null;
  }

  return null;
}
