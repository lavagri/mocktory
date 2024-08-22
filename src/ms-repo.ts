import { MSRedis } from './db/redis'
import { IMSRepo, MSMockingPayload } from '~/types'
import { MSRepoError } from '~/ms-error'
import { config } from '~/const'

export class MSRepo implements IMSRepo {
  private readonly keysPrefix = {
    mock: 'ms:mocking:',
    mock_count: 'ms:mocking-count:',
  }

  constructor(readonly client: MSRedis) {}

  /**
   * Set mock for a specific id.
   * If "count" is specified, mock will be removed after specified "count" requests.
   */
  async setMock(
    id: string,
    body: MSMockingPayload,
  ): Promise<{ mockTTL: number }> {
    const composedKey = this.keysPrefix.mock + id
    const composedCountKey = this.keysPrefix.mock_count + id

    const mockTTL = config.mockTTL_S

    const multi = this.client.multi()

    multi.set(composedKey, JSON.stringify(body))

    if (body.count) {
      multi.set(composedCountKey, body.count)
    }

    multi.expire(composedKey, mockTTL)
    multi.expire(composedCountKey, mockTTL)

    const res = await multi.exec()

    const allSuccessful = (res || []).every((result) => result[0] === null)

    if (!res || !allSuccessful) {
      throw new MSRepoError(`Failed to set mock with key ${composedKey}`)
    }

    return { mockTTL }
  }

  /**
   * Performs O(N) search operation to get all mocks existing in the system.
   * Returns clean keys with no prefix.
   */
  async getAllMocksKeys(): Promise<string[]> {
    const keys = await this.client.getKeysByPattern(
      '0',
      `${this.keysPrefix.mock}*`,
    )

    return keys.map((key) => key.replace(this.keysPrefix.mock, ''))
  }

  /**
   * Performs O(1) search operation to get mock by id.
   */
  async getMockById(id: string): Promise<MSMockingPayload> {
    const composedKey = this.keysPrefix.mock + id

    const res = await this.client.get(composedKey)

    return res ? JSON.parse(res) : null
  }
}
