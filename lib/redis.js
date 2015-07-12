var co = require('co');
var config = require('../config/global');
var redisClient = require('redis').createClient(config.redis.port, config.redis.host);
redisClient.on("error", function (err) {
  console.log("Error " + err);
});
var wrapper = require('co-redis');
var redisCo = wrapper(redisClient);
module.exports = redisCo;