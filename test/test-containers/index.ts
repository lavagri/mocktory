import type { Environment } from 'vitest/environments'

import { setup } from './setup'
import { ContainerInformation, EnvironmentOptions } from './types'

export default <Environment>{
  name: 'testcontainers',
  transformMode: 'ssr',
  async setup(_, options: EnvironmentOptions) {
    if (!options.testcontainers?.containers) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      return { teardown: () => {} }
    }

    const containers = await setup(options.testcontainers.containers)

    Object.defineProperty(globalThis, 'testcontainers', {
      value: {
        containers: containers.map((container) => {
          const { container: _, ...rest } = container
          const result: ContainerInformation = rest
          return result
        }),
      },
      configurable: true,
    })

    Object.defineProperty(globalThis, 'redis', {
      get() {
        const redisContainersInfo = globalThis.testcontainers.containers.find(
          ({ name }) => name === 'redis',
        )!

        return {
          host: redisContainersInfo.host,
          port: redisContainersInfo.ports.get(6379)!,
        }
      },
      configurable: false,
    })

    return {
      async teardown(global) {
        await Promise.all(
          containers.map((container) => container.container.stop()),
        )
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-dynamic-delete
        delete global.testcontainers
      },
    }
  },
}

export * from './types'
