import * as zlib from 'zlib'
import { describe, expect } from 'vitest'
import {
  bodyJSONParser,
  ParsingResultType,
} from '~/handlers/http/body-json-parser'

const specialTypes = [
  'application/pdf',
  'application/zip',
  'application/x-rar-compressed',
  'application/msword',
  'application/vnd.ms-excel',
  'application/javascript',
  'application/x-www-form-urlencoded',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/css',
  'text/csv',
  'text/xml',
  'text/plain',
  'video/mp4',
  'audio/mpeg',
]

describe('bodyJSONParser()', () => {
  describe('Request<>', () => {
    it('returns empty body for null input body', async () => {
      const expectedRes = { type: ParsingResultType.NO_BODY, size: 0 }

      expect(
        await bodyJSONParser(new Request('http://example.com', {})),
      ).toEqual(expectedRes)

      expect(
        await bodyJSONParser(new Request('http://example.com', { body: null })),
      ).toEqual(expectedRes)
    })

    it('returns MULTIPART type, meta and no body', async () => {
      const data = new FormData()

      data.append('key', 'value')
      data.append(
        'file',
        new Blob(['file content'], { type: 'text/plain' }),
        'filename.txt',
      )

      const mockRequest = new Request('http://example.com', {
        method: 'POST',
        headers: {
          'content-type': 'multipart/form-data',
          'content-length': '17',
        },
        body: new FormData(),
      })

      expect(await bodyJSONParser(mockRequest)).toEqual({
        contentType: 'multipart/form-data',
        type: ParsingResultType.MULTIPART,
        size: 17,
      })
    })

    it('returns HTML type, meta and no body', async () => {
      const mockRequest = new Request('http://example.com', {
        method: 'POST',
        headers: { 'content-type': 'text/html', 'content-length': '13' },
        body: new Blob(['<html></html>'], { type: 'text/html' }),
      })

      expect(await bodyJSONParser(mockRequest)).toEqual({
        contentType: 'text/html',
        type: ParsingResultType.HTML,
        size: 13,
      })
    })

    it('returns NOT_JSON and meta for non-JSON types', async () => {
      const expectedRes = {
        type: ParsingResultType.NOT_JSON,
        contentType: expect.any(String),
        size: 100,
      }

      for (const type of specialTypes) {
        expect(
          await bodyJSONParser(
            new Request('http://example.com', {
              method: 'POST',
              headers: { 'content-type': type, 'content-length': '100' },
              body: new Blob(['dummy content'], { type }),
            }),
          ),
        ).toEqual(expectedRes)
      }
    })

    it('returns TOO_BIG large content size', async () => {
      const largeContent = 'a'.repeat(11 * 1024 * 1024) // 11MB

      const mockRequest = new Request('http://example.com', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': largeContent.length.toString(),
        },
        body: new Blob([largeContent], { type: 'application/json' }),
      })

      expect(await bodyJSONParser(mockRequest)).toEqual({
        contentType: 'application/json',
        size: 11534336,
        type: ParsingResultType.TOO_BIG,
      })
    })

    it('handles gzip encoded content and parse JSON', async () => {
      const jsonContent = JSON.stringify({ key: 'value' })
      const compressedContent = zlib.gzipSync(jsonContent)

      const mockRequest = new Request('http://example.com', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': compressedContent.length.toString(),
          'content-encoding': 'gzip',
        },
        body: compressedContent,
      })

      expect(await bodyJSONParser(mockRequest)).toEqual({
        body: { key: 'value' },
        contentType: 'application/json',
        size: 35,
        type: ParsingResultType.JSON,
      })
    })

    it('handles deflate encoded content and parse JSON', async () => {
      const jsonContent = JSON.stringify({ key: 'value' })
      const compressedContent = zlib.deflateSync(jsonContent)

      const mockRequest = new Request('http://example.com', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': compressedContent.length.toString(),
          'content-encoding': 'deflate',
        },
        body: compressedContent,
      })

      expect(await bodyJSONParser(mockRequest)).toEqual({
        body: { key: 'value' },
        contentType: 'application/json',
        size: 23,
        type: ParsingResultType.JSON,
      })
    })

    it('handles brotli encoded content and parse JSON', async () => {
      const jsonContent = JSON.stringify({ key: 'value' })
      const compressedContent = zlib.brotliCompressSync(jsonContent)

      const mockRequest = new Request('http://example.com', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': compressedContent.length.toString(),
          'content-encoding': 'br',
        },
        body: compressedContent,
      })

      expect(await bodyJSONParser(mockRequest)).toEqual({
        body: { key: 'value' },
        contentType: 'application/json',
        size: 19,
        type: ParsingResultType.JSON,
      })
    })

    it('returns parsed JSON for JSON content', async () => {
      const mockRequest = new Request('http://example.com', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'value' }),
      })

      expect(await bodyJSONParser(mockRequest)).toEqual({
        body: { key: 'value' },
        contentType: 'application/json',
        size: 15,
        type: ParsingResultType.JSON,
      })
    })
  })

  describe('Response<>', () => {
    it('returns empty body for null input body', async () => {
      const expectedRes = { type: ParsingResultType.NO_BODY, size: 0 }

      expect(await bodyJSONParser(new Response(null))).toEqual(expectedRes)
    })

    it('returns MULTIPART type, meta and no body', async () => {
      const data = new FormData()

      data.append('key', 'value')
      data.append(
        'file',
        new Blob(['file content'], { type: 'text/plain' }),
        'filename.txt',
      )

      const mockResponse = new Response(data, {
        headers: {
          'content-type': 'multipart/form-data',
          'content-length': '17',
        },
      })

      expect(await bodyJSONParser(mockResponse)).toEqual({
        contentType: 'multipart/form-data',
        type: ParsingResultType.MULTIPART,
        size: 17,
      })
    })

    it('returns HTML type, meta and no body', async () => {
      const mockResponse = new Response('<html></html>', {
        headers: { 'content-type': 'text/html', 'content-length': '13' },
      })

      expect(await bodyJSONParser(mockResponse)).toEqual({
        contentType: 'text/html',
        type: ParsingResultType.HTML,
        size: 13,
      })
    })

    it('returns NOT_JSON and meta for non-JSON types', async () => {
      const expectedRes = {
        type: ParsingResultType.NOT_JSON,
        contentType: expect.any(String),
        size: 100,
      }

      for (const type of specialTypes) {
        expect(
          await bodyJSONParser(
            new Response('dummy content', {
              headers: { 'content-type': type, 'content-length': '100' },
            }),
          ),
        ).toEqual(expectedRes)
      }
    })

    it('returns TOO_BIG large content size', async () => {
      const largeContent = 'a'.repeat(11 * 1024 * 1024) // 11MB

      const mockResponse = new Response(largeContent, {
        headers: {
          'content-type': 'application/json',
          'content-length': largeContent.length.toString(),
        },
      })

      expect(await bodyJSONParser(mockResponse)).toEqual({
        contentType: 'application/json',
        size: 11534336,
        type: ParsingResultType.TOO_BIG,
      })
    })

    it('handles gzip encoded content and parse JSON', async () => {
      const jsonContent = JSON.stringify({ key: 'value' })
      const compressedContent = zlib.gzipSync(jsonContent)

      const mockResponse = new Response(compressedContent, {
        headers: {
          'content-type': 'application/json',
          'content-length': compressedContent.length.toString(),
          'content-encoding': 'gzip',
        },
      })

      expect(await bodyJSONParser(mockResponse)).toEqual({
        body: { key: 'value' },
        contentType: 'application/json',
        size: 35,
        type: ParsingResultType.JSON,
      })
    })

    it('handles deflate encoded content and parse JSON', async () => {
      const jsonContent = JSON.stringify({ key: 'value' })
      const compressedContent = zlib.deflateSync(jsonContent)

      const mockResponse = new Response(compressedContent, {
        headers: {
          'content-type': 'application/json',
          'content-length': compressedContent.length.toString(),
          'content-encoding': 'deflate',
        },
      })

      expect(await bodyJSONParser(mockResponse)).toEqual({
        body: { key: 'value' },
        contentType: 'application/json',
        size: 23,
        type: ParsingResultType.JSON,
      })
    })

    it('handles brotli encoded content and parse JSON', async () => {
      const jsonContent = JSON.stringify({ key: 'value' })
      const compressedContent = zlib.brotliCompressSync(jsonContent)

      const mockResponse = new Response(compressedContent, {
        headers: {
          'content-type': 'application/json',
          'content-length': compressedContent.length.toString(),
          'content-encoding': 'br',
        },
      })

      expect(await bodyJSONParser(mockResponse)).toEqual({
        body: { key: 'value' },
        contentType: 'application/json',
        size: 19,
        type: ParsingResultType.JSON,
      })
    })

    it('returns parsed JSON for JSON content', async () => {
      const mockResponse = new Response(JSON.stringify({ key: 'value' }), {
        headers: { 'content-type': 'application/json' },
      })

      expect(await bodyJSONParser(mockResponse)).toEqual({
        body: { key: 'value' },
        contentType: 'application/json',
        size: 15,
        type: ParsingResultType.JSON,
      })
    })
  })
})
