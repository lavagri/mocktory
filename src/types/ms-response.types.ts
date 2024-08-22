import {
  AsyncResponseResolverReturnType,
  DefaultBodyType,
  HttpResponse as MSWHttpResponse,
  JsonBodyType,
  PathParams,
} from 'msw'

import { MSRequest } from '~/ms-request'

export type RespondJSONReqParams = {
  body: JsonBodyType
  query: JsonBodyType
  params: JsonBodyType
}

export type RespondDefaultJSONBacking = {
  requestBody: Record<string, any>
  requestQuery: Record<string, any>
  requestParams: Record<string, any>
}

export type MSHttpResponseResolver<
  Params extends PathParams<keyof Params> = PathParams,
  RequestBodyType extends DefaultBodyType = DefaultBodyType,
  ResponseBodyType extends DefaultBodyType = DefaultBodyType,
> = MSResponseResolver<RequestBodyType, ResponseBodyType>

export type MSResponseResolver<
  RequestBodyType extends DefaultBodyType = DefaultBodyType,
  ResponseBodyType extends DefaultBodyType = undefined,
> = (info: {
  request: MSRequest<RequestBodyType>
}) => AsyncResponseResolverReturnType<ResponseBodyType>

export class HttpResponse extends MSWHttpResponse {}
