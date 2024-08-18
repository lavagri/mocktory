import { defineConfig } from 'vitest/config'
import * as path from 'path'
import { useCommon } from './test/vite.config.base'
import { UnitTestsGlob } from './test/vite.config.unit'
import { IntTestsGlob } from './test/vite.config.int'

export default defineConfig({
  ...useCommon({ include: [...UnitTestsGlob, ...IntTestsGlob] }),
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src/'),
    },
  },
})
