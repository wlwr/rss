var request = require('./request');
var redis = require('./redis');
var util = require('util');
var config = require('../config/weixin');
var phantom = require('phantom');

function Salt() {
  this.apiUrl = config.api.getEncryptSalt;
  this.cacheId = config.saltCachePolicy.cacheId;
  this.lifeTime = config.saltCachePolicy.lifeTime;
}

Salt.prototype.get = function*() {
  return yield redis.get(this.cacheId);
}

Salt.prototype.save = function*(salt) {
  yield redis.setex(this.cacheId, this.lifeTime, salt); 
}

Salt.prototype.collect = function*(headers) {
  var result =
    yield request(this.apiUrl, {
      headers: headers
    });
  if (!result.error && result.statusCode == 200) {
    console.log(this.apiUrl);
    var match = result.body.match(/SogouEncrypt\.setKv\(\"(.*?)\"\)/);
    if (match && match[1]) {
      sale = match[1].replace('","', ',');
      return sale;
    }
  }
  return '';
}


Salt.prototype.destroy = function*() {
  return yield redis.del(this.cacheId);
}



module.exports = new Salt();
