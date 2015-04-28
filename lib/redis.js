var co = require('co');
var config = require('../config/global');
var redisClient = require('redis').createClient(config.redis.port, config.redis.host);
var wrapper = require('co-redis');
var redisCo = wrapper(redisClient);
module.exports = redisCo;