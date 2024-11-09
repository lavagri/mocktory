local arg_prefix = ARGV[1]
local arg_cursor = ARGV[2]
local arg_pattern = ARGV[3]
local arg_responsePattern = ARGV[4]
local arg_responseMetaPattern = ARGV[5]
local arg_responseSizeLimit = tonumber(ARGV[6]) or 200

local function getMeta(prefix, metPattern, requestId)
    local meta = redis.call('GET', prefix .. metPattern .. requestId)
    return cjson.decode(meta or '{}')
end

local function processHistoryRecord(
prefix,
    key,
    responsePattern,
    responseMetaPattern,
    responseSizeLimit
)
    local values = redis.call('HGETALL', prefix .. key)
    local keyValues = {}

    for i = 1, #values, 2 do
        local decodedValue = cjson.decode(values[i + 1])

        if decodedValue.requestId then
            decodedValue.meta =
                getMeta(prefix, responseMetaPattern, decodedValue.requestId)

            local metaSize = tonumber(decodedValue.meta.size) or math.huge
            if metaSize and metaSize > responseSizeLimit then
                decodedValue.response = '"[Response is too large]"'
            else
                decodedValue.response =
                    redis.call(
                        'GET',
                        prefix .. responsePattern .. decodedValue.requestId
                    )
            end
        end

        keyValues[values[i]] = decodedValue
    end

    return keyValues
end

local function scanAndProcess(
prefix,
    cursor,
    pattern,
    responsePattern,
    responseMetaPattern,
    responseSizeLimit
)
    local finalObject = {}

    repeat
        local result = redis.call('SCAN', cursor, 'MATCH', prefix .. pattern)

        cursor = result[1]
        local keys = result[2]

        for _, prefixKey in ipairs(keys) do
            local key = string.sub(prefixKey, string.len(prefix) + 1)
            finalObject[key] =
                processHistoryRecord(
                    prefix,
                    key,
                    responsePattern,
                    responseMetaPattern,
                    responseSizeLimit
                )
        end
    until cursor == '0'

    return finalObject
end

return cjson.encode(
    scanAndProcess(
        arg_prefix,
        arg_cursor,
        arg_pattern,
        arg_responsePattern,
        arg_responseMetaPattern,
        arg_responseSizeLimit
    )
)
