module.exports = {

	cacheEnable: true,

	api: {
		getList: 'http://weixin.sogou.com/gzhjs?cb=sogou.weixin.gzhcb&openid=%s&%s&page=1&t=%d',
		getCookie: 'http://weixin.sogou.com/weixin?query=123',
		getEncryptSalt: 'http://weixin.sogou.com/gzh?openid=123'
	},

	saltCachePolicy : {
		lifeTime: 600,
		cacheId: 'rss:salt:%s'		
	},

	listCachePolicy: {
		lifeTime: 86400,
		cacheId: 'rss:list:%s'
	},

	contentCachePolicy: {
		lifeTime: 864000,
		cacheId: 'rss:content:%s'
	},

	//options : request || phantom
	cookieCollectEngine : 'phantom',

	cookieNum : 10,

	cookieCachePolicy: {
		lifeTime: 43200,
		cacheId: 'rss:cookies'
	}
}