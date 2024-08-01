import { Router } from 'express'

import { IMockService } from '~/types'

export const MockingRoutes: any = (MS: IMockService) => {
  const router = Router()

  router.get('/mock/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      if (!id) {
        throw new Error('Provide feature id in request params')
      }

      const result = await MS.getDashboard().getMockStatusById(id)
      return res.json(result)
    } catch (e) {
      return next(e)
    }
  })

  router.post('/mock/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      if (!id) {
        throw new Error('Provide feature id in request params')
      }

      const body = req.body

      const result = await MS.getDashboard().setMock(id, body)
      return res.json({ result })
    } catch (e) {
      return next(e)
    }
  })

  router.delete('/mock/:id', async (req, res, next) => {
    try {
      const { id } = req.params
      if (!id) {
        throw new Error('Provide feature id in request params')
      }

      const result = await MS.getDashboard().dropMock(id)
      return res.json({ result })
    } catch (e) {
      return next(e)
    }
  })

  return router
}
