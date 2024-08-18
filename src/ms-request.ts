import { DefaultBodyType, StrictRequest } from 'msw'
import { bodyJSONParser } from '~/handlers/http/body-json-parser'
import { IdResolver } from '~/id-resolver'
import { MSTrackableRequestContent } from '~/types/ms-request.types'

export class MSRequest<TBody extends DefaultBodyType = DefaultBodyType> {
  private order: number = 1

  constructor(
    private readonly request: StrictRequest<TBody>,
    private readonly requestId: string,
  ) {}

  getAPIId(): string {
    return IdResolver.resolveAPIId(this.getURLHost())
  }
  getFeatureId(): string {
    return IdResolver.resolveFeatureId(
      this.getURLHost(),
      this.getMethod(),
      this.getPath(),
    )
  }

  getRequest(): StrictRequest<TBody> {
    return this.request
  }

  getRequestId(): string {
    return this.requestId
  }

  getURLHost(): string {
    return new URL(this.request.url).host
  }

  getPath(): string {
    return new URL(this.request.url).pathname
  }

  getURL(): URL {
    return new URL(this.request.url)
  }

  getMethod(): string {
    return this.request.method
  }

  async getBody(): Promise<TBody | string | undefined> {
    return bodyJSONParser<TBody>(this.request.clone()).then((res) => res.body)
  }

  getPathParams(): Record<string, any> {
    // TODO: cast to path params object, if we know URL structure
    return {}
  }

  getQueryParams(): Record<string, any> {
    const urlObj = new URL(this.getURL())
    const params = new URLSearchParams(urlObj.search)
    const queryParams: Record<string, any> = {}

    for (const [key, value] of params.entries()) {
      queryParams[key] = value
    }

    return queryParams
  }

  setOrder(order: number) {
    this.order = order
  }

  async toDefaultTrackableContent(): Promise<MSTrackableRequestContent> {
    return {
      apiId: this.getAPIId(),
      featureId: this.getFeatureId(),
      path: this.getPath(),
      method: this.getMethod(),
      date: new Date().toISOString(),
      requestId: this.requestId,
      body: await this.getBody(),
      order: this.order,
    }
  }
}
