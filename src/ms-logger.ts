/* eslint-disable no-console */
import { Emitter } from 'strict-event-emitter'

import { MSEventsMap } from '~/types'

export interface MSLogger {
  info<TKey extends keyof MSEventsMap>(
    action: TKey,
    ...data: MSEventsMap[TKey]
  ): void

  error(err: Error | unknown): void
}

export class MSConsoleLogger implements MSLogger {
  info<TKey extends keyof MSEventsMap>(
    action: TKey,
    ...data: MSEventsMap[TKey]
  ): void {
    if (data.length) {
      console.debug(`[ms.${action}]`, 'with data:', ...data)
    } else {
      console.debug(`[ms.${action}]`)
    }
  }

  error(err: Error | unknown) {
    console.error(err)
  }
}

export class MSEventLogger implements MSLogger {
  constructor(private readonly emitter: Emitter<MSEventsMap>) {}

  info<TKey extends keyof MSEventsMap>(
    action: TKey,
    ...data: MSEventsMap[TKey]
  ): void {
    this.emitter.emit(action, ...data)
  }

  error(err: Error | unknown) {
    this.emitter.emit('error', err)
  }
}
