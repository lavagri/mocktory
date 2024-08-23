local cursor = ARGV[1]
local pattern = ARGV[2]
local responsePattern = ARGV[3]
local responseMetaPattern = ARGV[4]
local responseSizeLimit = tonumber(ARGV[5]) or 200

local finalObject = {}

repeat
    local result = redis.call('SCAN', cursor, 'MATCH', pattern)
    cursor = result[1]
    local keys = result[2]

    for _, key in ipairs(keys) do
        local values = redis.call('HGETALL', key)
        local keyValues = {}

        for i = 1, #values, 2 do
            local decodedValue = cjson.decode(values[i + 1])

            if decodedValue.requestId then
                local meta = redis.call('GET', responseMetaPattern .. decodedValue.requestId)

                decodedValue.meta = cjson.decode(meta or '{}')

                if decodedValue.meta.size and decodedValue.meta.size > responseSizeLimit then
                    decodedValue.response = '"[Response is too large]"'
                else
                    decodedValue.response = redis.call('GET', responsePattern .. decodedValue.requestId)
                end
            end

            keyValues[values[i]] = decodedValue
        end

        finalObject[key] = keyValues
    end
until cursor == '0'

return cjson.encode(finalObject)
