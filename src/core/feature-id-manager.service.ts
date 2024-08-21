import { separateByPredicate } from '~/utils/array'
import { IMSRepo } from '~/types'

/**
 * Manages all system non-default feature and pattern IDs.
 * Allows searching in reverse pattern matching.
 */
export class FeatureIdManagerService {
  private featureIds: string[] = []
  private patternIds: string[] = []

  constructor(private readonly msRepo: IMSRepo) {
    this.sync().catch((e) => {
      console.error('FeatureIdManagerService sync error:', e)
    })
  }

  async sync() {
    const featureOrPatternIds = await this.msRepo.getAllMocksKeys()

    const [patternIds, featureIds] = separateByPredicate(
      featureOrPatternIds,
      (e) => e.endsWith('*'),
    )

    this.featureIds = featureIds
    this.patternIds = patternIds
  }

  add(featureId: string) {
    if (featureId.endsWith('*')) {
      this.patternIds.push(featureId)
    } else {
      this.featureIds.push(featureId)
    }
  }

  remove(featureId: string) {
    if (featureId.endsWith('*')) {
      this.patternIds = this.patternIds.filter((e) => e !== featureId)
    } else {
      this.featureIds = this.featureIds.filter((e) => e !== featureId)
    }
  }

  /**
   * Searching by feature id to retrieve proper existing mock id.
   * Allows reverse pattern matching with next rules:
   *
   * 1. The perfect featureId match will be returned regardless of the existing patterns.
   * 2. If no perfect match is found, the first and shortest pattern that matches the featureId will be returned.
   */
  search(featureId: string): string | null {
    const perfectMatch = this.featureIds.find((e) => e === featureId)
    if (perfectMatch) {
      return perfectMatch
    }

    return (
      this.patternIds
        .filter((e) => new RegExp(e).test(featureId))
        .sort((a, b) => a.length - b.length)[0] || null
    )
  }
}
