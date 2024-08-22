import { matchRequestUrl } from 'msw'
import { MSHttpResponseResolver } from '~/types/ms-response.types'
import { MSHttpResponse } from '~/handlers/http/response'

export type MSInMemHandler = {
  id: string
  method: string
  url: string
  responseOrResolver: MSHttpResponse<any> | MSHttpResponseResolver | undefined
  options?: MSInMemHandlerOptions
}

export type MSInMemHandlerOptions = {
  /**
   * Use it to provide short meaningful description for current mock
   */
  description?: string
}

export class MSInMemHandlers {
  static defaultHandlers: MSInMemHandler[] = []

  static set(
    id: string,
    method: string,
    url: string,
    responseOrResolver:
      | MSHttpResponse<any>
      | MSHttpResponseResolver<any, any, any>
      | undefined,
    options?: MSInMemHandlerOptions,
  ) {
    MSInMemHandlers.defaultHandlers.push({
      id,
      method,
      url,
      responseOrResolver,
      options,
    })
  }

  static remove(id: string): void {
    MSInMemHandlers.defaultHandlers = MSInMemHandlers.defaultHandlers.filter(
      (e) => e.id !== id,
    )
  }

  static getMatchHandlers(url: URL, method: string): MSInMemHandler[] {
    return MSInMemHandlers.defaultHandlers.filter(
      (e) => matchRequestUrl(url, e.url).matches && e.method === method,
    )
  }

  static getHandlerById(id: string): MSInMemHandler | null {
    const isPrefixSearch = id.endsWith('*')
    const prefix = id.slice(0, -1)

    return (
      MSInMemHandlers.defaultHandlers.find((e) =>
        isPrefixSearch ? e.id.startsWith(prefix) : e.id === id,
      ) || null
    )
  }
}
