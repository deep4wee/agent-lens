import path from 'path';
import fs from 'fs';

export interface AgentLensConfigFile {
  mode?: 'desktop' | 'preview';
  port?: number;
  headed?: boolean;
  detach?: boolean;
  buildCommand?: string;
  autoBuild?: boolean;
  startCommand?: string;
  startCwd?: string;
  cleanArtifacts?: boolean;
  url?: string;
  executablePath?: string;
  clean?: string | string[];
  scenarios?: string;
  wwwroot?: string;
  outDir?: string;
  env?: Record<string, string>;
  plugins?: string[];
}

export function loadConfig(cwd: string = process.cwd()): AgentLensConfigFile {
  const jsonConfigPath = path.join(cwd, 'agent-lens.json');
  if (fs.existsSync(jsonConfigPath)) {
    try {
      const raw = fs.readFileSync(jsonConfigPath, 'utf-8');
      return JSON.parse(raw);
    } catch (e: any) {
      console.warn(`⚠️ [Config] Failed to parse agent-lens.json: ${e.message}`);
    }
  }

  const packageJsonPath = path.join(cwd, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const raw = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(raw);
      if (pkg.agentLens && typeof pkg.agentLens === 'object') {
        return pkg.agentLens;
      }
    } catch {
      // ignore
    }
  }

  return {};
}

export function detectStartCwd(providedCwd?: string): string | undefined {
  if (providedCwd) {
    const resolved = path.resolve(process.cwd(), providedCwd);
    if (fs.existsSync(resolved)) {
      return providedCwd;
    }
  }

  const rootPkgPath = path.join(process.cwd(), 'package.json');
  let rootHasDevScript = false;
  if (fs.existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
      rootHasDevScript = Boolean(rootPkg.scripts?.dev || rootPkg.scripts?.start);
    } catch {
      // ignore
    }
  }

  if (rootHasDevScript) {
    return undefined;
  }

  const candidates = ['Frontend', 'frontend', 'client', 'web', 'ui', 'apps/web', 'src/frontend'];
  for (const candidate of candidates) {
    const candidatePkg = path.join(process.cwd(), candidate, 'package.json');
    if (fs.existsSync(candidatePkg)) {
      return `./${candidate}`;
    }
  }

  return undefined;
}

export function resolveWwwrootDir(customDir?: string): string {
  if (customDir) {
    return path.resolve(process.cwd(), customDir);
  }

  const candidates = [
    'dist',
    'build',
    'out',
    'wwwroot',
    'Frontend/dist',
    'frontend/dist',
    'client/dist'
  ];

  for (const c of candidates) {
    const candidatePath = path.resolve(process.cwd(), c);
    if (fs.existsSync(candidatePath) && fs.existsSync(path.join(candidatePath, 'index.html'))) {
      return candidatePath;
    }
  }

  for (const c of candidates) {
    const candidatePath = path.resolve(process.cwd(), c);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return path.resolve(process.cwd(), 'dist');
}