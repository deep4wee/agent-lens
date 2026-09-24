import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/app/cli.ts',
    index: 'src/index.ts',
    'plugins/desktop-webview2/index': 'src/plugins/desktop-webview2/index.ts',
    'plugins/mock-ipc/index': 'src/plugins/mock-ipc/index.ts',
    'plugins/live-controller/index': 'src/plugins/live-controller/index.ts',
    'plugins/live-controller/daemon': 'src/plugins/live-controller/daemon.ts',
    'plugins/a11y-tree/index': 'src/plugins/a11y-tree/index.ts',
    'plugins/visual-diff/index': 'src/plugins/visual-diff/index.ts',
    'plugins/video-recorder/index': 'src/plugins/video-recorder/index.ts',
    'plugins/screen-capture/index': 'src/plugins/screen-capture/index.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  outDir: 'dist'
});
