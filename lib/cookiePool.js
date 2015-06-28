var request = require('./request');
var redis = require('./redis');
var util = require('util');
var config = require('../config/weixin');
var phantom = require('phantom');

function CookiePool() {
  this.cacheId = config.cookieCachePolicy.cacheId;
  this.lifeTime = config.cookieCachePolicy.lifeTime;
  this.num = config.cookieNum;
  this.engine = config.cookieCollectEngine;
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
  var actionName = this.engine + 'Collect';
  var apiUrl = util.format(config.api.getCookie);
  var cookie = yield this[actionName](apiUrl);
  console.log(cookie);
  return cookie;
}

CookiePool.prototype.requestCollect = function*(url) {
  var result = yield request(url, {
    proxyEnable: false
  });
  if (!result.error && result.statusCode == 200) {
    var cookieStr = result.headers['set-cookie'].join(';');
    return this.parseCookie(cookieStr);
  }  
}

CookiePool.prototype.phantomCollect = function(url) {
  var me = this;
  return function(callback) {
    phantom.create(function (ph) {
      ph.createPage(function (page) {
        page.set('onResourceRequested', function(requestData, request) {
          if ((/http:\/\/.+?\.css/gi).test(requestData['url']) || requestData['Content-Type'] == 'text/css') {
            // console.log('The url of the request is matching. Aborting: ' + requestData['url']);
            request['abort()'];
          }
        });
        page.open(url, function (status) {
          page.evaluate(function () { return document.cookie; }, function (result) {
            callback(null, me.parseCookie(result + ';'));
            ph.exit();
          });
        });
      });
    }, {parameters: {'load-images': 'no'}});  
  }
}

CookiePool.prototype.parseCookie = function(cookieStr) {
  var SNUID = cookieStr.match(/(SNUID=\S+?);/);
  var SUID = cookieStr.match(/(SUID=\S+?);/)[1];
  if (SNUID) 
    SNUID = SNUID[1];
  var SUV = 'SUV=' + ((new Date()).getTime())*1000+Math.round(Math.random()*1000);
  var cookie = [SNUID, SUID, SUV].join(';');
  return cookie;
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
