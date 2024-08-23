import { IMockService, MSBlSettings, MSBlSettingsRaw } from '~/types'
import { isEqualContent } from '~/utils/array'

export class MSBlackListRequestService {
  private readonly msSettingsBLKey = 'ms:settings:blacklist'

  private activeList: (string | RegExp)[] = []

  constructor(private readonly MS: IMockService) {
    const optionsBlackList = this.MS.getInitOptions().reqBlacklist

    // eslint-disable-next-line no-console
    this.renewDefaultReqBlackList(optionsBlackList).catch(console.error)
  }

  getActiveList(): (string | RegExp)[] {
    return this.activeList
  }

  syncActiveListFromRaw(raw: MSBlSettingsRaw): (string | RegExp)[] {
    this.activeList = this.deserializeReqBlackList(raw).active

    return this.activeList
  }

  async renewDefaultReqBlackList(fromList: (string | RegExp)[] = []) {
    const settings = await this.getReqBlackListSettings()
    this.activeList = settings.active || fromList

    if (!fromList) {
      return
    }

    const optionsList = fromList

    if (!settings || !settings.active.length || !settings.default.length) {
      await this.putReqBlackListSettings(optionsList, optionsList)
    }

    const [defaultForCompare, optionsListForCompare] = [
      settings.default,
      optionsList,
    ].map((list) =>
      list.map((item) => (item instanceof RegExp ? item.source : item)),
    )

    if (isEqualContent(defaultForCompare, optionsListForCompare)) {
      return
    }

    const newActiveList = [...new Set([...settings.active, ...optionsList])]
    await this.putReqBlackListSettings(newActiveList, optionsList)
  }

  async getReqBlackListSettings(): Promise<MSBlSettings> {
    const settingsRaw = await this.MS.getRedisClient().get(this.msSettingsBLKey)

    if (!settingsRaw) {
      return { default: [], active: [] }
    }

    const settingsParsed: MSBlSettingsRaw = JSON.parse(settingsRaw)

    return this.deserializeReqBlackList(settingsParsed)
  }

  async putReqBlackListSettings(
    list: (string | RegExp)[],
    defaultList?: (string | RegExp)[],
  ) {
    const existing = await this.getReqBlackListSettings()
    const obj = { active: list, default: defaultList || existing.default }

    const serializedData = this.serializeReqBlackList(obj)

    await this.MS.getRedisClient().set(
      this.msSettingsBLKey,
      JSON.stringify(serializedData),
    )
    this.activeList = obj.active

    return obj
  }

  serializeReqBlackList(data: MSBlSettings): MSBlSettingsRaw {
    const serializedData = (d: (string | RegExp)[]) =>
      d.map((item) =>
        item instanceof RegExp
          ? { __isRegExp: true, source: item.source }
          : item,
      ) as (string | { __isRegExp: true; source: string })[]

    return {
      active: serializedData(data.active),
      default: serializedData(data.default),
    }
  }

  deserializeReqBlackList(dataRaw: MSBlSettingsRaw): MSBlSettings {
    const deserializedData = (
      data: (string | { __isRegExp: true; source: string })[],
    ): (string | RegExp)[] =>
      data.map((item) =>
        typeof item === 'object' && item.__isRegExp
          ? new RegExp(item.source)
          : item,
      ) as (string | RegExp)[]

    return {
      active: deserializedData(dataRaw.active),
      default: deserializedData(dataRaw.default),
    }
  }
}
