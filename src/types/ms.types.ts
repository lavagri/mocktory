import { Express } from 'express'
import { type RedisOptions } from 'ioredis'
import { JsonBodyType } from 'msw'
import { SetupServerApi } from 'msw/node'
import { Readable } from 'stream'
import { Emitter } from 'strict-event-emitter'

import { FeatureIdManagerService } from '~/core/feature-id-manager.service'
import { MSRedis } from '~/db/redis'
import { MSHttpResponse } from '~/handlers/http/response'
import { MSLogger } from '~/ms-logger'
import { MSRepo } from '~/ms-repo'
import { MSRequest } from '~/ms-request'

import {
  MSTrackableRequestContent,
  MSTrackableRequestContentShort,
} from './ms-request.types'

export type InitOptions = {
  /**
   * Base path for serve MS routes
   */
  basePath: string

  /**
   * IORedis connection options
   */
  redis: RedisOptions

  // TODO: add request, params, cookies, headers, etc. in params
  /**
   * Request aggregation function to organize history records
   */
  requestAggKey?: () => string

  /**
   *  If specified, your files with default mocks will be loaded automatically
   *  @example '**\/*.mocking'
   */
  filesPattern?: string

  /**
   * If specified, intercepted requests will be filtered by this list before saving in history
   *
   * @example ['sqs.*amazonaws.com', 's3.*amazonaws.com']
   */
  reqBlacklist?: (string | RegExp)[]

  /**
   * If true, console logs will be used instead default event emitter
   */
  useConsoleLogger?: boolean
}

export interface IMSDashboard {
  getConfigDetailed(): { expiration: string }

  getMainHistoryFull(
    options?: GetMainHistoryFullOptions,
  ): Promise<MSTrackableRequestContent[][]>
  getMainHistoryShort(): Promise<MSTrackableRequestContentShort[][]>
  getResponseStream(requestId: string): Promise<Readable>
  removeHistory(): Promise<void>

  getMockingList(): Promise<MSMockingList>
  getMockStatusById(id: string): Promise<any>

  setMock(id: string, body: any): Promise<MSSetMockResponse>
  dropMock(id: string): Promise<void>

  reset(): Promise<void>
}

export type GetMainHistoryFullOptions = {
  sizeLimit?: number
}

export interface IMSRepo<TClient = MSRedis> {
  client: TClient
  getAllMocksKeys(): Promise<string[]>
}

export type MSSetMockResponse = { expiration: string; body: MSMockingPayload }

export type MSInMemHandlerStatus = {
  description?: string
  init?: ResponseInit
  responseBody?: MSHttpResponse['originalBody']
}

export type MSSetHandlerStatus = {
  description?: string
  pattern: MSMockingPattern
  count?: number | null
  init?: ResponseInit
  responseBody?: JsonBodyType
}

export type MSMockingList = {
  custom: {
    featureId: string
    mocking: MSInMemHandlerStatus
    defaultMocking: MSInMemHandlerStatus | '[Not found]'
  }[]
  default: {
    featureId: string
    mocking: MSInMemHandlerStatus
  }[]
}

export interface IMockService {
  isEnabled: boolean
  logger: MSLogger

  getRedisClient(): MSRedis
  getMSW(): SetupServerApi

  getDashboard(): IMSDashboard
  getMockRepo(): MSRepo
  getInitOptions(): InitOptions
  waitUntilReady(): Promise<boolean>
  getEmitter(): Emitter<MSEventsMap>
  getFeatureIdManager(): FeatureIdManagerService

  serveExpress(): Express

  getReqBlackList(): (string | RegExp)[]
  isBlackListedFeature(featureId: string): boolean
  setReqBlackList(list: (string | RegExp)[]): Promise<(string | RegExp)[]>

  close(): Promise<boolean>
  off(): Promise<boolean>
  on(): Promise<boolean>
}

export enum MSMockingPattern {
  MOCK = 'MOCK',
  PASSTHROUGH = 'PASSTHROUGH',
}

type MSBaseMockPayload = {
  pattern: MSMockingPattern
  count?: number
}

export type MSMockPayloadMocking<T extends JsonBodyType = JsonBodyType> =
  MSBaseMockPayload & {
    pattern: MSMockingPattern.MOCK
    init?: ResponseInit
    responseBody?: T
  }

export type MSMockPayloadPassthrough = MSBaseMockPayload & {
  pattern: MSMockingPattern.PASSTHROUGH
}

export type MSMockingPayload = MSMockPayloadMocking | MSMockPayloadPassthrough

export type MSEventsMap = {
  'mock:set': [args: { id: string; body: MSMockingPayload; mockTTL: number }]
  'mock:drop': [args: { id: string; isBlackListed: boolean }]
  'mock:drop-all': []

  'request:intercepted': [args: { requestId: string; msRequest: MSRequest }]
  'request:match-custom-mock': [args: { id: string; msRequest: MSRequest }]
  'request:match-custom-passthrough': [
    args: { id: string; msRequest: MSRequest },
  ]
  'request:match-default': [args: { id: string; msRequest: MSRequest }]
  'request:passthrough': [args: { id: string; msRequest: MSRequest }]

  error: [Error | unknown]
}

export type MSLifeCycleEventEmitter<
  EventsMap extends Record<string | symbol, any>,
> = Pick<Emitter<EventsMap>, 'on' | 'removeListener' | 'removeAllListeners'>

type NoPayloadCommands = 'ON' | 'OFF'
type NoPayloadCommandToPayload = {
  [Command in NoPayloadCommands]: never
}

type PayloadCommands = 'BL-SET' | 'MOCK-SET' | 'MOCK-DROP'
type PayloadCommandToPayload = {
  'BL-SET': MSBlSettingsRaw
  'MOCK-SET': MSMockSetRaw
  'MOCK-DROP': { id: string }
}

export type MSEventCommand = NoPayloadCommands | PayloadCommands
export type MSEventCommandToPayload = NoPayloadCommandToPayload &
  PayloadCommandToPayload

export type MSEvent<T extends MSEventCommand> = T extends NoPayloadCommands
  ? { command: T; payload?: MSEventCommandToPayload[T] }
  : { command: T; payload: MSEventCommandToPayload[T] }

export type MSBlSettings = {
  default: (string | RegExp)[]
  active: (string | RegExp)[]
}

export type MSBlSettingsRaw = {
  default: (string | { __isRegExp: true; source: string })[]
  active: (string | { __isRegExp: true; source: string })[]
}

export type MSMockSetRaw = {
  id: string
  body: MSMockingPayload
  mockTTL: number
}
