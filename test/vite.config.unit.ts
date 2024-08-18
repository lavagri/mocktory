import { defineConfig } from 'vitest/config'
import { useCommon } from './vite.config.base'

export const UnitTestsGlob = ['**/*.test.ts']

export default defineConfig(useCommon({ include: UnitTestsGlob }))
