import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'
import path from 'path'

type ViteConfigType = Parameters<typeof defineConfig>[0]

type BaseViteConfig = {
  include: string[]
}

export const useCommon = ({ include }: BaseViteConfig): ViteConfigType => ({
  test: {
    globals: true,
    root: './src/',
    include,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, '../src/'),
    },
  },
})
