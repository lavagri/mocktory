import { FakeHttpServer } from './utils/fake-http-server'

let teardown = false

export default async function () {
  const server = FakeHttpServer.createNew()

  await server.listen()

  return async () => {
    if (teardown) {
      throw new Error('teardown called twice')
    }
    teardown = true

    await server.close()
  }
}
