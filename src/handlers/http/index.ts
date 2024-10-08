import { http as mswHttp, HttpMethods, HttpResponse, passthrough } from 'msw'
import { SetupServerApi } from 'msw/node'

import { MSInMemHandler, MSInMemHandlers } from '~/core/in-mem-handlers'
import { MSWatcher } from '~/handlers/http/ms-watcher'
import { MSHttpResponse } from '~/handlers/http/response'
import { MSRequest } from '~/ms-request'
import {
  IMockService,
  MSMockingPattern,
  MSMockingPayload,
} from '~/types/ms.types'

export class MSHttpHandler {
  private readonly msHttpWatcher: MSWatcher

  private readonly observableHttpMethods: string[] = [
    HttpMethods.GET,
    HttpMethods.POST,
    HttpMethods.PUT,
    HttpMethods.DELETE,
    HttpMethods.PATCH,
  ]

  constructor(
    private readonly MS: IMockService,
    private readonly mswServer: SetupServerApi = MS.getMSW(),
    private readonly redisInstance = MS.getRedisClient(),
  ) {
    this.handle()

    this.msHttpWatcher = new MSWatcher(this.MS, {
      requestAggKey: this.MS.getInitOptions().requestAggKey,
    })
  }

  handle() {
    this.mswServer.use(
      mswHttp.all('*', async ({ request, requestId }) => {
        try {
          if (!this.MS.isEnabled) {
            return passthrough()
          }

          const msRequest = new MSRequest(request, requestId)

          if (!this.isRequestObservable(msRequest)) {
            return passthrough()
          }

          this.MS.getEmitter().emit('request:intercepted', {
            requestId,
            url: request.url,
          })

          const msRequestWithWatchMeta =
            await this.msHttpWatcher.saveInHistory(msRequest)

          return await this.applyMockPattern(msRequestWithWatchMeta)
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('MSHttpHandler: http error', e)
          return passthrough()
        }
      }),
    )

    this.mswServer.events.on(
      'response:mocked',
      async ({ requestId, response, request }) => {
        try {
          if (!this.MS.isEnabled) {
            return
          }

          const msRequest = new MSRequest(request, requestId)

          if (!this.isRequestObservable(msRequest)) {
            return
          }

          await this.msHttpWatcher.saveResponse(
            msRequest,
            response.clone(),
            true,
          )
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('MSHttpHandler: response:mocked error', e)
        }
      },
    )

    this.mswServer.events.on(
      'response:bypass',
      async ({ requestId, response, request }) => {
        try {
          if (!this.MS.isEnabled) {
            return
          }

          const msRequest = new MSRequest(request, requestId)

          if (!this.isRequestObservable(msRequest)) {
            return
          }

          await this.msHttpWatcher.saveResponse(msRequest, response.clone())
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('MSHttpHandler: response:bypass error', e)
        }
      },
    )
  }

  private isRequestObservable(msRequest: MSRequest): boolean {
    const method = msRequest.getMethod()

    return this.observableHttpMethods.includes(method)
  }

  // TODO: fix returning type
  private async applyMockPattern(msRequest: MSRequest): Promise<any> {
    const featureId = msRequest.getFeatureId()

    const customMockId = await this.MS.getFeatureIdManager().search(featureId)

    if (customMockId) {
      const isRestrictedWithCounter = await this.redisInstance.get(
        `ms:mocking-count:${customMockId}`,
      )

      if (!isRestrictedWithCounter) {
        return this.handleCustomMock(customMockId, msRequest)
      }

      const countMockDecr = await this.redisInstance.decr(
        `ms:mocking-count:${customMockId}`,
      )

      if (countMockDecr >= 0) {
        return this.handleCustomMock(customMockId, msRequest)
      } else {
        await Promise.all(
          [
            `ms:mocking:${customMockId}`,
            `ms:mocking-count:${customMockId}`,
          ].map((k) => this.redisInstance.del(k)),
        )
      }
    }

    const matchingReq = MSInMemHandlers.getMatchHandlers(
      msRequest.getURL(),
      msRequest.getMethod(),
    )

    if (matchingReq.length) {
      return this.handleDefaultMock(matchingReq, msRequest)
    }

    this.MS.getEmitter().emit('request:passthrough', {
      id: featureId,
      msRequest,
    })

    return passthrough()
  }

  private async handleCustomMock(customMockId: string, msRequest: MSRequest) {
    const featureId = msRequest.getFeatureId()

    const mockRaw = await this.redisInstance.get(`ms:mocking:${customMockId}`)

    const mockingBehaviour: MSMockingPayload = mockRaw
      ? JSON.parse(mockRaw)
      : null

    if (!mockingBehaviour) {
      return
    }

    if (mockingBehaviour.pattern === MSMockingPattern.PASSTHROUGH) {
      this.MS.getEmitter().emit('request:match-custom-passthrough', {
        id: featureId,
        msRequest,
      })

      return passthrough()
    }

    if (mockingBehaviour.pattern === MSMockingPattern.MOCK) {
      const reqBody = await msRequest.getBody()
      const reqQueryParams = msRequest.getQueryParams()
      const reqPathParams = msRequest.getPathParams()

      this.MS.getEmitter().emit('request:match-custom-mock', {
        id: featureId,
        msRequest,
      })

      const msRes = new MSHttpResponse(
        mockingBehaviour.responseBody,
        (req) =>
          HttpResponse.json(
            MSHttpResponse.applyJSONBacking(mockingBehaviour.responseBody, req),
            mockingBehaviour.init,
          ),
        { init: mockingBehaviour.init },
      )

      return msRes.respond({
        body: reqBody,
        params: reqPathParams,
        query: reqQueryParams,
      })
    }
  }

  private async handleDefaultMock(
    matchingHandlers: MSInMemHandler[],
    msRequest: MSRequest,
  ) {
    const featureId = msRequest.getFeatureId()

    const matchHandler = matchingHandlers[0]

    this.MS.getEmitter().emit('request:match-default', {
      id: featureId,
      msRequest,
    })

    // TODO: case when mock set as `undefined` || `null` ?
    if (!matchHandler.responseOrResolver) {
      return HttpResponse.json(matchHandler.responseOrResolver)
    }

    if (typeof matchHandler.responseOrResolver === 'function') {
      return matchHandler.responseOrResolver({ request: msRequest })
    }

    const reqBody = await msRequest.getBody()
    const reqQueryParams = msRequest.getQueryParams()
    const reqPathParams = msRequest.getPathParams()

    return matchHandler.responseOrResolver.respond({
      body: reqBody,
      params: reqPathParams,
      query: reqQueryParams,
    })
  }
}
