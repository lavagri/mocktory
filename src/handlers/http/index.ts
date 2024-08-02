import { SetupServerApi } from 'msw/node'
import { http as mswHttp, HttpMethods, HttpResponse, passthrough } from 'msw'

import {
  IMockService,
  MSMockingPattern,
  MSMockPayloadMocking,
} from '~/types/ms.types'
import { MSWatcher } from '~/handlers/http/ms-watcher'
import { MSRequest } from '~/ms-request'
import { MSInMemHandlers } from '~/handlers/http/in-mem-handlers'
import { MSHttpResponse } from '~/handlers/http/response'

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

    // TODO: invert ifs/ get body only if necessary
    const reqBody = await msRequest.getBody()
    const reqQueryParams = msRequest.getQueryParams()
    const reqPathParams = msRequest.getPathParams()

    const composedKeyPattern = `ms:mocking:${featureId}*`
    const composedCountKeyPattern = `ms:mocking-count:${featureId}*`

    // TODO: better replace with scan?
    const [keys, countKeys] = await Promise.all([
      this.redisInstance.keys(composedKeyPattern),
      this.redisInstance.keys(composedCountKeyPattern),
    ])

    const mockingCounterRes = countKeys[0]
      ? await this.redisInstance.decr(countKeys[0])
      : 0

    if (mockingCounterRes < 0) {
      await Promise.all(
        [keys[0], countKeys[0]].map((k) => this.redisInstance.del(k)),
      )
    } else {
      const mockingBehaviourRaw = keys[0]
        ? await this.redisInstance.get(keys[0])
        : null
      const mockingBehaviour: MSMockPayloadMocking = mockingBehaviourRaw
        ? JSON.parse(mockingBehaviourRaw)
        : null

      if (mockingBehaviour) {
        if (mockingBehaviour.pattern === MSMockingPattern.MOCK) {
          this.MS.getEmitter().emit('request:match-custom-mock', {
            id: featureId,
            msRequest,
          })

          const msRes = new MSHttpResponse(
            mockingBehaviour.responseBody,
            (req) =>
              HttpResponse.json(
                MSHttpResponse.applyJSONBacking(
                  mockingBehaviour.responseBody,
                  req,
                ),
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

        if (mockingBehaviour.pattern === MSMockingPattern.PASSTHROUGH) {
          this.MS.getEmitter().emit('request:match-custom-passthrough', {
            id: featureId,
            msRequest,
          })

          return passthrough()
        }
      }
    }

    // 2. apply default mock patterns if exists
    const matchingReq = MSInMemHandlers.getMatchHandlers(
      msRequest.getURL(),
      msRequest.getMethod(),
    )

    if (matchingReq.length) {
      const matchHandler = matchingReq[0]

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

      return matchHandler.responseOrResolver.respond({
        body: reqBody,
        params: reqPathParams,
        query: reqQueryParams,
      })
    }

    this.MS.getEmitter().emit('request:passthrough', {
      id: featureId,
      msRequest,
    })

    return passthrough()
  }
}
