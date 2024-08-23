local cursor = ARGV[1]
local pattern = ARGV[2]

local list = {}

--
-- Scans all keys that match the pattern
--
-- Complexity: O(N)
--
repeat
    local result = redis.call('SCAN', cursor, 'MATCH', pattern)
    cursor = result[1]

    for _, v in ipairs(result[2]) do
        list[#list+1] = v
    end

until cursor == '0'

return list
