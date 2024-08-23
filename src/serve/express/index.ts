import bodyParser from 'body-parser'
import express, { Express } from 'express'

import { DashboardRoutes } from '~/serve/express/routes/dashboard.routes'
import { DocsRoutes } from '~/serve/express/routes/docs'
import { MockingRoutes } from '~/serve/express/routes/mocking.routes'
import { IMockService } from '~/types'

export class MSExpressServe<TServe = Express> {
  constructor(private readonly MS: IMockService) {}

  serve(): TServe {
    const app = express()

    app.use(bodyParser.json())
    app.use(express.json())
    app.use(express.urlencoded({ extended: false }))

    const handlers = [DashboardRoutes, MockingRoutes, DocsRoutes]

    handlers.forEach((handler) =>
      app.use(this.MS.getInitOptions().basePath, handler(this.MS)),
    )

    // TODO: add self-serving option

    return app as TServe
  }
}
