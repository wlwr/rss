
/**
 * Module dependencies.
 */

var logger = require('koa-logger');
var route = require('koa-route');
var parse = require('co-body');
var koa = require('koa');
var render = require('./lib/render');
var factory = require('./lib/factory');

var app = koa();
// "database"


// middleware

app.use(logger());

// route middleware

app.use(route.get('/', home));
app.use(route.get('/weixin/:id', weixin));


// route definitions

/**
 * home
 */

function *home() {
  this.body = yield render('home');
}


/**
 * weixin-rss builder
 */

function *weixin(id) {
  var handler = factory.create('weixin', id);
  var rss = yield handler.getData();
  this.body = yield render('weixin', {rss : rss});
}


// listen
app.listen(3000);
console.log('listening on port 3000');
