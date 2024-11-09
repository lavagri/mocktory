import {
  DefaultBodyType,
  http as mswHttp,
  HttpMethods,
  HttpResponse,
  passthrough,
  StrictRequest,
} from 'msw'
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
          if (!this.MS.isEnabled || !this.isRequestObservable(request)) {
            return passthrough()
          }

          const msRequest = new MSRequest(request, requestId)

          const isBlackListReq = this.MS.isBlackListedFeature(
            msRequest.getFeatureId(),
          )

          if (!isBlackListReq) {
            this.MS.logger.info('request:intercepted', {
              requestId,
              msRequest,
            })

            this.msHttpWatcher
              .saveInHistory(msRequest)
              .catch((err) => this.MS.logger.error(err))
          }

          return await this.applyMockPattern(msRequest)
        } catch (err) {
          this.MS.logger.error(err)
          return passthrough()
        }
      }),
    )

    this.mswServer.events.on(
      'response:mocked',
      async ({ requestId, response, request }) => {
        try {
          if (!this.MS.isEnabled || !this.isRequestObservable(request)) {
            return passthrough()
          }

          const msRequest = new MSRequest(request, requestId)
          const isBlackListReq = this.MS.isBlackListedFeature(
            msRequest.getFeatureId(),
          )

          if (!isBlackListReq) {
            await this.msHttpWatcher.saveResponse(
              msRequest,
              response.clone(),
              true,
            )
          }
        } catch (err) {
          this.MS.logger.error(err)
        }
      },
    )

    this.mswServer.events.on(
      'response:bypass',
      async ({ requestId, response, request }) => {
        try {
          if (!this.MS.isEnabled || !this.isRequestObservable(request)) {
            return passthrough()
          }

          const msRequest = new MSRequest(request, requestId)
          const isBlackListReq = this.MS.isBlackListedFeature(
            msRequest.getFeatureId(),
          )

          if (!isBlackListReq) {
            await this.msHttpWatcher.saveResponse(msRequest, response.clone())
          }
        } catch (err) {
          this.MS.logger.error(err)
        }
      },
    )
  }

  private isRequestObservable(
    request: StrictRequest<DefaultBodyType>,
  ): boolean {
    const method = request.method

    return this.observableHttpMethods.includes(method)
  }

  // TODO: fix returning type
  private async applyMockPattern(msRequest: MSRequest): Promise<any> {
    const featureId = msRequest.getFeatureId()
    const isBlackListReq = this.MS.isBlackListedFeature(featureId)

    const customMockId = await this.MS.getFeatureIdManager().search(featureId)

    if (customMockId) {
      const isCounterAllowedToRun = await this.handleMockCounter(customMockId)

      if (isCounterAllowedToRun) {
        const mockingBehaviour =
          await this.MS.getMockRepo().getMockById(customMockId)

        if (mockingBehaviour) {
          return this.handleCustomMock(mockingBehaviour, msRequest)
        }

        await this.MS.getDashboard().dropMock(customMockId)
      }
    }

    const matchingReq = MSInMemHandlers.getMatchHandlers(
      msRequest.getURL(),
      msRequest.getMethod(),
    )

    if (matchingReq.length) {
      return this.handleDefaultMock(matchingReq, msRequest)
    }

    if (!isBlackListReq) {
      this.MS.logger.info('request:passthrough', {
        id: featureId,
        msRequest,
      })
    }

    return passthrough()
  }

  private async handleMockCounter(customMockId: string): Promise<boolean> {
    const isRestrictedWithCounter = await this.redisInstance.get(
      `ms:mocking-count:${customMockId}`,
    )

    if (!isRestrictedWithCounter) {
      return true
    }

    const countMockDecr = await this.redisInstance.decr(
      `ms:mocking-count:${customMockId}`,
    )

    if (countMockDecr >= 0) {
      return true
    }

    await this.MS.getDashboard().dropMock(customMockId)
    return false
  }

  private async handleCustomMock(
    mockingBehaviour: MSMockingPayload,
    msRequest: MSRequest,
  ) {
    const featureId = msRequest.getFeatureId()
    const isBlackListReq = this.MS.isBlackListedFeature(featureId)

    if (!mockingBehaviour) {
      return
    }

    if (mockingBehaviour.pattern === MSMockingPattern.PASSTHROUGH) {
      if (!isBlackListReq) {
        this.MS.logger.info('request:match-custom-passthrough', {
          id: featureId,
          msRequest,
        })
      }

      return passthrough()
    }

    if (mockingBehaviour.pattern === MSMockingPattern.MOCK) {
      const reqBody = await msRequest.getBody()
      const reqQueryParams = msRequest.getQueryParams()
      const reqPathParams = msRequest.getPathParams()

      if (!isBlackListReq) {
        this.MS.logger.info('request:match-custom-mock', {
          id: featureId,
          msRequest,
        })
      }

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
    const isBlackListReq = this.MS.isBlackListedFeature(featureId)
    const matchHandler = matchingHandlers[0]

    if (!isBlackListReq) {
      this.MS.logger.info('request:match-default', {
        id: featureId,
        msRequest,
      })
    }

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
