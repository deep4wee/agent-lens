import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/app/cli.ts',
    index: 'src/shared/api/dsl.ts'
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  outDir: 'dist'
});
