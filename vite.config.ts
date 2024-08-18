import { defineConfig } from 'vitest/config'
import * as path from 'path'

import IntConfig from './test/vite.config.int'

export default defineConfig({
  ...IntConfig,
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'src'),
    },
  },
})
