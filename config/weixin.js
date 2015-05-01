module.exports = {

	cacheEnable: true,

	api: {
		getList: 'http://weixin.sogou.com/gzhjs?cb=sogou.weixin.gzhcb&openid=%s&page=1&t=%d',
		getCookie: 'http://weixin.sogou.com/weixin?query=%s'
	},

	listCachePolicy: {
		lifeTime: 43200,
		cacheId: 'rss:list:%s'
	},

	contentCachePolicy: {
		lifeTime: 864000,
		cacheId: 'rss:content:%s'
	},

	cookieNum : 10,

	cookieCachePolicy: {
		lifeTime: 43200,
		cacheId: 'rss:cookies'
	}
}