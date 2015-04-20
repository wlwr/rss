var request = require('../request');
var redis = require('../redis');
var xmlParser = require('xml2json');

function Weixin(id) {
  this.id = id;
  this.listCacheLifeTime = 43200;
  this.contentCacheLifeTime = 86400 * 7;
}

Weixin.prototype.getUrl = function() {
  return 'http://weixin.sogou.com/gzhjs?cb=sogou.weixin.gzhcb&openid=' + this.id + '&page=1&t=' + new Date().getTime();
}

Weixin.prototype.getListCacheId = function() {
  return 'rss:' + this.id;
}

Weixin.prototype.getContentCacheId = function(contentId) {
  return 'rss:content:' + contentId;
}

Weixin.prototype.getData = function*() {
  var listCacheId = this.getListCacheId();
  var listCache = yield redis.get(listCacheId);
  if (listCache)
    return JSON.parse(listCache);
  var apiUrl = this.getUrl();
  var rss = {};
  rss.items = [];
  var response =
    yield request({
      url: apiUrl
    });
  if (response.error) 
    return {error : response.error};
  if (response.statusCode != 200)
    return {error : 'response statusCode: ' + response.statusCode}
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
    var contentCacheId = this.getContentCacheId(item.docid);
    var contentCache = yield redis.get(contentCacheId);
    if (contentCache) {
      item.fullContent = contentCache;
    } else {
      var contentRes = yield request({
        url : item.url
      });
      if (!contentRes.error && contentRes.statusCode == 200) {
        var match = contentRes.body.match(/id=\"js_content\">(.*)<\/div>/);
        if (match[1]) {
          item.fullContent = match[1].replace(/data-src/g, 'src');
          yield redis.setex(contentCacheId, this.contentCacheLifeTime, item.fullContent);
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
  yield redis.setex(listCacheId, this.listCacheLifeTime, JSON.stringify(rss));
  return rss;
};


module.exports = Weixin;