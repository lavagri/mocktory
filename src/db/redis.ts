import fs from 'fs'
import { Redis } from 'ioredis'
import path from 'path'

const getHistoryLua = fs.readFileSync(
  path.resolve(__dirname, 'get-all-hashes.lua'),
  'utf8',
)
const getDetailedReqHistoryLua = fs.readFileSync(
  path.resolve(__dirname, 'get-detailed-req-history.lua'),
  'utf8',
)

export interface MSRedis extends Redis {
  getAllHashes(cursor: string, pattern: string): Promise<string>
  getDetailedReqHistory(
    cursor: string,
    hashPattern: string,
    reqPattern: string,
  ): Promise<string>
}

export const createRedisClient = (opts: {
  host: string
  port: number
}): MSRedis => {
  const redis = new Redis(opts) as MSRedis

  redis.defineCommand('getAllHashes', { numberOfKeys: 0, lua: getHistoryLua })
  redis.defineCommand('getDetailedReqHistory', {
    numberOfKeys: 0,
    lua: getDetailedReqHistoryLua,
  })

  return redis
}
