import { vitest } from 'vitest'
import { FakeHttpServer } from '../test/utils/fake-http-server'
import { MockService } from '~/mock-service'
import { MSDashboard } from '~/ms-dashboard'
import {
  HttpResponse,
  MSMockingPattern,
  MSMockingPayload,
  MSMockPayloadMocking,
} from '~/types'
import { http } from '~/handlers/http/ms-register-handler'
import { MSInMemHandlers } from '~/core/in-mem-handlers'
import { MSRequest } from '~/ms-request'

const httpServer = FakeHttpServer.createNew()

describe('MockService', () => {
  const ms = new MockService({
    basePath: '/mock-service',
    redis: globalThis.redis,
  })

  let dash: MSDashboard

  const multiTypeBody = {
    nameStr: 'test-name',
    boolValue: true,
    count: 123,
    date: new Date().toISOString(),
  }

  beforeAll(async () => {
    await httpServer.listen()

    await ms.waitUntilReady()
    dash = ms.getDashboard()
  })

  afterAll(async () => {
    await ms.close()
    await httpServer.close()
  })

  describe('apply MOCK pattern', () => {
    const path = '/test-mock-path'

    const url = httpServer.getUrl() + path
    const featureIdGET = httpServer.getFeatureId(path)
    const featureIdPOST = httpServer.getFeatureId(path, 'POST')

    afterEach(async () => {
      await dash.dropMock(featureIdGET)
      await dash.dropMock(featureIdPOST)
    })

    test('mocking success body response', async () => {
      const mockBody: MSMockPayloadMocking<object> = {
        pattern: MSMockingPattern.MOCK,
        responseBody: multiTypeBody,
      }

      await dash.setMock(featureIdGET, mockBody)
      const fetchRes = await fetch(url)
      const response = await fetchRes.json()

      expect(response).toMatchObject(mockBody.responseBody!)
    })

    test('mocking success with reverse pattern matching', async () => {
      const mockBody: MSMockPayloadMocking<object> = {
        pattern: MSMockingPattern.MOCK,
        responseBody: multiTypeBody,
      }

      const pattern = featureIdGET.slice(0, -5) + '*'

      await dash.setMock(pattern, mockBody)

      const fetchRes = await fetch(url)
      const response = await fetchRes.json()

      expect(response).toMatchObject(mockBody.responseBody!)
      await dash.dropMock(pattern)
    })

    test('success response with null', async () => {
      const mockBody: MSMockingPayload = {
        pattern: MSMockingPattern.MOCK,
        responseBody: null,
      }

      await dash.setMock(featureIdGET, mockBody)
      const fetchRes = await fetch(url)
      const response = await fetchRes.json()

      expect(response).toEqual(null)
    })

    test('success response with array', async () => {
      const mockBody: MSMockingPayload = {
        pattern: MSMockingPattern.MOCK,
        responseBody: [multiTypeBody, multiTypeBody],
      }

      await dash.setMock(featureIdGET, mockBody)
      const fetchRes = await fetch(url)
      const response = await fetchRes.json()

      expect(response).toEqual([multiTypeBody, multiTypeBody])
    })

    test('success response with body templating', async () => {
      const mockBody: MSMockingPayload = {
        pattern: MSMockingPattern.MOCK,
        responseBody: {
          count: '{{requestBody.count}}',
          nameStr: '{{requestBody.nameStr}}',
          boolValue: '{{requestBody.boolValue}}',
          date: '{{requestBody.date}}',
          isMockResponse: true,
          unknownVar: '{{requestBody.unknownVar}}',
        },
      }

      await dash.setMock(featureIdPOST, mockBody)
      const fetchRes = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(multiTypeBody),
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await fetchRes.json()

      expect(response).toMatchObject({
        count: 123,
        nameStr: 'test-name',
        boolValue: true,
        date: multiTypeBody.date.toString(),
        isMockResponse: true,
        unknownVar: null,
      })
    })

    test('failure response', async () => {
      const mockBody: MSMockPayloadMocking<object> = {
        pattern: MSMockingPattern.MOCK,
        init: {
          status: 501,
        },
        responseBody: {
          message: 'Failure message text',
        },
      }

      await dash.setMock(featureIdGET, mockBody)
      const fetchRes = await fetch(url)
      const response = await fetchRes.json()

      expect(response).toMatchObject(mockBody.responseBody!)
      expect(response).toMatchObject(mockBody.responseBody!)
    })

    test('failure response with body templating', async () => {
      const mockBody: MSMockingPayload = {
        pattern: MSMockingPattern.MOCK,
        init: {
          status: 400,
        },
        responseBody: {
          count: '{{requestBody.count}}',
          nameStr: '{{requestBody.nameStr}}',
          boolValue: '{{requestBody.boolValue}}',
          date: '{{requestBody.date}}',
          unknownVar: '{{requestBody.unknownVar}}',
          message: 'Failure message text',
        },
      }

      await dash.setMock(featureIdPOST, mockBody)
      const fetchRes = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(multiTypeBody),
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await fetchRes.json()

      expect(response).toMatchObject({
        count: 123,
        nameStr: 'test-name',
        boolValue: true,
        date: multiTypeBody.date.toString(),
        unknownVar: null,
        message: 'Failure message text',
      })
    })
  })

  describe('Default mocking', () => {
    const path = '/test-default-path'
    const featureIdGET = httpServer.getFeatureId(path)
    const featureIdPOST = httpServer.getFeatureId(path, 'POST')

    const url = httpServer.getUrl() + path
    const api = http.setup(httpServer.getUrl())

    afterEach(async () => {
      MSInMemHandlers.remove(featureIdGET)
      MSInMemHandlers.remove(featureIdPOST)

      await dash.dropMock(featureIdGET)
      await dash.dropMock(featureIdPOST)
    })

    test('default success response', async () => {
      const getPayload = { ...multiTypeBody, method: 'GET' }

      api.get(path, http.responseJSON(getPayload))

      const fetchGETRes = await fetch(url)
      const getResponse = await fetchGETRes.json()

      expect(getResponse).toMatchObject(getPayload)
    })

    test('default success response with resolver', async () => {
      const spyGET = vitest.fn()

      const getPayload = { ...multiTypeBody, method: 'GET' }

      api.get(path, (params) => {
        spyGET(params)
        return HttpResponse.json(getPayload)
      })

      const fetchGETRes = await fetch(url)

      const getResponse = await fetchGETRes.json()

      expect(getResponse).toMatchObject(getPayload)
      expect(spyGET.mock.calls[0][0].request instanceof MSRequest).toEqual(true)
    })

    test('default success response with body templating', async () => {
      api.post(
        path,
        http.responseJSON([
          {
            count: '{{requestBody.count}}',
            nameStr: '{{requestBody.nameStr}}',
            boolValue: '{{requestBody.boolValue}}',
            date: '{{requestBody.date}}',
            isMockResponse: true,
            unknownVar: '{{requestBody.unknownVar}}',
          },
        ]),
      )

      const fetchPOSTRes = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(multiTypeBody),
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await fetchPOSTRes.json()

      expect(response).toMatchObject([
        {
          count: 123,
          nameStr: 'test-name',
          boolValue: true,
          date: multiTypeBody.date.toString(),
          isMockResponse: true,
          unknownVar: null,
        },
      ])
    })

    test('default failure response', async () => {
      const getPayload = { message: 'Failure message text' }

      api.get(path, http.responseJSON(getPayload, { init: { status: 503 } }))

      const fetchGETRes = await fetch(url)
      const getResponse = await fetchGETRes.json()

      expect(fetchGETRes.status).toEqual(503)
      expect(getResponse).toMatchObject(getPayload)
    })

    test('default failure response with body templating', async () => {
      api.post(
        path,
        http.responseJSON(
          {
            count: '{{requestBody.count}}',
            nameStr: '{{requestBody.nameStr}}',
            boolValue: '{{requestBody.boolValue}}',
            date: '{{requestBody.date}}',
            unknownVar: '{{requestBody.unknownVar}}',
            message: 'Failure message text',
          },
          { init: { status: 400 } },
        ),
      )

      const fetchPOSTRes = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(multiTypeBody),
        headers: { 'Content-Type': 'application/json' },
      })
      const getResponse = await fetchPOSTRes.json()

      expect(fetchPOSTRes.status).toEqual(400)
      expect(getResponse).toMatchObject({
        count: 123,
        nameStr: 'test-name',
        boolValue: true,
        date: multiTypeBody.date.toString(),
        unknownVar: null,
        message: 'Failure message text',
      })
    })

    test('default failure response with body templating and default backing', async () => {
      api.post(
        path,
        http.responseJSON(
          {
            count: '{{requestBody.count}}',
            nameStr: '{{requestBody.nameStr}}',
            boolValue: '{{requestBody.boolValue}}',
            date: '{{requestBody.date}}',
            unknownVar: '{{requestBody.unknownVar}}',
            message: 'Failure message text',
          },
          {
            init: { status: 400 },
            defaultBackingObj: {
              requestBody: {
                unknownVar: '123',
              },
            },
          },
        ),
      )

      const fetchPOSTRes = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(multiTypeBody),
        headers: { 'Content-Type': 'application/json' },
      })
      const getResponse = await fetchPOSTRes.json()

      expect(fetchPOSTRes.status).toEqual(400)
      expect(getResponse).toMatchObject({
        count: 123,
        nameStr: 'test-name',
        boolValue: true,
        date: multiTypeBody.date.toString(),
        unknownVar: '123',
        message: 'Failure message text',
      })
    })

    test('default response override from body templating and defaultBackingObj', async () => {
      api.post(
        path,
        http.responseJSON(
          { name: '{{requestBody.name}}' },
          { defaultBackingObj: { requestBody: { name: 'default-mock' } } },
        ),
      )

      const fetchPOSTRes = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ name: 'Custom' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const getResponse = await fetchPOSTRes.json()

      expect(fetchPOSTRes.status).toEqual(200)
      expect(getResponse).toMatchObject({ name: 'Custom' })
    })

    test('success response overrides failure default', async () => {
      const getPayload = { ...multiTypeBody, method: 'GET' }

      api.get(
        path,
        http.responseJSON(
          { message: 'Failure text message' },
          { init: { status: 503 } },
        ),
      )

      await dash.setMock(featureIdGET, {
        pattern: MSMockingPattern.MOCK,
        responseBody: getPayload,
      })

      const fetchGETRes = await fetch(url)
      const getResponse = await fetchGETRes.json()

      expect(fetchGETRes.status).toEqual(200)
      expect(getResponse).toMatchObject(getPayload)
    })

    test('success response overrides success default', async () => {
      const getPayload = { ...multiTypeBody, method: 'GET' }

      api.get(path, http.responseJSON(getPayload))

      await dash.setMock(featureIdGET, {
        pattern: MSMockingPattern.MOCK,
        responseBody: { message: 'Custom response' },
      })

      const fetchGETRes = await fetch(url)
      const getResponse = await fetchGETRes.json()

      expect(fetchGETRes.status).toEqual(200)
      expect(getResponse).toMatchObject({ message: 'Custom response' })
    })

    test('failure response overrides success default', async () => {
      const getPayload = { ...multiTypeBody, method: 'GET' }

      api.get(path, http.responseJSON(getPayload))

      await dash.setMock(featureIdGET, {
        pattern: MSMockingPattern.MOCK,
        responseBody: { message: 'Custom failure response' },
        init: { status: 419 },
      })

      const fetchGETRes = await fetch(url)
      const getResponse = await fetchGETRes.json()

      expect(fetchGETRes.status).toEqual(419)
      expect(getResponse).toMatchObject({ message: 'Custom failure response' })
    })

    test('failure response overrides failure default', async () => {
      const getPayload = { ...multiTypeBody, method: 'GET' }

      api.get(path, http.responseJSON(getPayload, { init: { status: 400 } }))

      await dash.setMock(featureIdGET, {
        pattern: MSMockingPattern.MOCK,
        responseBody: { message: 'Custom failure response' },
        init: { status: 503 },
      })

      const fetchGETRes = await fetch(url)
      const getResponse = await fetchGETRes.json()

      expect(fetchGETRes.status).toEqual(503)
      expect(getResponse).toMatchObject({ message: 'Custom failure response' })
    })
  })

  describe('Mocking count', () => {
    const path = '/test-count-path'
    const featureIdGET = httpServer.getFeatureId(path)
    const featureIdPOST = httpServer.getFeatureId(path, 'POST')

    const url = httpServer.getUrl() + path
    const api = http.setup(httpServer.getUrl())

    afterEach(async () => {
      MSInMemHandlers.remove(featureIdGET)
      MSInMemHandlers.remove(featureIdPOST)

      await dash.dropMock(featureIdGET)
      await dash.dropMock(featureIdPOST)
    })

    test('success response count', async () => {
      await dash.setMock(featureIdGET, {
        pattern: MSMockingPattern.MOCK,
        responseBody: 'Custom Response',
        count: 2,
      })

      const fetchGETRes1 = await fetch(url)
      const getResponse1 = await fetchGETRes1.text()

      const fetchGETRes2 = await fetch(url)
      const getResponse2 = await fetchGETRes2.text()

      const fetchGETRes3 = await fetch(url)
      const getResponse3 = await fetchGETRes3.text()

      expect(getResponse1).toEqual('"Custom Response"')
      expect(getResponse2).toEqual('"Custom Response"')
      expect(getResponse3).toEqual('"Real response"')
    })

    test('failure response count exceed, and then success default applied', async () => {
      const getPayload = multiTypeBody

      api.get(path, http.responseJSON(getPayload))

      await dash.setMock(featureIdGET, {
        pattern: MSMockingPattern.MOCK,
        responseBody: { message: 'Custom Response' },
        count: 2,
      })

      const fetchGETRes1 = await fetch(url)
      const getResponse1 = await fetchGETRes1.json()

      const fetchGETRes2 = await fetch(url)
      const getResponse2 = await fetchGETRes2.json()

      const fetchGETRes3 = await fetch(url)
      const getResponse3 = await fetchGETRes3.json()

      expect(getResponse1).toMatchObject({ message: 'Custom Response' })
      expect(getResponse2).toMatchObject({ message: 'Custom Response' })
      expect(getResponse3).toMatchObject(getPayload)
    })
  })

  // TODO: add test for parallel mocking of same API (same feature id) - right now order mock not working
})
