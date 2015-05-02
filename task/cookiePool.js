var cookiePool = require('../lib/cookiePool');
var co = require('co');
co(function*() {
  yield cookiePool.destroy();
  var cookies = yield cookiePool.collectAll();
  yield cookiePool.save(cookies);
  console.log(cookies.join(' '));
});