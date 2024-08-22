import { IMSRepo } from '~/types'

class FeatureIdSet {
  constructor(
    private readonly key: string,
    private readonly msRepo: IMSRepo,
  ) {}

  get ids(): Promise<string[]> {
    return this.msRepo.client.smembers(this.key)
  }

  async add(value: string) {
    this.msRepo.client.sadd(this.key, value)
  }

  async remove(value: string) {
    this.msRepo.client.srem(this.key, value)
  }

  async isInSet(value: string): Promise<boolean> {
    return (await this.msRepo.client.sismember(this.key, value)) === 1
  }
}

/**
 * Manages all system non-default feature and pattern IDs.
 * Allows searching in reverse pattern matching.
 */
export class FeatureIdManagerService {
  constructor(
    private readonly msRepo: IMSRepo,
    private readonly featureIdSet = new FeatureIdSet('ms:feature-ids', msRepo),
    private readonly patternIdSet = new FeatureIdSet(
      'ms:feature-pattern-ids',
      msRepo,
    ),
  ) {}

  async add(featureId: string) {
    if (featureId.endsWith('*')) {
      await this.patternIdSet.add(featureId)
    } else {
      await this.featureIdSet.add(featureId)
    }
  }

  async remove(featureId: string) {
    if (featureId.endsWith('*')) {
      await this.patternIdSet.remove(featureId)
    } else {
      await this.featureIdSet.remove(featureId)
    }
  }

  /**
   * Searching by feature id to retrieve proper existing mock id.
   * Allows reverse pattern matching with next rules:
   *
   * 1. The perfect featureId match will be returned regardless of the existing patterns.
   * 2. If no perfect match is found, the first and shortest pattern that matches the featureId will be returned.
   */
  async search(featureId: string): Promise<string | null> {
    const perfectMatch = await this.featureIdSet.isInSet(featureId)
    if (perfectMatch) {
      return featureId
    }

    return (
      (await this.patternIdSet.ids)
        .filter((e) => new RegExp(e).test(featureId))
        .sort((a, b) => a.length - b.length)[0] || null
    )
  }
}
