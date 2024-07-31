import {
  DefaultBodyType,
  HttpMethods,
  HttpResponse,
  HttpResponseInit,
  JsonBodyType,
  Path,
  PathParams,
} from 'msw'

import { IdResolver } from '~/id-resolver'
import { MSHttpResponse } from '~/handlers/http/response'
import {
  MSHttpResponseResolver,
  RespondDefaultJSONBacking,
} from '~/types/ms-response.types'
import {
  MSInMemHandlerOptions,
  MSInMemHandlers,
} from '~/handlers/http/in-mem-handlers'
import { NoInfer } from 'msw/lib/core/typeUtils'

export type MSHttpRequestHandler = <
  Params extends PathParams<keyof Params> = PathParams,
  RequestBodyType extends DefaultBodyType = DefaultBodyType,
  // Response body type MUST be undefined by default to enforce a stricter response body type.
  ResponseBodyType extends DefaultBodyType = undefined,
  RequestPath extends Path = Path,
>(
  path: RequestPath,
  responseOrResolver:
    | MSHttpResponse<
        [ResponseBodyType] extends [undefined] ? any : ResponseBodyType
      >
    | MSHttpResponseResolver<Params, RequestBodyType, ResponseBodyType>,
  options?: MSInMemHandlerOptions,
) => void

const createHttpHandler = (
  domainURL: string,
  method: string,
): MSHttpRequestHandler => {
  return (path, responseOrResolver, options) => {
    if (!domainURL) {
      // TODO: raise dev warning
      return
    }

    const featureId = IdResolver.resolveFeatureId(domainURL, method, path)

    if (
      responseOrResolver instanceof MSHttpResponse ||
      typeof responseOrResolver === 'function'
    ) {
      MSInMemHandlers.set(
        featureId,
        method,
        domainURL + path,
        responseOrResolver,
        options,
      )
    }

    // TODO: raise dev warning
  }
}

export const http = {
  setup(domainUrl: string) {
    // TODO: add ability for resolver to provide templating `hint` for end-user.
    return {
      get: createHttpHandler(domainUrl, HttpMethods.GET),
      post: createHttpHandler(domainUrl, HttpMethods.POST),
      put: createHttpHandler(domainUrl, HttpMethods.PUT),
      patch: createHttpHandler(domainUrl, HttpMethods.PATCH),
      delete: createHttpHandler(domainUrl, HttpMethods.DELETE),
    }
  },

  responseJSON<BodyType extends JsonBodyType>(
    body?: NoInfer<BodyType>,
    options?: {
      init?: HttpResponseInit
      defaultBackingObj?: Partial<RespondDefaultJSONBacking>
    },
  ): MSHttpResponse<BodyType> {
    return new MSHttpResponse(
      body,
      (req) =>
        HttpResponse.json<BodyType>(
          MSHttpResponse.applyJSONBacking(
            body,
            req,
            options?.defaultBackingObj,
          ),
          options?.init,
        ),
      options,
    )
  },

  responseText<BodyType extends string>(
    body?: NoInfer<BodyType>,
    options?: {
      init?: HttpResponseInit
      defaultBackingObj?: Partial<RespondDefaultJSONBacking>
    },
  ): MSHttpResponse<BodyType> {
    return new MSHttpResponse(
      body,
      () => HttpResponse.text(body, options?.init),
      options,
    )
  },
}
