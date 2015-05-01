var request = require('../request');
var redis = require('../redis');
var xmlParser = require('xml2json');
var util = require('util');
var config = require('../../config/weixin');

function Weixin(id) {
  this.id = id;
}

Weixin.prototype.getData = function*() {
  var rss = {};
  //list-cache
  var listCacheId = util.format(config.listCachePolicy.cacheId, this.id);
  var listCache =
    yield redis.get(listCacheId);
  if (config.cacheEnable && listCache)
    return JSON.parse(listCache);
  //list-collect
  var apiUrl = util.format(config.api.getList, this.id, new Date().getTime());
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
  var response =
    yield request({
      url: apiUrl,
      headers : {
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Cookie': 'ABTEST=7|1430464029|v1; IPLOC=CN4401; SUID=93B206B7260C930A000000005543261D; SUID=93B206B75FC00D0A000000005543261D; SUV=00001004B706B2935543261D51259284; weixinIndexVisited=1; sct=1; SNUID=4A6ADF6FD9DDCD2605479DE9D987AB98; wapsogou_qq_nickname=',
        'Host': 'weixin.sogou.com',
        'Referer': 'http://weixin.sogou.com/gzh?openid=oIWsFtzoNLI6-6I8GNfFgODdmXAQ',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36'
      }
    });
  if (response.error)
    return {
      error: response.error
    };
  console.log(response);
  if (response.statusCode != 200)
    return {
      error: 'response statusCode: ' + response.statusCode
    }
  var body = response.body;
  var leftLimit = body.indexOf('({');
  var rightLimit = body.indexOf('})');
  var dataJson = JSON.parse(body.slice(leftLimit + 1, rightLimit + 1));
  dataJson.items.forEach(function(item) {
    var itemJson = JSON.parse(xmlParser.toJson(item));
    var _item = itemJson.DOCUMENT.item.display;
    items.push(_item);
  });
  return items;
}


Weixin.prototype.getContentData = function*(item) {
    var contentRes =
      yield request({
        url: item.url
      });
    if (!contentRes.error && contentRes.statusCode == 200) {
      var match = contentRes.body.match(/id=\"js_content\">(.*)<\/div>/);
      if (match && match[1]) {
        content = match[1].replace(/data-src/g, 'src');
        return content;
      }
    }
}

Weixin.prototype.setCookiePool = function*() {

}

Weixin.prototype.getCookie = function*() {
  
}

module.exports = Weixin;