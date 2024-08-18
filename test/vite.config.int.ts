import { defineConfig } from 'vitest/config'
import { useCommon } from './vite.config.base'

export const IntTestsGlob = ['**/*.int.ts']

export default defineConfig(useCommon({ include: IntTestsGlob }))
