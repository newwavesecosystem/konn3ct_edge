-- select_and_assign_relay.lua
-- Atomically selects the least-loaded READY Relay Router, checks projected capacity,
-- reserves estimatedConsumerCount + currentViewerCount, and commits participant assignment.

local roomId = ARGV[1]
local participantId = ARGV[2]
local consumerCost = tonumber(ARGV[3]) or 2
local maxConsumers = tonumber(ARGV[4]) or 500
local maxViewers = tonumber(ARGV[5]) or 250

local relayKeysPattern = "room:" .. roomId .. ":routerCapacity:*"
local keys = redis.call("KEYS", relayKeysPattern)

local bestKey = nil
local bestLoad = 999999
local bestCurrentViewers = 0

for _, capKey in ipairs(keys) do
  -- capKey format: room:<roomId>:routerCapacity:<routerKey>
  local routerKey = string.sub(capKey, string.len("room:" .. roomId .. ":routerCapacity:") + 1)
  
  -- Check if router is a relay and READY
  local role = redis.call("HGET", capKey, "role")
  local state = redis.call("HGET", capKey, "state")
  
  if role == "relay" and (state == "READY" or state == nil or state == "") then
    local estConsumers = tonumber(redis.call("HGET", capKey, "estimatedConsumerCount") or "0")
    local curViewers = tonumber(redis.call("HGET", capKey, "currentViewerCount") or "0")
    
    local projectedConsumers = estConsumers + consumerCost
    local projectedViewers = curViewers + 1
    
    if projectedConsumers <= maxConsumers and projectedViewers <= maxViewers then
      if estConsumers < bestLoad then
        bestLoad = estConsumers
        bestKey = routerKey
        bestCurrentViewers = curViewers
      end
    end
  end
end

if bestKey then
  local targetCapKey = "room:" .. roomId .. ":routerCapacity:" .. bestKey
  redis.call("HINCRBY", targetCapKey, "estimatedConsumerCount", consumerCost)
  redis.call("HINCRBY", targetCapKey, "currentViewerCount", 1)
  redis.call("HSET", "room:" .. roomId .. ":participantMap", participantId, bestKey)
  return { 1, bestKey, bestLoad + consumerCost }
else
  return { 0, "capacity_preparing" }
end
