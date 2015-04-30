
/**
 * Module dependencies.
 */

var logger = require('koa-logger');
var route = require('koa-route');
var parse = require('co-body');
var koa = require('koa');
var render = require('./lib/render');
var factory = require('./lib/factory');
var counter = require('./lib/counter');


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
  var count = yield counter.get();
  this.body = yield render('home', {count : count});
}


/**
 * weixin-rss builder
 */

function *weixin(id) {
  var handler = factory.create('weixin', id);
  var data = yield handler.getData();
  yield counter.incr();
  if (data.error) {
    this.body = data.error;
  } else {
    this.type = 'text/xml; charset=UTF-8';
    this.body = yield render('weixin', {rss : data});    
  }
}


// listen
app.listen(3000);
console.log('listening on port 3000');
