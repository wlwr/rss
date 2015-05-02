var request = require('./request');
var redis = require('./redis');
var util = require('util');
var config = require('../config/weixin');

function CookiePool() {
  this.cacheId = config.cookieCachePolicy.cacheId;
  this.lifeTime = config.cookieCachePolicy.lifeTime;
  this.num = config.cookieNum;
}

CookiePool.prototype.collectAll = function*() {
  var cookies = [];
  for (var i = 0, l = this.num; i < l; i++) {
    var cookie = yield this.collect();
    if (cookie)
      cookies.push(cookie);
  };
  return cookies;
}

CookiePool.prototype.save = function*(cookies) {
    yield redis.sadd(this.cacheId, cookies);  
    yield redis.expire(this.cacheId, this.lifeTime);
}

CookiePool.prototype.collect = function*() {
  var url = util.format(config.api.getCookie, Math.random().toString(36).substr(2));
  var result = yield request(url, {
    proxyEnable: false
  });
  if (!result.error && result.statusCode == 200) {
    var cookieStr = result.headers['set-cookie'].join(';');
    var SNUID = cookieStr.match(/(SNUID=\S+?);/);
    var SUID = cookieStr.match(/(SUID=\S+?);/)[1];
    if (SNUID) 
      SNUID = SNUID[1];
    var SUV = 'SUV=' + ((new Date()).getTime())*1000+Math.round(Math.random()*1000);
    var cookie = [SNUID, SUID, SUV].join(';');
    console.log(cookie);
    return cookie;
  }  
}

CookiePool.prototype.getRandom = function*() {
  return yield redis.srandmember(this.cacheId);
}

CookiePool.prototype.destroy = function*() {
  return yield redis.del(this.cacheId);
}

CookiePool.prototype.getAll = function*() {
  return yield redis.smembers(this.cacheId);
}

module.exports = new CookiePool();
