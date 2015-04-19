var request = require('../request');
var xmlParser = require('xml2json');

function Weixin(id) {
  this.id = id;
}

Weixin.prototype.getUrl = function() {
  return 'http://weixin.sogou.com/gzhjs?cb=sogou.weixin.gzhcb&openid=' + this.id + '&page=1&t=' + new Date().getTime();
}

Weixin.prototype.getData = function*() {
  var apiUrl = this.getUrl();
  var rss = {};
  rss.items = [];
  var response =
    yield request({
      url: apiUrl
    });
  var body = response.body;
  var leftLimit = body.indexOf('({');
  var rightLimit = body.indexOf('})');
  var dataJson = JSON.parse(body.slice(leftLimit + 1, rightLimit + 1));
  dataJson.items.forEach(function(item) {
    var itemJson = JSON.parse(xmlParser.toJson(item));
    rss.items.push(itemJson.DOCUMENT.item.display);
  });
  if (typeof rss.items[0] != 'undefined') {
    var recentItem = rss.items[0];
    rss.id = this.id;
    rss.url = apiUrl;
    rss.title = recentItem.sourcename;
    rss.updated = recentItem.date;
    rss.author = recentItem.sourcename;
  }
  return rss;
};


module.exports = Weixin;