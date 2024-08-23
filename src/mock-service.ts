import { Express } from 'express'
import { setupServer, SetupServerApi } from 'msw/node'
import { Emitter } from 'strict-event-emitter'

import { FeatureIdManagerService } from '~/core/feature-id-manager.service'
import { MSRepo } from '~/ms-repo'
import {
  IMockService,
  InitOptions,
  MSEvent,
  MSEventCommand,
  MSEventCommandToPayload,
  MSEventsMap,
  MSLifeCycleEventEmitter,
} from '~/types'

import { MSBlackListRequestService } from './black-list-request.service'
import { createRedisClient, MSRedis } from './db/redis'
import { MSHttpHandler } from './handlers/http'
import { MSDashboard } from './ms-dashboard'
import { MSExpressServe } from './serve/express'
import { loadMockingFiles } from './utils/load-files'

export class MockService implements IMockService {
  private readonly initializing: Promise<boolean>

  private redis!: MSRedis
  private redisSub!: MSRedis

  private mswServer!: SetupServerApi
  private mockRepo!: MSRepo
  private reqBlackList!: MSBlackListRequestService
  private readonly emitter: Emitter<MSEventsMap> = new Emitter<MSEventsMap>()

  public events: MSLifeCycleEventEmitter<MSEventsMap> =
    this.createLifeCycleEvents()
  public isEnabled = true

  private readonly msEventChannel = 'ms-events'

  private msDashboard!: MSDashboard
  private msHttpHandler!: MSHttpHandler
  private featureIdManager!: FeatureIdManagerService

  constructor(private readonly initOptions: InitOptions) {
    this.initializing = this.init()
  }

  private async init() {
    this.redis = await createRedisClient(this.initOptions.redis)
    this.redisSub = await createRedisClient(this.initOptions.redis)

    this.mswServer = setupServer()
    this.mockRepo = new MSRepo(this.redis)

    if (this.initOptions.filesPattern) {
      loadMockingFiles(this.initOptions.filesPattern)
    }

    this.msDashboard = new MSDashboard(this)
    this.msHttpHandler = new MSHttpHandler(this)
    this.reqBlackList = new MSBlackListRequestService(this)
    this.featureIdManager = new FeatureIdManagerService(this.mockRepo)

    this.mswServer.listen({ onUnhandledRequest: 'bypass' })

    this.subscribeOnMSEvents()

    this.emitter.on('mock:set', (payload) => {
      this.sendMSEventCommand({ command: 'MOCK-SET', payload }).catch((e) => {
        console.error('Failed to send mock set event', e)
      })
    })

    this.emitter.on('mock:drop', ({ id }) => {
      this.sendMSEventCommand({ command: 'MOCK-DROP', payload: { id } }).catch(
        (e) => {
          console.error('Failed to send mock drop event', e)
        },
      )
    })

    return true
  }

  getInitOptions(): InitOptions {
    return this.initOptions
  }

  waitUntilReady(): Promise<boolean> {
    return this.initializing
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

  getFeatureIdManager(): FeatureIdManagerService {
    return this.featureIdManager
  }

  getMockRepo(): MSRepo {
    return this.mockRepo
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
    await this.off()
    await this.redis.quit()
    await this.redisSub.quit()

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
    this.redisSub.subscribe(this.msEventChannel)
    this.redisSub.on('message', (channel, message) => {
      if (channel !== this.msEventChannel) {
        return
      }

      this.handleMSEventCommand(JSON.parse(message)).catch((e) => {
        console.error('Failed to handle ms event command', e)
      })
    })
  }

  private async sendMSEventCommand<T extends MSEventCommand>(
    event: MSEvent<T>,
  ) {
    await this.redis.publish(this.msEventChannel, JSON.stringify(event))
  }

  private async handleMSEventCommand<T extends keyof MSEventCommandToPayload>(
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
      case 'MOCK-SET':
        await this.featureIdManager.add(event.payload.id)
        break
      case 'MOCK-DROP':
        await this.featureIdManager.remove(event.payload.id)
        break
    }
  }
}
