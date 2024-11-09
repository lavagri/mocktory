local prefix = ARGV[1]
local cursor = ARGV[2]
local pattern = ARGV[3]

local finalObject = {}

--
-- Scans all keys that match the pattern and get each hashes
--
-- Complexity: O(N + M)
-- N is the total number of keys in the database.
-- M is the number of keys that match the pattern and for which HGETALL is called.
--
repeat
    local result = redis.call('SCAN', cursor, 'MATCH', prefix .. pattern)
    cursor = result[1]
    local keys = result[2]

    for _, prefixKey in ipairs(keys) do
        local key = string.sub(prefixKey, string.len(prefix) + 1)
        local values = redis.call('HGETALL', prefixKey)
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
