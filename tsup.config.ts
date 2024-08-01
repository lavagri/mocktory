import { defineConfig } from 'tsup'

export default defineConfig({
  name: 'node',
  platform: 'node',
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  outDir: 'lib',
  bundle: true,
  splitting: false,
  sourcemap: true,
  dts: true,
})
