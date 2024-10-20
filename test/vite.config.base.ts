import path from 'path'
import swc from 'unplugin-swc'
import { UserConfig } from 'vitest/config'

type BaseViteConfig = {
  include: string[]
}

export const useCommon = ({ include }: BaseViteConfig): UserConfig => ({
  test: {
    globals: true,
    root: './src/',
    include,
    clearMocks: true,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, '../src/'),
    },
  },
})
