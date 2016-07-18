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
  var now = new Date();

  //rss-cache
  var rssCacheId = util.format(config.listCachePolicy.cacheId, this.id);
  var rssCache = yield redis.get(rssCacheId);
  if (config.cacheEnable && rssCache) {
    return JSON.parse(rssCache);
  }

  //query-list-url
  var users = yield this.searchNameProxy(this.id);
  if (users.length == 0)
    throw Error('不存在此微信号');
  var rss = users[0];
  var apiUrl = rss.url;

  //list-collect
  rss.items = yield this.getListData(apiUrl);
  for (var i = 0, l = rss.items.length; i < l; i++) {
    var item = rss.items[i];
    now.setTime(item.lastModified*1000);
    item.formatDate = now.toUTCString();
    var content = yield this.getContentDataProxy(item);
    if (content) {
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
  rss.title = recentItem.sourcename;
  rss.lastModified = recentItem.lastModified;
  now.setTime(rss.lastModified*1000);
  rss.formatDate = now.toUTCString();
  rss.author = recentItem.sourcename;
  return rss;
};


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
  var match = body.match(/var\smsgList\s=\s'([\s\S]*?)';/);
  if (!match || !match[1]) {
    throw new Error('无法获取列表数据');
  }
  var dataJson = JSON.parse(match[1].html());
  if (dataJson.list.length === 0)
    throw new Error(this.id + ': 无相关文章');
  dataJson.list.forEach(function(item) {
    var _item = {
      'docid' : item.comm_msg_info.id,
      'lastModified' : item.comm_msg_info.datetime,
      'title' : item.app_msg_ext_info.title,
      'content' : item.app_msg_ext_info.digest,
      'url' : 'http://mp.weixin.qq.com' + item.app_msg_ext_info.content_url.substr(1).html(),
      'sourcename' : item.app_msg_ext_info.author
    };
    items.push(_item);
    //subList
    var subList = item.app_msg_ext_info.multi_app_msg_item_list;
    if (subList.length > 0) {
      subList.forEach(function(subItem) {
        var _item = {
          'docid' : subItem.fileid,
          'lastModified' : item.comm_msg_info.datetime,
          'title' : subItem.title,
          'content' : subItem.digest,
          'url' : 'http://mp.weixin.qq.com' + subItem.content_url.substr(1).html(),
          'sourcename' : subItem.author
        };
        items.push(_item);
      });
    }
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
  var url = item.url;
  var result =
    yield request(url, {
      headers: yield this.getRequestHeaders()
    });
  if (!result.error && result.statusCode == 200) {
    var match = result.body.match(/id=\"js_content\">([\s\S]*?)<\/div>/);
    var cover = this.getCover(result.body);
    if (match && match[1]) {
      content = match[1].replace(/data-src/g, 'src');
      var coverHtml = cover ? '<p class="article-cover"><img src="' + cover + '"></p>' : '';
      content = coverHtml + content;
      return {'content' : content, 'source' : result.request.href};
    }
  }
}

Weixin.prototype.getCover = function(html) {
  var match = html.match(/var\scover\s=\s\"([\s\S]*?)\";/);
  if (match && match[1]) {
    return match[1];
  }
};

Weixin.prototype.getRequestHeaders = function*() {
  return {
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Cookie': 'sd_userid=74761436088560498; sd_cookie_crttime=1436088560498; 3g_guest_id=-9124332030488707072; ts_refer=www.baidu.com/link; ts_uid=1816741185; eas_sid=f1w4I5H7w224X4z3w9J27844g9; _ga=GA1.2.1140860462.1438155424; pgv_pvid=1467256065; o_cookie=527114214; noticeLoginFlag=1; ptui_loginuin=527114214; ptcz=2a4b878f712cb71f3eeb0fda5a3d488fd4688d292820e1485fa04ee62c2c9500; pt2gguin=o0527114214; uin=o0527114214; skey=@k3f0ouWCY; qm_username=527114214; qm_sid=705e43ed71261bdea26e56d389d4d334,cpfgcNUS3Cs4.; ptisp=ctc',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36',
    'Referer' : 'http://weixin.sogou.com/weixin?type=1&query=%E4%B8%80%E5%85%9C%E7%B3%96&ie=utf8&_sug_=y&_sug_type_=&w=01019900&sut=2112&sst0=1468836385188&lkt=1%2C1468836385080%2C1468836385080'
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
  var regexp = /<div\starget="_blank"([\s\S]*?)<div\sclass="pos-ico">/g;
  var matches = response.body.match(regexp);
  if (!matches)
    throw new Error('查询不到相关账号');
  var result = [];
  for (var i = 0, l = matches.length; i < l; i++) {
    var item = matches[i];
    var match = item.match(/href="([^"]*)"[\s\S]*<img\sstyle="visibility:hidden"\ssrc="([^"]*)"[\s\S]*<h3>(.*)<\/h3>[\s\S]*<span>微信号：<label name="em_weixinhao">(.*)<\/label><\/span>[\s\S]*<span\sclass=\"sp-tit\">功能介绍：<\/span>(.*)<\/span>/);
    if (match) {
      var info = {
        'url'         : match[1].html(),
        'pic'         : util.format(config.imageProxy, match[2]),
        'name'        : this.stripTags(match[3]),
        'id'          : match[4],
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

String.prototype.html = function(encode) {
    var replace =["&#39;", "'", "&quot;", '"', "&nbsp;", " ", "&gt;", ">", "&lt;", "<", "&amp;", "&", "&yen;", "¥"];
    if (encode) {
        replace.reverse();
    }
    for (var i=0,str=this;i< replace.length;i+= 2) {
         str=str.replace(new RegExp(replace[i],'g'),replace[i+1]);
    }
    return str;
};


module.exports = Weixin;