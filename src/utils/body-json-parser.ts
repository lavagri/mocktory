import { DefaultBodyType } from 'msw'
import * as zlib from 'zlib'
import * as stream from 'stream'

import { isFunction } from '~/utils/is'

const isBrotliSupported = isFunction(zlib.createBrotliDecompress)

const nonJSONifiableTypes = [
  /^image\/.*/,
  /^application\/(octet-stream|pdf|zip|x-rar-compressed|msword|vnd\.ms-excel|javascript|x-www-form-urlencoded)$/,
  /^application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)$/,
  /^text\/(css|csv|html|xml|plain)$/,
  /^video\/mp4$/,
  /^audio\/mpeg$/,
]

export const bodyJSONParser = async <TBody extends DefaultBodyType>(
  input: Request | Response,
): Promise<{ size: number | null; body: TBody | string }> => {
  const isBodyEmpty = input.body === null || input.body === undefined

  if (isBodyEmpty) {
    return { body: '[Empty body]', size: 0 }
  }

  const contentType = input.headers.get('content-type') || ''
  const encoding = input.headers.get('content-encoding')
  const contentLength = input.headers.get('content-length')
  const sizeFromContentLength = contentLength ? Number(contentLength) : null

  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  const contentLengthThreshold10MB = 10 * 1024 * 1024

  try {
    if (/^multipart\/form-data/.test(contentType)) {
      return { body: '[Multipart form data]', size: sizeFromContentLength }
    }

    if (/^text\/html/.test(contentType)) {
      return { body: '[HTML content]', size: sizeFromContentLength }
    }

    if (/stream/.test(contentType)) {
      return { body: '[Stream content]', size: sizeFromContentLength }
    }

    if (nonJSONifiableTypes.some((type) => type.test(contentType))) {
      return {
        body: `[Special content: ${contentType}]`,
        size: sizeFromContentLength,
      }
    }

    if (
      sizeFromContentLength &&
      sizeFromContentLength > contentLengthThreshold10MB
    ) {
      return { body: '[Response too big]', size: sizeFromContentLength }
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
      return { body: bodyRaw, size: bodySize }
    }

    try {
      return { body: JSON.parse(bodyRaw), size: bodySize }
    } catch (e) {
      return { body: bodyRaw, size: bodySize }
    }
  } catch (e) {
    return {
      body: `[Unknown body, unable to parse from ${contentType || 'unknown content type'}]`,
      size: 0,
    }
  }
}
