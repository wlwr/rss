module.exports = {
	api: {
		getList: 'http://weixin.sogou.com/gzhjs?cb=sogou.weixin.gzhcb&openid=%s&page=1&t=%d'
	},

	listCachePolicy: {
		lifeTime: 43200,
		cacheId: 'rss:list:%s'
	},

	contentCachePolicy: {
		lifeTime: 864000,
		cacheId: 'rss:content:%s'
	}
}