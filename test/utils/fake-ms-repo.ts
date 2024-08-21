import { vitest } from 'vitest'
import { IMSRepo } from '~/types'

export const FakeMSRepo: IMSRepo = {
  getAllMocksKeys: vitest.fn().mockResolvedValue([]),
}
