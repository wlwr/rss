var request = require('../request');
var redis = require('../redis');
var xmlParser = require('xml2json');
var util = require('util');
var config = require('../../config/weixin');
var cookiePool = require('../cookiePool');
var sogouEncrypt = require('../sogouEncrypt');

function Weixin(id) {
  this.id = id;
}

Weixin.prototype.getData = function*() {
  var rss = {};
  //list-cache
  var listCacheId = util.format(config.listCachePolicy.cacheId, this.id);
  var listCache =
    yield redis.get(listCacheId);
  if (config.cacheEnable && listCache && listCache.items)
    return JSON.parse(listCache);
  //list-collect
  sogouEncrypt.setKv("8d04ae022be","9");
  var encryptStr = sogouEncrypt.encryptquery(this.id,"sogou");
  var apiUrl = util.format(config.api.getList, encryptStr, new Date().getTime());
  rss.items = yield this.getListData(apiUrl);
  for (var i = 0, l = rss.items.length; i < l; i++) {
    var item = rss.items[i];
    //content-cache
    var contentCacheId = util.format(config.contentCachePolicy.cacheId, item.docid);
    var content =
      yield redis.get(contentCacheId);
    if (!config.cacheEnable || !content) {
      //content-collect
      content = yield this.getContentData(item);
      if (content)
        yield redis.setex(contentCacheId, config.contentCachePolicy.lifeTime, content);
    }
    item.fullContent = content;
  };
  if (rss.items[0]) {
    var recentItem = rss.items[0];
    rss.id = this.id;
    rss.url = apiUrl;
    rss.title = recentItem.sourcename;
    rss.updated = recentItem.date;
    rss.author = recentItem.sourcename;
  }
  yield redis.setex(listCacheId, config.listCachePolicy.lifeTime, JSON.stringify(rss));
  return rss;
};


Weixin.prototype.getListData = function*(apiUrl) {
  var items = [];
  var cookie = yield cookiePool.getRandom();
  var response =
    yield request(apiUrl, {
      headers : this.getRequestHeaders(cookie)
    });
  if (response.error)
    throw new Error(response.error);
  if (response.statusCode != 200)
    throw new Error('response statusCode: ' + response.statusCode);

  var body = response.body;
  var leftLimit = body.indexOf('({');
  var rightLimit = body.indexOf('})');
  if (leftLimit === -1 || rightLimit === -1)
    throw new Error('采集异常，无法获取数据');
  var dataJson = JSON.parse(body.slice(leftLimit + 1, rightLimit + 1));
  if (dataJson.items.length === 0)
    throw new Error(this.id + ': 无相关文章');
  dataJson.items.forEach(function(item) {
    var itemJson = JSON.parse(xmlParser.toJson(item));
    var _item = itemJson.DOCUMENT.item.display;
    items.push(_item);
  });
  return items;
}


Weixin.prototype.getContentData = function*(item) {
    var result =
      yield request(item.url);
    if (!result.error && result.statusCode == 200) {
      var match = result.body.match(/id=\"js_content\">(.*)<\/div>/);
      if (match && match[1]) {
        content = match[1].replace(/data-src/g, 'src');
        return content;
      }
    }
}

Weixin.prototype.getRequestHeaders = function(cookie) {
  return {
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Cookie': cookie,
    'Host': 'weixin.sogou.com',
    'Referer': 'http://weixin.sogou.com/gzh?openid=oIWsFtzoNLI6-6I8GNfFgODdmXAQ',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36'
  }
}

module.exports = Weixin;