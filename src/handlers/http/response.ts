import {
  AsyncResponseResolverReturnType,
  DefaultBodyType,
  JsonBodyType,
} from 'msw'

import {
  RespondDefaultJSONBacking,
  RespondJSONReqParams,
} from '~/types/ms-response.types'
import { applyTemplate } from '~/utils/json-template'

export class MSHttpResponse<TBody extends DefaultBodyType = undefined> {
  constructor(
    readonly originalBody: any,
    readonly respondConstructor: (
      params: RespondJSONReqParams,
    ) => AsyncResponseResolverReturnType<TBody>,
    readonly options?: { init?: ResponseInit },
  ) {}

  static applyJSONBacking<TResponseJSON extends JsonBodyType>(
    body: TResponseJSON,
    backingParams?: RespondJSONReqParams,
    defaultBackingObj: Partial<RespondDefaultJSONBacking> = {},
  ): TResponseJSON {
    const getBackingParam = (data: JsonBodyType, defaultObj?: object) =>
      typeof data === 'object' ? { ...(defaultObj || {}), ...data } : {}

    const bodyCopy = structuredClone(body)

    return applyTemplate(bodyCopy, {
      requestBody: getBackingParam(
        backingParams?.body,
        defaultBackingObj.requestBody,
      ),
      requestQuery: getBackingParam(
        backingParams?.query,
        defaultBackingObj.requestQuery,
      ),
      requestParams: getBackingParam(
        backingParams?.params,
        defaultBackingObj.requestParams,
      ),
    })
  }

  respond(
    requestParams: RespondJSONReqParams,
  ): AsyncResponseResolverReturnType<TBody> {
    return this.respondConstructor(requestParams)
  }
}
