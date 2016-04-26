module.exports = {

  imageProxy : 'http://read.html5.qq.com/image?src=forum&q=5&r=0&imgflag=7&imageUrl=%s',

	cacheEnable: true,

	api: {
		getList: 'http://weixin.sogou.com/gzhjs?cb=sogou.weixin.gzhcb&openid=%s&ext=%s&page=1&t=%d',
		getCookie: 'http://weixin.sogou.com/weixin?query=123',
		searchName: 'http://weixin.sogou.com/weixin?query=%s'
	},


	listCachePolicy: {
		lifeTime: 86400,
		cacheId: 'rss:list:%s'
	},

	contentCachePolicy: {
		lifeTime: 864000,
		cacheId: 'rss:content:%s'
	},

	searchCachePolicy: {
		lifeTime: 864000,
		cacheId: 'rss:search:%s'		
	},

	//options : request || phantom
	cookieCollectEngine : 'phantom',

	cookieNum : 10,

	cookieCachePolicy: {
		lifeTime: 43200,
		cacheId: 'rss:cookies'
	}
}