local prefix = ARGV[1]
local cursor = ARGV[2]
local pattern = ARGV[3]

local list = {}

--
-- Scans all keys that match the pattern
--
-- Complexity: O(N)
--
repeat
    local result = redis.call('SCAN', cursor, 'MATCH', prefix .. pattern)
    cursor = result[1]

    for _, prefixKey in ipairs(result[2]) do
        local key = string.sub(prefixKey, string.len(prefix) + 1)
        list[#list + 1] = key
    end
until cursor == '0'

return list
