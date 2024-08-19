import type { GlobalSetupContext } from 'vitest/node'

export default function setup({ provide }: GlobalSetupContext) {
  const redisContainersInfo = globalThis.testcontainers.containers.find(
    ({ name }) => name === 'redis',
  )!

  const redisConfig = {
    host: redisContainersInfo.host,
    port: redisContainersInfo.ports.get(6379)!,
  }

  provide('redis', redisConfig)
}

declare module 'vitest' {
  export interface ProvidedContext {
    redis: { host: string; port: number }
  }
}
