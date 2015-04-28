var request = require('../request');
var redis = require('../redis');
var xmlParser = require('xml2json');
var util = require('util');
var config = require('../../config/weixin');

function Weixin(id) {
  this.id = id;
}

Weixin.prototype.getData = function*() {
  var listCacheId = util.format(config.listCachePolicy.cacheId, this.id);
  var listCache =
    yield redis.get(listCacheId);
  if (config.cacheEnable && listCache)
    return JSON.parse(listCache);
  var apiUrl = util.format(config.api.getList, this.id, new Date().getTime());
  var rss = {};
  rss.items = [];
  var response =
    yield request({
      url: apiUrl
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
    rss.items.push(_item);
  });
  // collect content
  for (var i = 0, l = rss.items.length; i < l; i++) {
    var item = rss.items[i];
    var contentCacheId = util.format(config.contentCachePolicy.cacheId, item.docid);
    var contentCache =
      yield redis.get(contentCacheId);
    if (config.cacheEnable && contentCache) {
      item.fullContent = contentCache;
    } else {
      var contentRes =
        yield request({
          url: item.url
        });
      if (!contentRes.error && contentRes.statusCode == 200) {
        var match = contentRes.body.match(/id=\"js_content\">(.*)<\/div>/);
        if (match && match[1]) {
          item.fullContent = match[1].replace(/data-src/g, 'src');
          yield redis.setex(contentCacheId, config.contentCachePolicy.lifeTime, item.fullContent);
        }
      }
    }
  };
  if (typeof rss.items[0] != 'undefined') {
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


module.exports = Weixin;