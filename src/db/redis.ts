import fs from 'fs'
import { Redis, RedisOptions } from 'ioredis'
import path from 'path'

const readLuaScripts = async (fileNames: string[]) => {
  return Promise.all(
    fileNames
      .map((fileName) => `commands/${fileName}`)
      .map((filePath) =>
        fs.promises.readFile(path.resolve(__dirname, filePath), 'utf8'),
      ),
  )
}

export interface MSRedis extends Redis {
  getPrefix(): string

  getKeysByPattern(
    keyPrefix: string,
    cursor: string,
    pattern: string,
  ): Promise<string[]>

  getAllHashes<TData extends object>(
    keyPrefix: string,
    cursor: string,
    pattern: string,
  ): Promise<Record<string, TData>[]>

  getDetailedReqHistory(
    keyPrefix: string,
    cursor: string,
    hashPattern: string,
    reqPattern: string,
    metaPattern: string,
    sizeLimit?: number,
  ): Promise<string>
}

export const createRedisClient = async (
  opts: RedisOptions,
): Promise<MSRedis> => {
  const redis = new Redis(opts)

  await createCommands(redis).catch((err) => {
    console.error('Failed to create commands', err)
  })

  return redis as MSRedis
}

async function createCommands(redis: Redis) {
  const [getAllHashesLua, getDetailedReqHistoryLua, getKeysByPatternLua] =
    await readLuaScripts([
      'get-all-hashes.lua',
      'get-detailed-req-history.lua',
      'get-keys-by-pattern.lua',
    ])

  redis.defineCommand('getAllHashes', { numberOfKeys: 0, lua: getAllHashesLua })
  redis.defineCommand('getDetailedReqHistory', {
    numberOfKeys: 0,
    lua: getDetailedReqHistoryLua,
  })

  redis.defineCommand('getKeysByPattern', {
    numberOfKeys: 0,
    lua: getKeysByPatternLua,
  })

  Object.defineProperty(redis, 'getPrefix', {
    value: () => redis.options.keyPrefix || '',
    writable: false,
    enumerable: false,
    configurable: false,
  })
}
