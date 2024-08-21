import { FeatureIdManagerService } from '~/core/feature-id-manager.service'
import { FakeMSRepo } from '../../test/utils/fake-ms-repo'

const FeatureIdManager = new FeatureIdManagerService(FakeMSRepo)

describe('FeatureIdManagerService', () => {
  describe('search()', () => {
    FeatureIdManager.add('GET_github.com.api_v1*')
    FeatureIdManager.add('GET_github.com.api_v1_repo')
    FeatureIdManager.add('GET_*')

    test('should return null if nothing found', () => {
      const id = FeatureIdManager.search('POST_github.com.api_v1_issue')

      expect(id).toBe(null)
    })

    test('should return perfect match, regardless of other existing patterns', () => {
      const id = FeatureIdManager.search('GET_github.com.api_v1_repo')

      expect(id).toBe('GET_github.com.api_v1_repo')
    })

    test('should return the first and shortest pattern that matches the featureId', () => {
      const id = FeatureIdManager.search('GET_github.com.api_v1_issue')

      expect(id).toBe('GET_*')
    })
  })
})
