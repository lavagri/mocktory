import { FeatureIdManagerService } from '~/core/feature-id-manager.service'
import { beforeAll, expect } from 'vitest'
import { MSRepo } from '~/ms-repo'
import { createRedisClient } from '~/db/redis'

const client = await createRedisClient(globalThis.redis)
const FeatureIdManager = new FeatureIdManagerService(new MSRepo(client))

describe('FeatureIdManagerService', () => {
  const smmembersSpy = vi.spyOn(client, 'smembers')
  const sismemberSpy = vi.spyOn(client, 'sismember')

  describe('search()', () => {
    beforeAll(async () => {
      await FeatureIdManager.add('GET_github.com.api_v1*')
      await FeatureIdManager.add('GET_github.com.api_v1_repo')
      await FeatureIdManager.add('GET_*')
    })

    test('should return null if nothing found', async () => {
      const id = await FeatureIdManager.search('POST_github.com.api_v1_issue')

      expect(id).toBe(null)
    })

    test('should return perfect match, regardless of other existing patterns', async () => {
      const id = await FeatureIdManager.search('GET_github.com.api_v1_repo')

      expect(id).toBe('GET_github.com.api_v1_repo')
      expect(sismemberSpy).toBeCalledWith(
        'ms:feature-ids',
        'GET_github.com.api_v1_repo',
      )
      expect(smmembersSpy).not.toBeCalled()
    })

    test('should return the first and shortest pattern that matches the featureId', async () => {
      const id = await FeatureIdManager.search('GET_github.com.api_v1_issue')

      expect(id).toBe('GET_*')
      expect(smmembersSpy).toBeCalledWith('ms:feature-pattern-ids')
      expect(sismemberSpy).toBeCalledWith(
        'ms:feature-ids',
        'GET_github.com.api_v1_issue',
      )
    })

    test('should return null after remove()', async () => {
      await FeatureIdManager.add('DELETE_github.com.api_v1_repo')
      await FeatureIdManager.remove('DELETE_github.com.api_v1_repo')

      const id = await FeatureIdManager.search('DELETE_github.com.api_v1_repo')

      expect(id).toBe(null)
      expect(smmembersSpy).toBeCalledWith('ms:feature-pattern-ids')
      expect(sismemberSpy).toBeCalledWith(
        'ms:feature-ids',
        'DELETE_github.com.api_v1_repo',
      )
    })
  })
})
