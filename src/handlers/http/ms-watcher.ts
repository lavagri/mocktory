import { MSRequest } from '~/ms-request'
import { bodyJSONParser } from '~/utils/body-json-parser'
import { config } from '~/const'
import { bytesToKilobytes } from '~/utils/math'
import { IMockService } from '~/types'
import { MSRedis } from '~/db/redis'

export class MSWatcher {
  private readonly redisInstance: MSRedis
  constructor(
    private readonly MS: IMockService,
    private readonly options: { requestAggKey?: () => string } = {},
  ) {
    this.redisInstance = this.MS.getRedisClient()
  }

  private getRequestAggKey() {
    return this.options.requestAggKey?.() || 'unknown'
  }

  async saveInHistory(msRequest: MSRequest): Promise<MSRequest> {
    if (this.MS.isBlackListedFeature(msRequest.getFeatureId())) {
      return msRequest
    }

    const key = this.getRequestAggKey()
    const composedKey = 'ms:watcher:' + key
    const content = await msRequest.toDefaultTrackableContent()

    await this.redisInstance.hset(
      composedKey,
      `${content.featureId}-${content.requestId}`,
      JSON.stringify(content),
    )
    await this.redisInstance.expire(composedKey, config.historyTTL_S)

    return msRequest
  }

  async saveResponse(
    msRequest: MSRequest,
    responseRaw: Response,
    isMockedResponse: boolean = false,
  ) {
    const composedResKey = 'ms:response:' + msRequest.getRequestId()
    const composedShortResKey = 'ms:response-short:' + msRequest.getRequestId()

    const { body, size } = await bodyJSONParser(responseRaw.clone())

    const msResponseJSON = {
      isMockedResponse: isMockedResponse,
      status: responseRaw.status,
      statusText: responseRaw.statusText,
      params: msRequest.getQueryParams(),
      body,
      size,
    }

    await this.redisInstance.set(composedResKey, JSON.stringify(msResponseJSON))
    await this.redisInstance.expire(composedResKey, config.historyTTL_S)

    const shortBodyKBThreshold = 200
    const shortBody =
      bytesToKilobytes(size || 0) > shortBodyKBThreshold
        ? '[Response too big]'
        : body

    await this.redisInstance.set(
      composedShortResKey,
      JSON.stringify({ ...msResponseJSON, body: shortBody }),
    )
    await this.redisInstance.expire(composedShortResKey, config.historyTTL_S)
  }
}
