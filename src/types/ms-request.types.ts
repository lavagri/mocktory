import { DefaultBodyType } from 'msw'

export type MSTrackableRequestContent = {
  apiId: string
  featureId: string
  path: string
  method: string
  date: string
  requestId: string
  body: DefaultBodyType
  order: number

  response?: any
}

export type MSTrackableRequestContentShort = {
  apiId: string
  featureId: string
  date: string
  order: number
}
