import { HttpMethods, Path } from 'msw'

const MethodTypeToFeatureName: Record<string, string> = {
  GET: 'GET',
  POST: 'CREATE',
  PUT: 'UPDATE',
  DELETE: 'DELETE',
  PATCH: 'MODIFY',
  HEAD: 'INSPECT',
  OPTIONS: 'OPTIONS',
}

export class IdResolver {
  private static delimiter = '-'
  private static featurePathDelimiter = '-'

  static setDelimiter(delimiter: string): void {
    IdResolver.delimiter = delimiter
  }

  setFeaturePathDelimiter(delimiter: string): void {
    IdResolver.featurePathDelimiter = delimiter
  }

  static resolveAPIId(urlHost: string): string {
    return urlHost
      .replaceAll('https://', '')
      .replaceAll('http://', '')
      .toLowerCase()
  }

  static resolvePathId(path: string): string {
    return path
      .replace(/^\/|\/$/g, '')
      .replaceAll('/', IdResolver.featurePathDelimiter)
  }

  static resolveFeatureId(
    urlHost: string,
    methodName: HttpMethods | string,
    path: Path,
  ): string {
    const apiId = IdResolver.resolveAPIId(urlHost)
    const featureMethod = MethodTypeToFeatureName[methodName] || methodName
    const featurePath = IdResolver.resolvePathId(
      typeof path === 'string' ? path : path.source,
    )

    return [featureMethod, apiId, featurePath].join(IdResolver.delimiter)
  }
}
