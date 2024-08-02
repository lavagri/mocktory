import { Express } from 'express'
import { setupServer, SetupServerApi } from 'msw/node'
import { Emitter } from 'strict-event-emitter'

import { createRedisClient, MSRedis } from './db/redis'
import { MSDashboard } from './ms-dashboard'
import {
  IMockService,
  InitOptions,
  MSEventsMap,
  MSLifeCycleEventEmitter,
  MSEvent,
  MSEventCommandToPayload,
  MSEventCommand,
} from '~/types'
import { MSExpressServe } from './serve/express'
import { loadMockingFiles } from './utils/load-files'
import { MSHttpHandler } from './handlers/http'
import { MSBlackListRequestService } from './black-list-request.service'

export class MockService implements IMockService {
  private readonly redis: MSRedis
  private readonly mswServer: SetupServerApi
  private readonly reqBlackList: MSBlackListRequestService
  private readonly emitter: Emitter<MSEventsMap> = new Emitter<MSEventsMap>()

  public events: MSLifeCycleEventEmitter<MSEventsMap> =
    this.createLifeCycleEvents()
  public isEnabled = true

  private readonly msEventChannel = 'ms-events'

  private readonly msDashboard: MSDashboard
  private readonly msHttpHandler: MSHttpHandler

  constructor(private readonly initOptions: InitOptions) {
    this.redis = createRedisClient(initOptions.redis)

    this.mswServer = setupServer()

    if (initOptions.filesPattern) {
      loadMockingFiles(initOptions.filesPattern)
    }

    this.msDashboard = new MSDashboard(this)
    this.msHttpHandler = new MSHttpHandler(this)
    this.reqBlackList = new MSBlackListRequestService(this)

    this.mswServer.listen({ onUnhandledRequest: 'bypass' })

    this.subscribeOnMSEvents()
  }

  getInitOptions(): InitOptions {
    return this.initOptions
  }

  serveExpress(): Express {
    return new MSExpressServe(this).serve()
  }

  getDashboard(): MSDashboard {
    return this.msDashboard
  }

  getEmitter(): Emitter<MSEventsMap> {
    return this.emitter
  }

  getRedisClient(): MSRedis {
    return this.redis
  }

  getMSW(): SetupServerApi {
    return this.mswServer
  }

  getReqBlackList(): (string | RegExp)[] {
    return this.reqBlackList.getActiveList()
  }

  isBlackListedFeature(featureId: string): boolean {
    return this.getReqBlackList().some((rule) => {
      if (rule instanceof RegExp) {
        return rule.test(featureId)
      }

      return rule === featureId
    })
  }

  async setReqBlackList(
    list: (string | RegExp)[],
  ): Promise<(string | RegExp)[]> {
    const res = await this.reqBlackList.putReqBlackListSettings(list)

    return res.active
  }

  async close() {
    this.redis.disconnect()
    return true
  }

  async off() {
    this.isEnabled = false

    await this.sendMSEventCommand({ command: 'OFF' })
    return true
  }

  async on() {
    this.isEnabled = true

    await this.sendMSEventCommand({ command: 'ON' })
    return true
  }

  private createLifeCycleEvents(): MSLifeCycleEventEmitter<MSEventsMap> {
    return {
      on: (...args: any[]) => {
        return (this.emitter.on as any)(...args)
      },
      removeListener: (...args: any[]) => {
        return (this.emitter.removeListener as any)(...args)
      },
      removeAllListeners: (...args: any[]) => {
        return this.emitter.removeAllListeners(...args)
      },
    }
  }

  private subscribeOnMSEvents() {
    const redisSub = createRedisClient(this.initOptions.redis)

    redisSub.subscribe(this.msEventChannel)
    redisSub.on('message', (channel, message) => {
      if (channel !== this.msEventChannel) {
        return
      }

      this.handleMSEventCommand(JSON.parse(message))
    })
  }

  private async sendMSEventCommand<T extends MSEventCommand>(
    event: MSEvent<T>,
  ) {
    await this.redis.publish(this.msEventChannel, JSON.stringify(event))
  }

  private handleMSEventCommand<T extends keyof MSEventCommandToPayload>(
    event: MSEvent<T>,
  ) {
    switch (event.command) {
      case 'ON':
        this.isEnabled = true
        break
      case 'OFF':
        this.isEnabled = false
        break
      case 'BL-SET':
        this.reqBlackList.syncActiveListFromRaw(event.payload)
        break
    }
  }
}
