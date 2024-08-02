local cursor = ARGV[1]
local pattern = ARGV[2]

local finalObject = {}

repeat
    local result = redis.call('SCAN', cursor, 'MATCH', pattern)
    cursor = result[1]
    local keys = result[2]

    for _, key in ipairs(keys) do
        local values = redis.call('HGETALL', key)
        local keyValues = {}

        -- Convert values into key-value pairs
        for i = 1, #values, 2 do
            keyValues[values[i]] = cjson.decode(values[i + 1])
        end

        -- Add key-values to final object
        finalObject[key] = keyValues
    end
until cursor == '0'

-- Serialize final object to JSON
return cjson.encode(finalObject)
