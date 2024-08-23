import { StatusCodes } from 'http-status-codes'
import { Readable } from 'stream'

import { config } from '~/const'
import { MSInMemHandler, MSInMemHandlers } from '~/core/in-mem-handlers'
import { MSHttpResponse } from '~/handlers/http/response'
import {
  GetMainHistoryFullOptions,
  IMockService,
  IMSDashboard,
  MSInMemHandlerStatus,
  MSMockingList,
  MSMockingPattern,
  MSMockingPayload,
  MSSetHandlerStatus,
  MSSetMockResponse,
  MSTrackableRequestContent,
  MSTrackableRequestContentShort,
} from '~/types'
import { secToMinHuman } from '~/utils/time'

/**
 * Tracking & overview mocking system status
 */
export class MSDashboard implements IMSDashboard {
  constructor(
    private readonly MS: IMockService,
    // TODO: replace redis calls to repo completely
    private readonly redisInstance = MS.getRedisClient(),
    private readonly repo = MS.getMockRepo(),
  ) {}

  getConfigDetailed() {
    return {
      expiration: secToMinHuman(config.mockTTL_S),
    }
  }

  async getMainHistoryFull(
    options: GetMainHistoryFullOptions = {},
  ): Promise<MSTrackableRequestContent[][]> {
    const responseBodySizeLimitKB = options.sizeLimit || 100

    const recordsRaw = await this.redisInstance.getDetailedReqHistory(
      '0',
      'ms:watcher:*',
      'ms:response-short:',
      'ms:response-meta:',
      responseBodySizeLimitKB,
    )
    const records: Record<
      string,
      Record<string, MSTrackableRequestContent>
    > = JSON.parse(recordsRaw)

    const sortDateDesc = (
      a: MSTrackableRequestContent,
      b: MSTrackableRequestContent,
    ) => new Date(b.date).getTime() - new Date(a.date).getTime()

    const getMockDescription = (
      content: MSTrackableRequestContent,
    ): string | null => {
      const inMemHandler = MSInMemHandlers.getHandlerById(content.featureId)
      return inMemHandler?.options?.description || null
    }

    const mapRes = (content: MSTrackableRequestContent) => {
      const description = getMockDescription(content)

      return {
        ...(description && { description }),
        ...content,
        response: JSON.parse(content.response) || '[No response]',
      }
    }
    return Object.keys(records)
      .reduce(
        (acc, key: string) => [
          ...acc,
          Object.values(records[key]).sort(sortDateDesc).map(mapRes),
        ],
        [] as MSTrackableRequestContent[][],
      )
      .sort((a, b) => sortDateDesc(a[0], b[0]))
  }

  async getMainHistoryShort(): Promise<MSTrackableRequestContentShort[][]> {
    const records = await this.getMainHistoryFull()

    return records.map((requestFlowContents) =>
      requestFlowContents.map((content) => ({
        apiId: content.apiId,
        featureId: content.featureId,
        date: content.date,
        order: content.order,
      })),
    )
  }

  async getResponseStream(requestId: string): Promise<Readable> {
    const key = `ms:response:${requestId}`

    const value = await this.redisInstance.get(key)

    if (!value) {
      throw new Error('RequestId not found')
    }

    return new Readable({
      read() {
        this.push(value)
        this.push(null)
      },
    })
  }

  async removeHistory(): Promise<void> {
    const watchKeys = await this.redisInstance.getKeysByPattern(
      '0',
      'ms:watcher:*',
    )

    if (watchKeys.length > 0) {
      await this.redisInstance.del(...watchKeys)
    }
  }

  async getMockingList(): Promise<MSMockingList> {
    if (!this.MS.isEnabled) {
      throw new Error('Mocking service is disabled. Please enable it first.')
    }

    const composedKey = 'ms:mocking:*'

    const keys = await this.redisInstance.getKeysByPattern('0', composedKey)
    const mockingPatternsRaw = await Promise.all(
      keys.map((key: string) => this.redisInstance.get(key)),
    )

    const keysWithoutPrefix = (k: string) => k.replace('ms:mocking:', '')
    const getInMemHandlerInfo = (
      handler: MSInMemHandler,
    ): MSInMemHandlerStatus => {
      const options = handler.options || {}
      const isContainDirectResponse =
        handler.responseOrResolver instanceof MSHttpResponse

      if (!isContainDirectResponse) {
        return { description: 'Custom method resolver for mocking.' }
      }

      const response = handler.responseOrResolver as MSHttpResponse

      return {
        ...(options.description && {
          description: handler.options?.description,
        }),
        init: response.options?.init || { status: StatusCodes.OK },
        responseBody: response.originalBody,
      }
    }
    const getSetHandlerInfo = (
      handler: MSMockingPayload,
    ): MSSetHandlerStatus => {
      if (handler.pattern === MSMockingPattern.PASSTHROUGH) {
        return {
          pattern: handler.pattern,
          count: handler.count,
        }
      }

      return {
        pattern: handler.pattern,
        count: handler.count,
        init: handler.init || { status: StatusCodes.OK },
        responseBody: handler.responseBody,
      }
    }

    const customMockingRes = mockingPatternsRaw
      .filter(Boolean)
      .map((mockingPatternRaw: any) => JSON.parse(mockingPatternRaw!))

    return {
      custom: customMockingRes.map((m: MSMockingPayload, i: number) => {
        const defaultHandler = MSInMemHandlers.getHandlerById(
          keysWithoutPrefix(keys[i]),
        )
        return {
          featureId: keysWithoutPrefix(keys[i]),
          mocking: getSetHandlerInfo(m),
          defaultMocking: defaultHandler
            ? getInMemHandlerInfo(defaultHandler)
            : '[Not found]',
        }
      }),
      default: MSInMemHandlers.defaultHandlers.map((h) => ({
        featureId: h.id,
        mocking: getInMemHandlerInfo(h),
      })),
    }
  }

  async getMockStatusById(id: string): Promise<any> {
    if (!this.MS.isEnabled) {
      throw new Error('Mocking service is disabled. Please enable it first.')
    }

    const composedKey = 'ms:mocking:' + id

    const mockingKeys = await this.redisInstance.getKeysByPattern(
      '0',
      composedKey,
    )

    const mockingRaw = await this.redisInstance.get(mockingKeys[0])
    const mocking: MSMockingPayload | null = mockingRaw
      ? JSON.parse(mockingRaw)
      : null

    const defaultMocking = MSInMemHandlers.getHandlerById(id)

    return {
      id,
      mocking: {
        custom: mocking,
        default: defaultMocking,
      },
    }
  }

  // TODO: move from this class
  async setMock(
    id: string,
    body: MSMockingPayload,
  ): Promise<MSSetMockResponse> {
    if (!this.MS.isEnabled) {
      throw new Error('Mocking service is disabled. Please enable it first.')
    }

    const { mockTTL } = await this.repo.setMock(id, body)

    this.MS.getEmitter().emit('mock:set', { id, body, mockTTL })

    return { expiration: secToMinHuman(mockTTL), body }
  }

  // TODO: move from this class
  async dropMock(id: string): Promise<any> {
    if (!this.MS.isEnabled) {
      throw new Error('Mocking service is disabled. Please enable it first.')
    }

    const composedKey = 'ms:mocking:' + id

    await this.redisInstance.del(composedKey)

    this.MS.getEmitter().emit('mock:drop', { id })

    return true
  }

  async reset(): Promise<any> {
    if (!this.MS.isEnabled) {
      throw new Error('Mocking service is disabled. Please enable it first.')
    }

    const composedKey = 'ms:mocking:*'

    const mockKeys = await this.redisInstance.getKeysByPattern('0', composedKey)

    if (!mockKeys || !mockKeys.length) {
      return false
    }

    // Drop all mocks
    await Promise.all(
      mockKeys
        .map((key: string) => key.replace('ms:mocking:', ''))
        .map((key: string) => this.dropMock(key)),
    )

    // Drop all history and other keys
    const keys = await this.redisInstance.getKeysByPattern('0', `ms:*`)
    if (keys.length > 0) {
      await this.redisInstance.del(...keys)
    }

    return true
  }
}
