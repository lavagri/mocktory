import { defineConfig } from 'vitest/config'
import { type EnvironmentOptions } from 'vitest-environment-testcontainers'

import { useCommon } from './vite.config.base'

export const IntTestsGlob = ['**/*.int-test.ts']

const common = useCommon({ include: IntTestsGlob })

const environmentOptions: EnvironmentOptions = {
  testcontainers: {
    containers: [
      {
        name: 'redis',
        image: 'redis:6.2.5',
        ports: [6379],
        wait: { type: 'PORT' },
      },
    ],
  },
}

export default defineConfig({
  ...common,
  test: {
    ...common.test,
    environment: 'testcontainers',
    environmentOptions,

    setupFiles: ['./test/vite.int.global-setup.ts'],
  },
})
