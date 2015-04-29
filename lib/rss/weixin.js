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
      url: apiUrl,
      headers : {
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Cookie': 'IPLOC=CN4401; SUV=000B19F77781D0C0553902ACF33F2055; SUID=C0D081774C1C920A00000000553902B3; CXID=C53C5E8DDFE47686BCCB8F1CB0C04A03; usid=5EmrMOrWQRgPWqD-; ld=@Zllllllll2qny38lllllVUilHolllllNc4yZlllllwlllllVholl5@@@@@@@@@@; ABTEST=8|1430057955|v1; weixinIndexVisited=1; ad=Xyllllllll2qny3ElllllVUdHSolllllNc4yZlllllylllllpCxlw@@@@@@@@@@@; SNUID=F2DA8A7D0B0E1ED4B021D22A0B796CB8; sct=15; wapsogou_qq_nickname=',
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