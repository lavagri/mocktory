import http from 'http'
import { IdResolver } from '~/id-resolver'

export class FakeHttpServer {
  private readonly httpServer: http.Server
  private readonly defaultPort = 8181

  private readonly expectedStatusCode = 200
  private readonly expectedResponse = 'Real response'

  constructor() {
    this.httpServer = http.createServer(async (req, res) => {
      res.writeHead(this.expectedStatusCode).end(this.expectedResponse)
    })
  }

  static createNew(): FakeHttpServer {
    return new FakeHttpServer()
  }

  async listen() {
    return new Promise((resolve) => {
      this.httpServer.listen(this.defaultPort, () => {
        resolve(true)
      })

      this.httpServer.on('error', (err) => {
        console.error(err)
      })
    })
  }

  getUrl() {
    return `http://localhost:${this.defaultPort}`
  }

  getFeatureId(path: string, method = 'GET') {
    return IdResolver.resolveFeatureId(this.getUrl(), method, path)
  }

  async close() {
    return this.httpServer.close()
  }
}
