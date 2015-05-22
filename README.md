# rss
提供微信公众号RSS订阅接口，基于nodejs koajs开发

演示地址：[http://rss.wlwr.net](http://rss.wlwr.net)

## 更新日志

- 2015.05.22 搜狗微信接口做了加密处理，导致采集失败。(已修复)

---

## 搭建

- 安装 `io.js` 或 `Node.js 0.11` 以上版本，才支持 ES6相关语法

- 安装 `redis-server` 端，默认端口是 `6379`


进入项目根目录, `npm install`，然后 `node --harmony app.js` 即可启动

----

## 反反爬虫机制

请求过多会触发搜狗的反爬虫机制，搜狗的反爬虫机制主要通过cookie识别。

可通过定时生成cookie池 (执行 `node task/cookiePool`)，然后每次请求会从cookie池里随机取。
