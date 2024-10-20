local arg_cursor = ARGV[1]
local arg_pattern = ARGV[2]
local arg_responsePattern = ARGV[3]
local arg_responseMetaPattern = ARGV[4]
local arg_responseSizeLimit = tonumber(ARGV[5]) or 200

local function getMeta(metPattern, requestId)
    local meta = redis.call('GET', metPattern .. requestId)
    return cjson.decode(meta or '{}')
end

local function processHistoryRecord(
key,
    responsePattern,
    responseMetaPattern,
    responseSizeLimit
)
    local values = redis.call('HGETALL', key)
    local keyValues = {}

    for i = 1, #values, 2 do
        local decodedValue = cjson.decode(values[i + 1])

        if decodedValue.requestId then
            decodedValue.meta =
                getMeta(responseMetaPattern, decodedValue.requestId)

            local metaSize = tonumber(decodedValue.meta.size) or math.huge
            if metaSize and metaSize > responseSizeLimit then
                decodedValue.response = '"[Response is too large]"'
            else
                decodedValue.response =
                    redis.call('GET', responsePattern .. decodedValue.requestId)
            end
        end

        keyValues[values[i]] = decodedValue
    end

    return keyValues
end

local function scanAndProcess(
cursor,
    pattern,
    responsePattern,
    responseMetaPattern,
    responseSizeLimit
)
    local finalObject = {}
    local result = redis.call('SCAN', cursor, 'MATCH', pattern)

    cursor = result[1]
    local keys = result[2]

    for _, key in ipairs(keys) do
        finalObject[key] =
            processHistoryRecord(
                key,
                responsePattern,
                responseMetaPattern,
                responseSizeLimit
            )
    end

    return finalObject
end

return cjson.encode(
    scanAndProcess(
        arg_cursor,
        arg_pattern,
        arg_responsePattern,
        arg_responseMetaPattern,
        arg_responseSizeLimit
    )
)
