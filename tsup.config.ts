import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/app/cli.ts',
    index: 'src/index.ts',
    'plugins/desktop-webview2/index': 'src/plugins/desktop-webview2/index.ts',
    'plugins/mock-ipc/index': 'src/plugins/mock-ipc/index.ts',
    'plugins/live-controller/index': 'src/plugins/live-controller/index.ts',
    'plugins/a11y-tree/index': 'src/plugins/a11y-tree/index.ts',
    'plugins/visual-diff/index': 'src/plugins/visual-diff/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  outDir: 'dist'
});
