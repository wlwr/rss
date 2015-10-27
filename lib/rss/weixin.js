var request = require('../request');
var redis = require('../redis');
var xmlParser = require('xml2json');
var util = require('util');
var config = require('../../config/weixin');
var cookiePool = require('../cookiePool');
var sogouEncrypt = require('../sogouEncrypt');
var encryptSalt = require('../sogouEncryptSalt');

function Weixin(id) {
  this.id = id;
}

Weixin.prototype.getData = function*() {
  var rss = {};
  var now = new Date();

  //rss-cache
  var rssCacheId = util.format(config.listCachePolicy.cacheId, this.id);
  var rssCache = yield redis.get(rssCacheId);
  if (config.cacheEnable && rssCache && rssCache.items)
    return JSON.parse(rssCache);

  //list-collect
  var ext = yield this.getExtProxy();
  var apiUrl = util.format(config.api.getList, this.id, ext, new Date().getTime());
  rss.items = yield this.getListData(apiUrl);
  for (var i = 0, l = rss.items.length; i < l; i++) {
    var item = rss.items[i];
    now.setTime(item.lastModified*1000);
    item.formatDate = now.toUTCString();
    var content = yield this.getContentDataProxy(item);
    if (content) {
      item.url = content.source;
      item.fullContent = content.content;
    }
  };
  if (rss.items.length == 0)
    throw Error('无相关文章');

  rss = this.getRssInfo(rss);
  yield redis.setex(rssCacheId, config.listCachePolicy.lifeTime, JSON.stringify(rss));
  return rss;
};


Weixin.prototype.getRssInfo = function(rss) {
  var now = new Date();
  var recentItem = rss.items[0];
  rss.id = this.id;
  rss.url = 'http://weixin.sogou.com/gzh?openid=' + this.id;
  rss.title = recentItem.sourcename;
  rss.lastModified = recentItem.lastModified;
  now.setTime(rss.lastModified*1000);
  rss.formatDate = now.toUTCString();
  rss.author = recentItem.sourcename;
  return rss;
};


Weixin.prototype.getExtProxy = function*() {
  var cacheId = util.format(config.extCachePolicy.cacheId, this.id);
  var ext = yield redis.get(cacheId);
  var ext = false;
  if (!config.cacheEnable || !ext) {
    var ext = yield this.getExt();
    yield redis.set(cacheId, ext);
  } 
  return ext;
};

Weixin.prototype.getExt = function*() {
  var url = util.format(config.api.getExt, this.id);
  var response = yield request(url, {
      headers: yield this.getRequestHeaders()
    });
  if (response.error)
    throw new Error(response.error);
  if (response.statusCode != 200)
    throw new Error('response statusCode: ' + response.statusCode);
  var body = response.body;
  var match = body.match(/<h3\sid=\"weixinname\">([\s\S]*?)<\/h3>/);
  if (match && match[1]) {
    var weixinName = match[1];
    var users = yield this.searchName(weixinName);
    for (var i = 0, l = users.length; i < l; i++) {
      if (users[i].openid == this.id)
        return users[i].ext;
    };
  } 
  throw Error('获取不到ext数据');   
};


Weixin.prototype.getEncryptStr = function*() {
  var salt = yield encryptSalt.get();
  if (!salt || !config.cacheEnable) {
    var headers = yield this.getRequestHeaders();
    salt = yield encryptSalt.collect(headers);
    if (!salt)
      throw new Error('update salt error');
    yield encryptSalt.save(salt);
  }
  salt = salt.split(',');
  //list-collect
  sogouEncrypt.setKv(salt[0], salt[1]);
  var encryptStr = sogouEncrypt.encryptquery(this.id, "sogou");
  return encryptStr;
}


Weixin.prototype.getListData = function*(apiUrl) {
  var items = [];
  var response =
    yield request(apiUrl, {
      headers: yield this.getRequestHeaders()
    });
  if (response.error)
    throw new Error(response.error);
  if (response.statusCode != 200)
    throw new Error('response statusCode: ' + response.statusCode);

  var body = response.body;
  var leftLimit = body.indexOf('({');
  var rightLimit = body.indexOf('})');
  if (leftLimit === -1 || rightLimit === -1)
    throw new Error('请求繁忙，请稍后重试..');
  var dataJson = JSON.parse(body.slice(leftLimit + 1, rightLimit + 1));
  if (dataJson.items.length === 0)
    throw new Error(this.id + ': 无相关文章');
  dataJson.items.forEach(function(item) {
    var itemJson = JSON.parse(xmlParser.toJson(item, {sanitize : false}));
    var _item = itemJson.DOCUMENT.item.display;
    items.push(_item);
  });
  return items;
}


Weixin.prototype.getContentDataProxy = function*(item) {
  //content-cache
  var contentCacheId = util.format(config.contentCachePolicy.cacheId, item.docid);
  var content = yield redis.get(contentCacheId);
  if (!config.cacheEnable || !content || !content.content) {
    //content-collect
    content = yield this.getContentData(item);
    if (content) {
      yield redis.setex(contentCacheId, config.contentCachePolicy.lifeTime, JSON.stringify(content));
    }
  } else {
    content = JSON.parse(content);
  }
  return content;
};


Weixin.prototype.getContentData = function*(item) {
  var url = 'http://weixin.sogou.com' + item.url;
  var result =
    yield request(url, {
      headers: yield this.getRequestHeaders()
    });
  if (!result.error && result.statusCode == 200) {
    var match = result.body.match(/id=\"js_content\">([\s\S]*?)<\/div>/);
    if (match && match[1]) {
      content = match[1].replace(/data-src/g, 'src');
      var coverHtml = item.imglink ? '<p class="article-cover"><img src="' + item.imglink + '"></p>' : '';
      content = coverHtml + content;
      return {'content' : content, 'source' : result.request.href};
    }
  }
}

Weixin.prototype.getRequestHeaders = function*() {
  if (!this.cookie) {
    this.cookie = yield cookiePool.getRandom();
  }
  return {
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Cookie': this.cookie,
    'Host': 'weixin.sogou.com',
    'Referer': 'http://weixin.sogou.com/gzh?openid=oIWsFtzoNLI6-6I8GNfFgODdmXAQ',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36'
  }
}

Weixin.prototype.searchNameProxy = function*(keyword) {
  var searchCacheId = util.format(config.searchCachePolicy.cacheId, keyword);
  var result = yield redis.get(searchCacheId);
  if (!config.cacheEnable || !result) {
    var result = yield this.searchName(keyword);
    yield redis.setex(searchCacheId, config.searchCachePolicy.lifeTime, JSON.stringify(result));
  } else {
    result = JSON.parse(result);
  }
  return result;
};

Weixin.prototype.searchName = function*(keyword) {
  var apiUrl = util.format(config.api.searchName, encodeURIComponent(keyword));
  var response = yield request(apiUrl, {
      headers: yield this.getRequestHeaders()
    });
  if (response.error)
    throw new Error(response.error);
  if (response.statusCode != 200)
    throw new Error('response statusCode: ' + response.statusCode);
  var regexp = /<div\sclass="wx-rb\sbg-blue\swx-rb_v1\s_item"([\s\S]*?)<div\sclass="pos-ico">/g;
  var matches = response.body.match(regexp);
  if (!matches)
    throw new Error('查询不到相关账号');
  var result = [];
  for (var i = 0, l = matches.length; i < l; i++) {
    var item = matches[i];
    var match = item.match(/href="\/gzh\?openid=([^&]*)&amp;ext=([^"]*)"[\s\S]*src="([^"]*)"[\s\S]*<h3>(.*)<\/h3>[\s\S]*<span\sclass=\"sp-tit\">功能介绍：<\/span>(.*)<\/span>/);
    if (match) {
      var info = {
        'openid'      : match[1],
        'ext'         : match[2],
        'pic'         : match[3],
        'name'        : this.stripTags(match[4]),
        'description' : this.stripTags(match[5])
      }
      result.push(info);
    }
  };
  return result;
}

Weixin.prototype.stripTags = function(string) {
  return string.replace(/<(.*?)>/g, '');
}

module.exports = Weixin;