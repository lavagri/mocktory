import { delay } from 'msw'
import { randomInt } from 'crypto'
import { FakeHttpServer } from '../test/utils/fake-http-server'
import { MockService } from './index'
import { MSDashboard } from '~/ms-dashboard'

const httpServer = FakeHttpServer.createNew()

describe('MockService history', () => {
  const ms = new MockService({
    basePath: '/mock-service',
    redis: globalThis.redis,
  })
  let dash: MSDashboard

  beforeAll(async () => {
    await httpServer.listen()

    await ms.waitUntilReady()
    dash = ms.getDashboard()
  })

  afterAll(async () => {
    await ms.close()
    await httpServer.close()
  })

  describe('regular requests', () => {
    test('it should put it into history and retrieve', async () => {
      const uniquePath = '/history-test-path-' + randomInt(10000)
      const url = httpServer.getUrl() + uniquePath

      await fetch(url)

      await delay(100)
      const [history] = await dash.getMainHistoryFull()

      expect(history.length).toBeGreaterThanOrEqual(1)
      expect(
        history.find(
          ({ method, path }) => method === 'GET' && path === uniquePath,
        ),
      ).toBeTruthy()
    })
  })
})
