import { mock } from 'vitest-mock-extended'
import { Mocked, vi } from 'vitest'
import { IMSRepo } from '~/types'
import { MSRedis } from '~/db/redis'

export const FakeMSRepo: IMSRepo<Mocked<MSRedis>> = {
  client: mock<MSRedis>(),
  getAllMocksKeys: vi.fn().mockResolvedValue([]),
}
