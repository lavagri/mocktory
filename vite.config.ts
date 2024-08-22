import { defineConfig } from 'vitest/config'
import * as path from 'path'

import IntConfig, { IntTestsGlob } from './test/vite.config.int'
import { UnitTestsGlob } from './test/vite.config.unit'

export default defineConfig({
  ...IntConfig,
  test: {
    ...IntConfig.test,
    include: [...UnitTestsGlob, ...IntTestsGlob],
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
})
