import path from 'path';
import fs from 'fs';

export async function findScenarios(dir: string, specificName?: string): Promise<string[]> {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...await findScenarios(fullPath, specificName));
    } else if (item.name.endsWith('.scenario.ts') || item.name.endsWith('.scenario.js')) {
      if (!specificName || item.name.startsWith(specificName)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

export function resolveScenariosDirectory(customDir?: string): string {
  if (customDir) {
    return path.resolve(process.cwd(), customDir);
  }

  const candidates = [
    'scenarios',
    'tests/visual',
    'tests/scenarios',
    'test/scenarios',
    'src/scenarios'
  ];

  for (const c of candidates) {
    const p = path.resolve(process.cwd(), c);
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return path.resolve(process.cwd(), 'scenarios');
}
