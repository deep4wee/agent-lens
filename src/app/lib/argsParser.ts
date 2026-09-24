import type { AgentLensConfigFile } from '../../shared/lib/config';
import { detectStartCwd } from '../../shared/lib/config';

export interface CliOptions {
  scenario?: string;
  mode: 'desktop' | 'preview' | string;
  all?: boolean;
  port: number;
  help?: boolean;
  headed?: boolean;
  detach?: boolean;
  build?: boolean | string;
  start?: string;
  startCwd?: string;
  cleanArtifacts?: boolean;
  url?: string;
  selector?: string;
  viewports?: string[];
  waitMs?: number;
  name?: string;
  exe?: string;
  clean?: string[];
  dir?: string;
  wwwroot?: string;
  outDir?: string;
  plugins?: string[];
  fullPage?: boolean;
}

export interface ParsedCliResult {
  isSnapCommand: boolean;
  isInitCommand: boolean;
  options: CliOptions;
}

export function parseCliArgs(argv: string[], fileConfig: AgentLensConfigFile): ParsedCliResult {
  const isInitCommand = argv[0] === 'init';
  const isSnapCommand = argv[0] === 'snap';
  const effectiveArgs = isSnapCommand ? argv.slice(1) : argv;

  const options: CliOptions = {
    mode: fileConfig.mode || 'preview',
    port: fileConfig.port || 9222,
    headed: fileConfig.headed ?? false,
    detach: fileConfig.detach ?? false,
    build: fileConfig.buildCommand || false,
    start: fileConfig.startCommand,
    startCwd: fileConfig.startCwd,
    cleanArtifacts: fileConfig.cleanArtifacts ?? false,
    url: fileConfig.url,
    exe: fileConfig.executablePath,
    clean: Array.isArray(fileConfig.clean) ? fileConfig.clean : (fileConfig.clean ? [fileConfig.clean] : undefined),
    dir: fileConfig.scenarios,
    wwwroot: fileConfig.wwwroot,
    outDir: fileConfig.outDir,
    plugins: fileConfig.plugins ? [...fileConfig.plugins] : []
  };

  for (const arg of effectiveArgs) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--scenario=')) {
      options.scenario = arg.split('=')[1];
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--port=')) {
      options.port = parseInt(arg.split('=')[1], 10) || 9222;
    } else if (arg === '--headed') {
      options.headed = true;
    } else if (arg === '--detach') {
      options.detach = true;
    } else if (arg === '--build') {
      options.build = true;
    } else if (arg.startsWith('--build=')) {
      options.build = arg.slice('--build='.length);
    } else if (arg.startsWith('--start=')) {
      options.start = arg.slice('--start='.length);
    } else if (arg.startsWith('--start-cwd=') || arg.startsWith('--cwd=')) {
      options.startCwd = arg.split('=')[1];
    } else if (arg === '--clean-artifacts') {
      options.cleanArtifacts = true;
    } else if (arg.startsWith('--url=')) {
      options.url = arg.split('=')[1];
    } else if (arg.startsWith('--selector=')) {
      options.selector = arg.split('=')[1];
    } else if (arg.startsWith('--viewports=')) {
      const raw = arg.slice('--viewports='.length);
      options.viewports = raw.split(',').map((v: string) => v.trim()).filter(Boolean);
    } else if (arg.startsWith('--wait=')) {
      options.waitMs = parseInt(arg.slice('--wait='.length), 10);
    } else if (arg.startsWith('--name=')) {
      options.name = arg.slice('--name='.length);
    } else if (arg.startsWith('--exe=') || arg.startsWith('--executable=')) {
      const prefix = arg.startsWith('--exe=') ? '--exe=' : '--executable=';
      options.exe = arg.slice(prefix.length);
    } else if (arg.startsWith('--clean=') || arg.startsWith('--cleanup=')) {
      const prefix = arg.startsWith('--clean=') ? '--clean=' : '--cleanup=';
      const rawPaths = arg.slice(prefix.length);
      options.clean = rawPaths.split(',').map((p: string) => p.trim()).filter(Boolean);
    } else if (arg.startsWith('--dir=')) {
      options.dir = arg.split('=')[1];
    } else if (arg.startsWith('--wwwroot=')) {
      options.wwwroot = arg.split('=')[1];
    } else if (arg.startsWith('--outDir=') || arg.startsWith('--folder=')) {
      options.outDir = arg.split('=')[1];
    } else if (arg.startsWith('--plugin=') || arg.startsWith('--plugins=')) {
      const raw = arg.split('=')[1] || '';
      const items = raw.split(',').map((p: string) => p.trim()).filter(Boolean);
      options.plugins = [...(options.plugins || []), ...items];
    } else if (arg === '--full' || arg === '--full-page') {
      options.fullPage = true;
    }
  }

  // Auto-detect startCwd if a start command was provided in a monorepo setup
  if (options.start && !options.startCwd) {
    options.startCwd = detectStartCwd(options.startCwd);
  }

  // Auto-load desktop-webview2 plugin when running in desktop mode or with an .exe
  if ((options.mode === 'desktop' || options.exe) && !options.plugins?.includes('desktop-webview2')) {
    options.plugins = ['desktop-webview2', ...(options.plugins || [])];
  }

  return {
    isSnapCommand,
    isInitCommand,
    options
  };
}
