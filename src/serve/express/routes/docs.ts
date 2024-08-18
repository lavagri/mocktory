import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import { Router } from 'express'
import swaggerUi, { SwaggerUiOptions } from 'swagger-ui-express'

import { IMockService } from '~/types'

const libDocsPath = [__dirname, 'openapi.yaml']
const defaultDocsPath = [process.cwd(), 'docs/openapi.yaml']

const file = fs.readFileSync(
  path.resolve(
    ...(process.env.TEST === 'true' ? defaultDocsPath : libDocsPath),
  ),
  'utf8',
)
const swaggerDocument = YAML.parse(file)

export const DocsRoutes: any = (MS: IMockService) => {
  const router = Router()

  router.use('/docs', swaggerUi.serve)
  router.get(
    '/docs',
    swaggerUi.setup(swaggerDocument, {
      basePath: MS.getInitOptions().basePath,
    } as SwaggerUiOptions),
  )

  return router
}
