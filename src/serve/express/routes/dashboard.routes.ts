import { Router } from 'express'
import { StatusCodes } from 'http-status-codes'

import { GetMainHistoryFullOptions, IMockService } from '~/types'

export const DashboardRoutes: any = (MS: IMockService) => {
  const router = Router()

  router.get('/history', async (req, res, next) => {
    try {
      const history = await MS.getDashboard().getMainHistoryShort()
      const config = MS.getDashboard().getConfigDetailed()

      return res.json({ config, history })
    } catch (e) {
      return next(e)
    }
  })

  router.get<unknown, unknown, unknown, GetMainHistoryFullOptions>(
    '/history-detailed',
    async (req, res, next) => {
      try {
        const queryParams = req.query

        const history = await MS.getDashboard().getMainHistoryFull(queryParams)

        const config = MS.getDashboard().getConfigDetailed()

        return res.json({ config, history })
      } catch (e) {
        return next(e)
      }
    },
  )

  router.delete('/history', async (req, res, next) => {
    try {
      await MS.getDashboard().removeHistory()
      return res.json(true)
    } catch (e) {
      return next(e)
    }
  })

  router.get('/history/response/:requestId', async (req, res, next) => {
    try {
      const { requestId } = req.params
      if (!requestId) {
        throw new Error('Provide request id in request params')
      }

      const responseStream =
        await MS.getDashboard().getResponseStream(requestId)

      res.setHeader('Content-Type', 'application/json')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="response-${requestId}.json"`,
      )

      return responseStream.pipe(res)
    } catch (e) {
      return next(e)
    }
  })

  router.put('/mocks/reset', async (req, res, next) => {
    try {
      const result = await MS.getDashboard().reset()
      return res.json(result)
    } catch (e) {
      return next(e)
    }
  })

  router.put('/settings/off', async (req, res, next) => {
    try {
      const result = await MS.off()
      return res.json(result)
    } catch (e) {
      return next(e)
    }
  })

  router.put('/settings/on', async (req, res, next) => {
    try {
      const result = await MS.on()
      return res.json(result)
    } catch (e) {
      return next(e)
    }
  })

  router.get('/settings/req-blacklist', async (req, res, next) => {
    try {
      const result = MS.getReqBlackList()

      return res.json(result.map(String))
    } catch (e) {
      return next(e)
    }
  })

  router.put('/settings/req-blacklist', async (req, res, next) => {
    try {
      const list = req.body as string[]

      if (!Array.isArray(list)) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ error: 'List should be an array' })
      }

      const convertToRegExpIfPossible = (item: string): string | RegExp => {
        if (item.startsWith('/') && item.endsWith('/')) {
          try {
            return new RegExp(item.slice(1, -1))
          } catch (e) {
            return item
          }
        } else {
          return item
        }
      }

      const result = await MS.setReqBlackList(
        list.map(convertToRegExpIfPossible),
      )
      return res.json(result.map(String))
    } catch (e) {
      return next(e)
    }
  })

  router.get('/mocks/list', async (req, res, next) => {
    try {
      const result = await MS.getDashboard().getMockingList()
      return res.json(result)
    } catch (e) {
      return next(e)
    }
  })

  return router
}
