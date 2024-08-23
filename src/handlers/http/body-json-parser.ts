import { DefaultBodyType } from 'msw'
import * as stream from 'stream'
import * as zlib from 'zlib'

import { isFunction } from '~/utils/is'

const isBrotliSupported = isFunction(zlib.createBrotliDecompress)

const notJSONTypes = [
  /^image\/.*/,
  /^application\/(octet-stream|pdf|zip|x-rar-compressed|msword|vnd\.ms-excel|javascript|x-www-form-urlencoded)$/,
  /^application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)$/,
  /^text\/(css|csv|html|xml|plain)$/,
  /^video\/mp4$/,
  /^audio\/mpeg$/,
]

type ParseOptions = {
  sizeLimit?: number
}

const defaultOptions: Required<ParseOptions> = {
  sizeLimit: 10 * 1024 * 1024, // 10 MB
}

export enum ParsingResultType {
  NOT_JSON = 'NOT_JSON',
  NO_BODY = 'NO_BODY',
  TOO_BIG = 'TOO_BIG',
  HTML = 'HTML',
  STREAM = 'STREAM',
  MULTIPART = 'MULTIPART',
  TEXT = 'TEXT',
  JSON = 'JSON',
}

type ParsingResult<TBody extends DefaultBodyType> = {
  type: ParsingResultType
  body?: TBody | string
  contentType?: string
  size: number | null
}

export const bodyJSONParser = async <TBody extends DefaultBodyType>(
  input: Request | Response,
  options?: ParseOptions,
): Promise<ParsingResult<TBody>> => {
  const { sizeLimit } = { ...defaultOptions, ...(options || {}) }

  const isBodyEmpty = input.body === null || input.body === undefined

  if (isBodyEmpty) {
    return { type: ParsingResultType.NO_BODY, size: 0 }
  }

  const contentType = input.headers.get('content-type') || ''
  const encoding = input.headers.get('content-encoding')
  const contentLength = input.headers.get('content-length')
  const sizeFromContentLength = contentLength ? Number(contentLength) : null

  const meta: Pick<ParsingResult<TBody>, 'size' | 'contentType'> = {
    size: sizeFromContentLength,
    contentType,
  }

  try {
    if (/^multipart\/form-data/.test(contentType)) {
      return { type: ParsingResultType.MULTIPART, ...meta }
    }

    if (/^text\/html/.test(contentType)) {
      return { type: ParsingResultType.HTML, ...meta }
    }

    if (/stream/.test(contentType)) {
      return { type: ParsingResultType.STREAM, ...meta }
    }

    if (notJSONTypes.some((type) => type.test(contentType))) {
      return { type: ParsingResultType.NOT_JSON, ...meta }
    }

    if (sizeFromContentLength && sizeFromContentLength > sizeLimit) {
      return { type: ParsingResultType.TOO_BIG, ...meta }
    }

    const streams: (stream.Transform | any)[] = [input.body]

    switch (encoding) {
      case 'gzip':
      case 'compress':
      case 'deflate':
        streams.push(zlib.createUnzip())

        break
      case 'br':
        if (isBrotliSupported) {
          streams.push(zlib.createBrotliDecompress())
        }
    }

    const responseStream =
      streams.length > 1 ? stream.pipeline(streams, () => {}) : streams[0]

    const chunks: Buffer[] = []
    for await (const chunk of responseStream) {
      chunks.push(chunk)
    }

    const combinedBuffer = Buffer.concat(chunks)

    const bodyRaw = combinedBuffer.toString('utf-8')
    const bodySize = sizeFromContentLength || bodyRaw.length

    if (/^text\/plain/.test(contentType)) {
      return { type: ParsingResultType.TEXT, body: bodyRaw, ...meta }
    }

    try {
      return {
        type: ParsingResultType.JSON,
        body: JSON.parse(bodyRaw),
        ...meta,
        size: bodySize,
      }
    } catch (e) {
      return {
        type: ParsingResultType.NOT_JSON,
        body: bodyRaw,
        ...meta,
        size: bodySize,
      }
    }
  } catch (e) {
    return { type: ParsingResultType.NOT_JSON, ...meta }
  }
}
